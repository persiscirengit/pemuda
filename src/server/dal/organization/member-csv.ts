import "server-only";

import { format } from "date-fns";
import { eq } from "drizzle-orm";
import Papa from "papaparse";
import { z } from "zod";
import { db } from "@/db";
import {
  departments,
  type Member,
  members,
  positions,
} from "@/db/schema/organization";
import { PERMISSIONS } from "@/lib/permissions";
import { requirePermission, type UserSession } from "@/server/dal/auth";
import {
  type GetMembersParams,
  getMembers,
} from "@/server/dal/organization/members";

export const MAX_CSV_SIZE = 5 * 1024 * 1024; // 5MB

export const MEMBER_CSV_COLUMNS = [
  "npa",
  "full_name",
  "phone",
  "email",
  "address",
  "joined_at",
  "birth_date",
  "department",
  "position",
  "member_status",
  "inactive_reason",
  "inactive_at",
  "status_notes",
  "notes",
] as const;

export const MEMBER_CSV_EXPORT_COLUMNS = [
  "No",
  "NPA",
  "Full Name",
  "Phone",
  "Email",
  "Address",
  "Joined Date",
  "Birth Date",
  "Age",
  "Age Status",
  "Department",
  "Position",
  "Member Status",
  "Inactive Reason",
  "Inactive Date",
  "Status Notes",
  "Account Login Status",
  "Notes",
] as const;

export interface MemberCsvImportRowError {
  row: number;
  column?: string;
  message: string;
}

export interface MemberCsvImportResult {
  totalRows: number;
  created: number;
  updated: number;
  failed: number;
  errors: MemberCsvImportRowError[];
}

export interface MemberCsvImportOptions {
  dryRun?: boolean;
  sessionOverride?: UserSession | null;
}

export interface MemberCsvExportOptions {
  sessionOverride?: UserSession | null;
}

const memberStatusEnum = z.enum(["active", "inactive"]);
const inactiveReasonEnum = z.enum([
  "rarely_active",
  "resigned",
  "age_limit",
  "transferred_to_persis",
  "moved_domicile",
  "other",
]);

function normalizeDate(val?: string | null): string | null {
  if (!val || val.trim().length === 0) return null;
  const trimmed = val.trim();
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const d = new Date(trimmed);
    if (!Number.isNaN(d.getTime())) return trimmed;
  }
  // DD/MM/YYYY
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed)) {
    const parts = trimmed.split("/").map(Number);
    const day = parts[0];
    const month = parts[1];
    const year = parts[2];
    if (day && month && year) {
      const d = new Date(year, month - 1, day);
      if (!Number.isNaN(d.getTime())) {
        return format(d, "yyyy-MM-dd");
      }
    }
  }
  const d = new Date(trimmed);
  if (!Number.isNaN(d.getTime())) {
    return format(d, "yyyy-MM-dd");
  }
  return null;
}

export function generateMemberCsvTemplate(): string {
  const sample = [
    {
      npa: "10.05.001",
      full_name: "Ahmad Fauzi",
      phone: "+6281234567890",
      email: "ahmad.fauzi@pemuda.local",
      address: "Jl. Cirengit No. 12",
      joined_at: "2024-01-01",
      birth_date: "1998-05-15",
      department: "Kaderisasi",
      position: "Ketua",
      member_status: "active",
      inactive_reason: "",
      inactive_at: "",
      status_notes: "",
      notes: "Sample notes",
    },
  ];

  return Papa.unparse(sample, {
    columns: [...MEMBER_CSV_COLUMNS],
    header: true,
  });
}

