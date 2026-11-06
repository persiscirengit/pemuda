import { getTableName } from "drizzle-orm";
import Papa from "papaparse";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { PERMISSIONS } from "@/lib/permissions";
import { UnauthorizedError } from "@/server/dal/auth";

interface MockDept {
  id: string;
  name: string;
}

interface MockPos {
  id: string;
  name: string;
}

interface MockMember {
  id: string;
  departmentId: string | null;
  positionId: string | null;
  fullName: string;
  memberNumber: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  profilePhoto: string | null;
  joinedAt: string | null;
  birthDate: string | null;
  memberStatus: "active" | "inactive" | "alumni" | "moved";
  inactiveReason: string | null;
  inactiveAt: string | null;
  statusNotes: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const { mockData } = vi.hoisted(() => ({
  mockData: {
    departments: [] as MockDept[],
    positions: [] as MockPos[],
    members: [] as MockMember[],
  },
}));

vi.mock("@/db", () => {
  return {
    db: {
      select: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockImplementation((table) => {
          let items: unknown[] = [];
          const tableName = table ? getTableName(table) : "";
          if (tableName === "departments") {
            items = mockData.departments;
          } else if (tableName === "positions") {
            items = mockData.positions;
          } else {
            items = mockData.members;
          }
          const p = Promise.resolve(items);
          return Object.assign(p, {
            where: vi.fn().mockImplementation((_cond) => {
              return Promise.resolve(items);
            }),
            leftJoin: vi.fn().mockReturnThis(),
            orderBy: () => Promise.resolve(items),
          });
        }),
      })),
      insert: vi.fn().mockImplementation((_table) => ({
        values: vi.fn().mockImplementation((vals) => {
          const inserted = {
            id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            ...vals,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          mockData.members.push(inserted);
          const p = Promise.resolve([inserted]);
          return Object.assign(p, {
            returning: vi.fn().mockResolvedValue([inserted]),
          });
        }),
      })),
      update: vi.fn().mockImplementation((_table) => ({
        set: vi.fn().mockImplementation((values) => ({
          where: vi.fn().mockImplementation((_cond) => {
            const target = mockData.members[0];
            if (target) {
              Object.assign(target, values, { updatedAt: new Date() });
            }
            const p = Promise.resolve([target]);
            return Object.assign(p, {
              returning: vi.fn().mockResolvedValue([target]),
            });
          }),
        })),
      })),
    },
  };
});

import {
  generateMemberCsvTemplate,
  processMemberCsvImport,
} from "@/server/dal/organization/member-csv";

