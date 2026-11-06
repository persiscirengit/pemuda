import Papa from "papaparse";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { PERMISSIONS } from "@/lib/permissions";
import { UnauthorizedError } from "@/server/dal/auth";

interface MockExportMember {
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
  department?: { id: string; name: string } | null;
  position?: { id: string; name: string } | null;
  user?: {
    id: string;
    email: string;
    username: string | null;
    isActive: boolean;
  } | null;
  age: number | null;
  isAgeLimitDue: boolean;
}

const { mockExportMembers } = vi.hoisted(() => ({
  mockExportMembers: {
    items: [] as MockExportMember[],
  },
}));

vi.mock("@/server/dal/organization/members", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/server/dal/organization/members")>();
  return {
    ...actual,
    getMembers: vi.fn().mockImplementation((filters) => {
      let result = [...mockExportMembers.items];
      if (filters?.departmentId) {
        result = result.filter((m) => m.departmentId === filters.departmentId);
      }
      if (filters?.memberStatus) {
        result = result.filter((m) => m.memberStatus === filters.memberStatus);
      }
      if (filters?.search) {
        const q = filters.search.toLowerCase();
        result = result.filter(
          (m) =>
            m.fullName.toLowerCase().includes(q) ||
            m.memberNumber?.toLowerCase().includes(q),
        );
      }
      return Promise.resolve(result);
    }),
  };
});

import { exportMembersToCsv } from "@/server/dal/organization/member-csv";

describe("Member CSV Export Service", () => {
  const exportSession = {
    session: {
      id: "s-exp",
      userId: "u-exp",
      token: "tok",
      expiresAt: new Date(),
    },
    user: {
      id: "u-exp",
      name: "Exporter",
      email: "exporter@pemuda.local",
      emailVerified: true,
      roles: [
        {
          name: "exporter",
          permissions: [PERMISSIONS.ORGANIZATION_MEMBERS_EXPORT],
        },
      ],
    },
  };

  const unauthorizedSession = {
    session: {
      id: "s-unauth",
      userId: "u-unauth",
      token: "tok",
      expiresAt: new Date(),
    },
    user: {
      id: "u-unauth",
      name: "No Perms",
      email: "noperms@pemuda.local",
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
    mockExportMembers.items = [
      {
        id: "m-1",
        departmentId: "dept-1",
        positionId: "pos-1",
        fullName: "Ahmad Fauzi",
        memberNumber: "10.05.001",
        phone: "+628123456789",
        email: "ahmad@pemuda.local",
        address: "Jl. Cirengit No. 1",
        profilePhoto: null,
        joinedAt: "2020-01-01",
        birthDate: "2000-01-01",
        memberStatus: "active",
        inactiveReason: null,
        inactiveAt: null,
        statusNotes: null,
        notes: "Regular notes",
        createdAt: new Date(),
        updatedAt: new Date(),
        department: { id: "dept-1", name: "Kaderisasi" },
        position: { id: "pos-1", name: "Ketua" },
        user: {
          id: "u-1",
          email: "ahmad@pemuda.local",
          username: "ahmadfauzi",
          isActive: true,
        },
        age: 26,
        isAgeLimitDue: false,
      },
      {
        id: "m-2",
        departmentId: "dept-2",
        positionId: "pos-2",
        fullName: "Senior Member",
        memberNumber: "10.05.002",
        phone: "+628987654321",
        email: "senior@pemuda.local",
        address: "Jl. Cirengit No. 2",
        profilePhoto: null,
        joinedAt: "2010-01-01",
        birthDate: "1980-01-01",
        memberStatus: "active",
        inactiveReason: null,
        inactiveAt: null,
        statusNotes: "Over age threshold",
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        department: { id: "dept-2", name: "Dakwah" },
        position: { id: "pos-2", name: "Anggota" },
        user: null,
        age: 46,
        isAgeLimitDue: true,
      },
    ];
  });

  describe("Permission Verification", () => {
    it("enforces requirePermission(PERMISSIONS.ORGANIZATION_MEMBERS_EXPORT)", async () => {
      await expect(
        exportMembersToCsv({}, { sessionOverride: unauthorizedSession }),
      ).rejects.toThrow(UnauthorizedError);
    });
  });

  describe("18-Column CSV Output & Mapping", () => {
    it("generates 18 canonical export columns and maps records correctly", async () => {
      const csv = await exportMembersToCsv(
        {},
        { sessionOverride: exportSession },
      );
      const parsed = Papa.parse(csv, { header: true });
      const headers = parsed.meta.fields || [];

      expect(headers).toEqual([
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
      ]);

      const rows = parsed.data as Array<Record<string, string>>;
      expect(rows.length).toBe(2);

      // Row 1 assertions
      expect(rows[0]?.NPA).toBe("10.05.001");
      expect(rows[0]?.["Full Name"]).toBe("Ahmad Fauzi");
      expect(rows[0]?.Department).toBe("Kaderisasi");
      expect(rows[0]?.Position).toBe("Ketua");
      expect(rows[0]?.["Account Login Status"]).toBe("Active");

      // Row 2 assertions (Senior Member over 41)
      expect(rows[1]?.NPA).toBe("10.05.002");
      expect(rows[1]?.["Full Name"]).toBe("Senior Member");
      expect(rows[1]?.["Age Status"]).toBe("Age Limit Due");
      expect(rows[1]?.["Account Login Status"]).toBe("No Account");
    });

    it("respects filter parameters for department and status", async () => {
      const csvDept1 = await exportMembersToCsv(
        { departmentId: "dept-1" },
        { sessionOverride: exportSession },
      );
      const linesDept1 = csvDept1.trim().split("\n");
      expect(linesDept1.length).toBe(2); // header + 1 row
      expect(linesDept1[1]).toContain("Ahmad Fauzi");
      expect(linesDept1[1]).not.toContain("Senior Member");
    });
  });
});