export async function processMemberCsvImport(
  csvContent: string,
  options?: MemberCsvImportOptions,
): Promise<MemberCsvImportResult> {
  await requirePermission(
    PERMISSIONS.ORGANIZATION_MEMBERS_IMPORT,
    options?.sessionOverride,
  );

  const byteLength = Buffer.byteLength(csvContent, "utf8");
  if (byteLength > MAX_CSV_SIZE) {
    throw new Error("CSV file exceeds 5MB size limit");
  }

  const parsed = Papa.parse<Record<string, string>>(csvContent, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim().toLowerCase(),
  });

  const fields = (parsed.meta.fields || []).map((f) => f.toLowerCase());
  const hasFullName = fields.includes("full_name");
  const hasMemberStatus = fields.includes("member_status");

  if (!hasFullName || !hasMemberStatus) {
    return {
      totalRows: 0,
      created: 0,
      updated: 0,
      failed: 1,
      errors: [
        {
          row: 1,
          message:
            "Invalid CSV header structure: missing required columns (full_name, member_status)",
        },
      ],
    };
  }

  const [allDepts, allPositions, existingMembers] = await Promise.all([
    db.select({ id: departments.id, name: departments.name }).from(departments),
    db.select({ id: positions.id, name: positions.name }).from(positions),
    db.select().from(members),
  ]);

  const deptMap = new Map<string, string>(
    allDepts.map((d) => [d.name.trim().toLowerCase(), d.id]),
  );
  const posMap = new Map<string, string>(
    allPositions.map((p) => [p.name.trim().toLowerCase(), p.id]),
  );

  const memberByNpa = new Map<string, Member>();
  const memberByEmail = new Map<string, Member>();

  for (const m of existingMembers) {
    if (m.memberNumber) {
      memberByNpa.set(m.memberNumber.trim().toLowerCase(), m);
    }
    if (m.email) {
      memberByEmail.set(m.email.trim().toLowerCase(), m);
    }
  }

  let created = 0;
  let updated = 0;
  let failed = 0;
  const errors: MemberCsvImportRowError[] = [];

  const rows = parsed.data;
  const isDryRun = !!options?.dryRun;

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2; // header is row 1
    const row = rows[i];
    if (!row) continue;

    const fullName = row.full_name?.trim();
    if (!fullName || fullName.length > 150) {
      failed++;
      errors.push({
        row: rowNum,
        column: "full_name",
        message: "Full name is required and cannot exceed 150 characters",
      });
      continue;
    }

    const rawStatus = (row.member_status || "").trim().toLowerCase();
    const statusParsed = memberStatusEnum.safeParse(rawStatus);
    if (!statusParsed.success) {
      failed++;
      errors.push({
        row: rowNum,
        column: "member_status",
        message: 'Member status must be either "active" or "inactive"',
      });
      continue;
    }
    const memberStatus = statusParsed.data;

    let inactiveReason: z.infer<typeof inactiveReasonEnum> | null = null;
    let inactiveAt: string | null = null;

    if (memberStatus === "inactive") {
      const rawReason = (row.inactive_reason || "").trim().toLowerCase();
      const reasonParsed = inactiveReasonEnum.safeParse(rawReason);
      if (!reasonParsed.success) {
        failed++;
        errors.push({
          row: rowNum,
          column: "inactive_reason",
          message:
            "Inactive members require a valid inactive_reason (rarely_active, resigned, age_limit, transferred_to_persis, moved_domicile, other)",
        });
        continue;
      }
      inactiveReason = reasonParsed.data;
      inactiveAt =
        normalizeDate(row.inactive_at) || format(new Date(), "yyyy-MM-dd");
    }

    let departmentId: string | null = null;
    const deptName = (row.department || "").trim();
    if (deptName) {
      const resolved = deptMap.get(deptName.toLowerCase());
      if (!resolved) {
        failed++;
        errors.push({
          row: rowNum,
          column: "department",
          message: `Department "${deptName}" not found`,
        });
        continue;
      }
      departmentId = resolved;
    }

    let positionId: string | null = null;
    const posName = (row.position || "").trim();
    if (posName) {
      const resolved = posMap.get(posName.toLowerCase());
      if (!resolved) {
        failed++;
        errors.push({
          row: rowNum,
          column: "position",
          message: `Position "${posName}" not found`,
        });
        continue;
      }
      positionId = resolved;
    }

    const npa = (row.npa || "").trim() || null;
    const phone = (row.phone || "").trim() || null;
    const email = (row.email || "").trim() || null;
    const address = (row.address || "").trim() || null;
    const joinedAt = normalizeDate(row.joined_at);
    const birthDate = normalizeDate(row.birth_date);
    const statusNotes = (row.status_notes || "").trim() || null;
    const notes = (row.notes || "").trim() || null;

    // Lookup existing member by NPA then Email
    let existing: Member | undefined;
    if (npa) {
      existing = memberByNpa.get(npa.toLowerCase());
    }
    if (!existing && email) {
      existing = memberByEmail.get(email.toLowerCase());
    }

    if (existing) {
      // Update
      if (!isDryRun) {
        const [upd] = await db
          .update(members)
          .set({
            fullName,
            memberNumber: npa ?? existing.memberNumber,
            phone: phone ?? existing.phone,
            email: email ?? existing.email,
            address: address ?? existing.address,
            departmentId: departmentId ?? existing.departmentId,
            positionId: positionId ?? existing.positionId,
            memberStatus,
            inactiveReason,
            inactiveAt,
            joinedAt: joinedAt ?? existing.joinedAt,
            birthDate: birthDate ?? existing.birthDate,
            statusNotes: statusNotes ?? existing.statusNotes,
            notes: notes ?? existing.notes,
            updatedAt: new Date(),
          })
          .where(eq(members.id, existing.id))
          .returning();

        if (upd) {
          if (upd.memberNumber) {
            memberByNpa.set(upd.memberNumber.toLowerCase(), upd);
          }
          if (upd.email) {
            memberByEmail.set(upd.email.toLowerCase(), upd);
          }
        }
      }
      updated++;
    } else {
      // Insert
      if (!isDryRun) {
        const [createdMember] = await db
          .insert(members)
          .values({
            fullName,
            memberNumber: npa,
            phone,
            email,
            address,
            departmentId,
            positionId,
            memberStatus,
            inactiveReason,
            inactiveAt,
            joinedAt,
            birthDate,
            statusNotes,
            notes,
          })
          .returning();

        if (createdMember) {
          if (createdMember.memberNumber) {
            memberByNpa.set(
              createdMember.memberNumber.toLowerCase(),
              createdMember,
            );
          }
          if (createdMember.email) {
            memberByEmail.set(createdMember.email.toLowerCase(), createdMember);
          }
        }
      }
      created++;
    }
  }

  return {
    totalRows: rows.length,
    created,
    updated,
    failed,
    errors,
  };
}