describe("Member CSV Import Service", () => {
  const adminSession = {
    session: {
      id: "s-admin",
      userId: "u-admin",
      token: "tok",
      expiresAt: new Date(),
    },
    user: {
      id: "u-admin",
      name: "Admin User",
      email: "admin@pemuda.local",
      emailVerified: true,
      roles: [
        {
          name: "admin",
          permissions: [
            PERMISSIONS.ORGANIZATION_MEMBERS_IMPORT,
            PERMISSIONS.ORGANIZATION_MEMBERS_EXPORT,
            PERMISSIONS.ORGANIZATION_MEMBERS_READ,
          ],
        },
      ],
    },
  };

  const unauthorizedSession = {
    session: {
      id: "s-user",
      userId: "u-user",
      token: "tok",
      expiresAt: new Date(),
    },
    user: {
      id: "u-user",
      name: "Normal User",
      email: "user@pemuda.local",
      emailVerified: true,
      roles: [
        {
          name: "member",
          permissions: [PERMISSIONS.ORGANIZATION_MEMBERS_READ],
        },
      ],
    },
  };

  beforeEach(() => {
    mockData.departments = [
      { id: "dept-1", name: "Kaderisasi" },
      { id: "dept-2", name: "Dakwah" },
    ];
    mockData.positions = [
      { id: "pos-1", name: "Ketua" },
      { id: "pos-2", name: "Sekretaris" },
    ];
    mockData.members = [
      {
        id: "m-existing-1",
        departmentId: "dept-1",
        positionId: "pos-1",
        fullName: "Existing Member",
        memberNumber: "10.05.001",
        phone: "+628123456780",
        email: "existing@pemuda.local",
        address: "Cirengit No 1",
        profilePhoto: null,
        joinedAt: "2024-01-01",
        birthDate: "1998-05-10",
        memberStatus: "active",
        inactiveReason: null,
        inactiveAt: null,
        statusNotes: null,
        notes: "Old notes",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
  });

  describe("Permission & Structural Validation", () => {
    it("enforces requirePermission(PERMISSIONS.ORGANIZATION_MEMBERS_IMPORT)", async () => {
      await expect(
        processMemberCsvImport("npa,full_name", {
          sessionOverride: unauthorizedSession,
        }),
      ).rejects.toThrow(UnauthorizedError);
    });

    it("rejects files exceeding 5MB limit", async () => {
      const hugeContent = "a".repeat(5 * 1024 * 1024 + 10);
      await expect(
        processMemberCsvImport(hugeContent, {
          sessionOverride: adminSession,
        }),
      ).rejects.toThrow(/exceeds 5MB/i);
    });

    it("rejects invalid CSV header structure missing required columns", async () => {
      const invalidCsv = "first_name,last_name,phone\nJohn,Doe,+628123";
      const result = await processMemberCsvImport(invalidCsv, {
        sessionOverride: adminSession,
      });

      expect(result.failed).toBeGreaterThan(0);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]?.message).toMatch(/header|missing/i);
    });
  });

  describe("Template Generation", () => {
    it("generates 14 canonical columns in the CSV template", () => {
      const template = generateMemberCsvTemplate();
      const parsed = Papa.parse(template, { header: true });
      const headers = parsed.meta.fields || [];

      expect(headers).toEqual([
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
      ]);
    });
  });

  describe("Bulk Import Processing & Upsert", () => {
    it("creates new member when neither NPA nor email matches existing record", async () => {
      const csv = [
        "npa,full_name,phone,email,address,joined_at,birth_date,department,position,member_status,inactive_reason,inactive_at,status_notes,notes",
        "10.05.002,Ahmad Baru,+628123456789,ahmad.baru@pemuda.local,Jl. Cirengit,2024-01-01,2000-01-01,Kaderisasi,Ketua,active,,,,,Baru bergabung",
      ].join("\n");

      const result = await processMemberCsvImport(csv, {
        sessionOverride: adminSession,
      });

      expect(result.created).toBe(1);
      expect(result.updated).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it("updates existing member when NPA matches", async () => {
      const csv = [
        "npa,full_name,phone,email,address,joined_at,birth_date,department,position,member_status,inactive_reason,inactive_at,status_notes,notes",
        "10.05.001,Updated Name,+628123456780,existing@pemuda.local,New Address,2024-01-01,1998-05-10,Kaderisasi,Ketua,active,,,,,Updated notes",
      ].join("\n");

      const result = await processMemberCsvImport(csv, {
        sessionOverride: adminSession,
      });

      expect(result.created).toBe(0);
      expect(result.updated).toBe(1);
      expect(result.failed).toBe(0);
    });

    it("updates existing member by email fallback when NPA is empty", async () => {
      const csv = [
        "npa,full_name,phone,email,address,joined_at,birth_date,department,position,member_status,inactive_reason,inactive_at,status_notes,notes",
        ",Existing Member,+628123456780,existing@pemuda.local,New Address,2024-01-01,1998-05-10,Kaderisasi,Ketua,active,,,,,Updated notes",
      ].join("\n");

      const result = await processMemberCsvImport(csv, {
        sessionOverride: adminSession,
      });

      expect(result.updated).toBe(1);
      expect(result.failed).toBe(0);
    });

    it("resolves Department and Position case-insensitively and fails row if invalid", async () => {
      const csv = [
        "npa,full_name,phone,email,address,joined_at,birth_date,department,position,member_status,inactive_reason,inactive_at,status_notes,notes",
        "10.05.003,Valid Member,+628111,valid@pemuda.local,,,,kaderisasi,ketua,active,,,,",
        "10.05.004,Invalid Dept Member,+628222,invalid@pemuda.local,,,,NonExistentDept,Ketua,active,,,,",
      ].join("\n");

      const result = await processMemberCsvImport(csv, {
        sessionOverride: adminSession,
      });

      expect(result.created).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            row: 3,
            message: expect.stringMatching(/Department .* not found/i),
          }),
        ]),
      );
    });

    it("validates inactive_reason when member_status is inactive", async () => {
      const csv = [
        "npa,full_name,phone,email,address,joined_at,birth_date,department,position,member_status,inactive_reason,inactive_at,status_notes,notes",
        "10.05.005,Inactive No Reason,+628333,inactive1@pemuda.local,,,,,,inactive,,2025-01-01,,",
        "10.05.006,Inactive Invalid Reason,+628444,inactive2@pemuda.local,,,,,,inactive,not_a_valid_reason,2025-01-01,,",
        "10.05.007,Inactive Valid Reason,+628555,inactive3@pemuda.local,,,,,,inactive,age_limit,2025-01-01,,",
      ].join("\n");

      const result = await processMemberCsvImport(csv, {
        sessionOverride: adminSession,
      });

      expect(result.created).toBe(1);
      expect(result.failed).toBe(2);
      expect(result.errors).toHaveLength(2);
    });

    it("supports dryRun option without mutating database", async () => {
      const initialMemberCount = mockData.members.length;
      const csv = [
        "npa,full_name,phone,email,address,joined_at,birth_date,department,position,member_status,inactive_reason,inactive_at,status_notes,notes",
        "10.05.099,Dry Run Member,+628999,dryrun@pemuda.local,,,,,,active,,,,",
      ].join("\n");

      const result = await processMemberCsvImport(csv, {
        dryRun: true,
        sessionOverride: adminSession,
      });

      expect(result.created).toBe(1);
      expect(result.failed).toBe(0);
      expect(mockData.members.length).toBe(initialMemberCount);
    });
  });
});