export async function exportMembersToCsv(
  filters?: GetMembersParams,
  options?: MemberCsvExportOptions,
): Promise<string> {
  await requirePermission(
    PERMISSIONS.ORGANIZATION_MEMBERS_EXPORT,
    options?.sessionOverride,
  );

  const membersList = await getMembers(filters, options?.sessionOverride);

  const exportRows = membersList.map((m, idx) => {
    let ageStatus = "Normal";
    if (m.isAgeLimitDue) {
      ageStatus = "Age Limit Due";
    }

    let accountStatus = "No Account";
    if (m.user) {
      accountStatus = m.user.isActive ? "Active" : "Inactive";
    }

    return {
      No: idx + 1,
      NPA: m.memberNumber || "",
      "Full Name": m.fullName,
      Phone: m.phone || "",
      Email: m.email || "",
      Address: m.address || "",
      "Joined Date": m.joinedAt || "",
      "Birth Date": m.birthDate || "",
      Age: m.age !== null ? m.age : "",
      "Age Status": ageStatus,
      Department: m.department?.name || "",
      Position: m.position?.name || "",
      "Member Status": m.memberStatus,
      "Inactive Reason": m.inactiveReason || "",
      "Inactive Date": m.inactiveAt || "",
      "Status Notes": m.statusNotes || "",
      "Account Login Status": accountStatus,
      Notes: m.notes || "",
    };
  });

  return Papa.unparse(exportRows, {
    columns: [...MEMBER_CSV_EXPORT_COLUMNS],
    header: true,
  });
}
