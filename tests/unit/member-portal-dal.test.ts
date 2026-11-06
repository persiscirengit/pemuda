import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { PERMISSIONS } from "@/lib/permissions";
import { UnauthenticatedError, UnauthorizedError } from "@/server/dal/auth";
import {
  getMyDashboardSummary,
  getMyFeeRecords,
  MemberNotLinkedError,
  updateMyProfile,
} from "@/server/dal/members/portal";

interface MockUser {
  id: string;
  memberId: string | null;
  name: string;
  email: string;
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
  birthDate: string | null;
  joinedAt: string | null;
  memberStatus: string;
}

interface MockDepartment {
  id: string;
  name: string;
}

interface MockPosition {
  id: string;
  name: string;
}

interface MockActivity {
  id: string;
  title: string;
  topic: string | null;
  description: string | null;
  activityDate: string;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  latitude: string | null;
  longitude: string | null;
  attendanceRadius: number;
  status: string;
  attendanceEnabled: boolean;
  attendanceOpenAt: Date | null;
  attendanceCloseAt: Date | null;
  attendanceToken: string | null;
}

interface MockAttendanceRecord {
  id: string;
  activityId: string;
  memberId: string;
  status: "present" | "permission" | "absent" | "need_verification";
  attendanceMethod: string;
  checkedInAt: Date | null;
  notes: string | null;
}

interface MockFeeRecord {
  id: string;
  memberId: string;
  year: number;
  month: number;
  amountIdr: number;
  status: "unpaid" | "paid" | "overdue" | "waived";
  paidAt: string | null;
  note: string | null;
}

interface MockNotification {
  id: string;
  userId: string | null;
  memberId: string | null;
  type: string;
  title: string;
  message: string;
  readAt: Date | null;
}

interface ChunkObject {
  name?: string;
  value?: unknown;
  queryChunks?: unknown[];
}

const { mockData } = vi.hoisted(() => ({
  mockData: {
    users: [] as MockUser[],
    members: [] as MockMember[],
    departments: [] as MockDepartment[],
    positions: [] as MockPosition[],
    activities: [] as MockActivity[],
    attendanceRecords: [] as MockAttendanceRecord[],
    memberFeeRecords: [] as MockFeeRecord[],
    notifications: [] as MockNotification[],
  },
}));

function flattenChunks(chunks: unknown[]): unknown[] {
  let res: unknown[] = [];
  for (const c of chunks) {
    const chunk = c as ChunkObject;
    if (chunk?.queryChunks) {
      res = res.concat(flattenChunks(chunk.queryChunks));
    } else {
      res.push(c);
    }
  }
  return res;
}

function getChunkValue(c: unknown): unknown {
  if (!c) return c;
  if (typeof c === "string") return c;
  const obj = c as ChunkObject;
  if (typeof obj.name === "string") return obj.name;
  if ("value" in obj) {
    if (Array.isArray(obj.value)) return obj.value[0];
    return obj.value;
  }
  return c;
}

vi.mock("@/db", () => {
  return {
    db: {
      select: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockImplementation((table) => {
          const tableName = table?.[Symbol.for("drizzle:Name")] || "";
          return {
            leftJoin: vi.fn().mockReturnThis(),
            innerJoin: vi.fn().mockReturnThis(),
            where: vi.fn().mockImplementation((condition) => {
              const flat = flattenChunks(
                (condition as ChunkObject)?.queryChunks || [],
              ).map(getChunkValue);

              if (tableName === "users") {
                const target = mockData.users.filter((u) => {
                  if (flat.includes(u.id)) return true;
                  return false;
                });
                const result = target.length > 0 ? target : mockData.users;
                return Object.assign(Promise.resolve(result), {
                  limit: (n: number) => Promise.resolve(result.slice(0, n)),
                });
              }

              if (tableName === "members") {
                const target = mockData.members.filter((m) => {
                  if (flat.includes(m.id)) return true;
                  return false;
                });
                const result = target.length > 0 ? target : mockData.members;
                return Object.assign(Promise.resolve(result), {
                  limit: (n: number) => Promise.resolve(result.slice(0, n)),
                });
              }

              if (tableName === "activities") {
                // If checking attendanceEnabled = true
                const isAttendanceQuery =
                  flat.includes("attendance_enabled") ||
                  flat.includes("attendance_open_at");
                const filtered = isAttendanceQuery
                  ? mockData.activities.filter((a) => a.attendanceEnabled)
                  : mockData.activities;
                return Object.assign(Promise.resolve(filtered), {
                  orderBy: vi.fn().mockReturnValue(Promise.resolve(filtered)),
                  limit: (n: number) => Promise.resolve(filtered.slice(0, n)),
                });
              }

              if (tableName === "attendance_records") {
                const memberIdMatch = mockData.members.find((m) =>
                  flat.includes(m.id),
                );
                const filtered = memberIdMatch
                  ? mockData.attendanceRecords.filter(
                      (a) => a.memberId === memberIdMatch.id,
                    )
                  : mockData.attendanceRecords;
                return Promise.resolve(filtered);
              }

              if (tableName === "member_fee_records") {
                const memberIdMatch = mockData.members.find((m) =>
                  flat.includes(m.id),
                );
                const filtered = memberIdMatch
                  ? mockData.memberFeeRecords.filter(
                      (f) => f.memberId === memberIdMatch.id,
                    )
                  : mockData.memberFeeRecords;
                return Object.assign(Promise.resolve(filtered), {
                  orderBy: vi.fn().mockImplementation(() => {
                    const sorted = [...filtered].sort((a, b) => {
                      if (b.year !== a.year) return b.year - a.year;
                      return b.month - a.month;
                    });
                    return Promise.resolve(sorted);
                  }),
                });
              }

              if (tableName === "notifications") {
                return Promise.resolve(mockData.notifications);
              }

              return Promise.resolve([]);
            }),
            orderBy: vi.fn().mockReturnThis(),
          };
        }),
      })),
      update: vi.fn().mockImplementation((table) => {
        const tableName = table?.[Symbol.for("drizzle:Name")] || "";
        return {
          set: vi.fn().mockImplementation((values) => ({
            where: vi.fn().mockImplementation((condition) => {
              const flat = flattenChunks(
                (condition as ChunkObject)?.queryChunks || [],
              ).map(getChunkValue);
              if (tableName === "members") {
                const target = mockData.members.find((m) =>
                  flat.includes(m.id),
                );
                if (target) {
                  Object.assign(target, values);
                  return Promise.resolve([target]);
                }
              }
              if (tableName === "notifications") {
                for (const n of mockData.notifications) {
                  Object.assign(n, values);
                }
                return Promise.resolve(mockData.notifications);
              }
              return Promise.resolve([]);
            }),
          })),
        };
      }),
      delete: vi.fn().mockImplementation((table) => {
        const tableName = table?.[Symbol.for("drizzle:Name")] || "";
        return {
          where: vi.fn().mockImplementation(() => {
            if (tableName === "notifications") {
              mockData.notifications = mockData.notifications.filter(
                (n) => n.type !== "profile_incomplete",
              );
              return Promise.resolve([]);
            }
            return Promise.resolve([]);
          }),
        };
      }),
      insert: vi.fn().mockImplementation((_table) => ({
        values: vi.fn().mockImplementation((val) => {
          return {
            returning: vi.fn().mockResolvedValue([val]),
          };
        }),
      })),
    },
  };
});

describe("Member Portal DAL (src/server/dal/members/portal.ts)", () => {
  const memberUserSession = {
    session: {
      id: "sess-1",
      userId: "user-mem-1",
      token: "tok-1",
      expiresAt: new Date(Date.now() + 86400000),
    },
    user: {
      id: "user-mem-1",
      name: "Salman Al-Farisi",
      email: "salman@pemuda.local",
      emailVerified: true,
      roles: [
        {
          name: "member",
          permissions: [
            PERMISSIONS.ACTIVITIES_CHECKIN_SELF,
            PERMISSIONS.FINANCE_FEES_SELF,
          ],
        },
      ],
    },
  };

  const unlinkedUserSession = {
    session: {
      id: "sess-2",
      userId: "user-orphan-1",
      token: "tok-2",
      expiresAt: new Date(Date.now() + 86400000),
    },
    user: {
      id: "user-orphan-1",
      name: "Unlinked Account",
      email: "unlinked@pemuda.local",
      emailVerified: true,
      roles: [{ name: "member", permissions: [PERMISSIONS.FINANCE_FEES_SELF] }],
    },
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-15T10:00:00.000Z"));

    mockData.users = [
      {
        id: "user-mem-1",
        memberId: "mem-1",
        name: "Salman Al-Farisi",
        email: "salman@pemuda.local",
      },
      {
        id: "user-orphan-1",
        memberId: null,
        name: "Unlinked Account",
        email: "unlinked@pemuda.local",
      },
    ];

    mockData.members = [
      {
        id: "mem-1",
        departmentId: "dept-1",
        positionId: "pos-1",
        fullName: "Salman Al-Farisi",
        memberNumber: "NPA-2026-001",
        phone: "08123456789",
        email: "salman@pemuda.local",
        address: "Jl. Cirengit No. 12",
        profilePhoto: "uploads/members/mem-1.webp",
        birthDate: "1998-05-14",
        joinedAt: "2020-01-01",
        memberStatus: "active",
      },
      {
        id: "mem-2",
        departmentId: "dept-2",
        positionId: "pos-2",
        fullName: "Other Member",
        memberNumber: "NPA-2026-002",
        phone: "08987654321",
        email: "other@pemuda.local",
        address: "Jl. Lain No. 99",
        profilePhoto: null,
        birthDate: "2000-01-01",
        joinedAt: "2021-01-01",
        memberStatus: "active",
      },
    ];

    mockData.departments = [{ id: "dept-1", name: "Kaderisasi" }];
    mockData.positions = [{ id: "pos-1", name: "Ketua Bidang" }];

    const now = new Date();
    mockData.activities = [
      {
        id: "act-open-1",
        title: "Kajian Rutin Malam Ahad",
        topic: "Tafsir Al-Quran",
        description: "Kajian mingguan",
        activityDate: now.toISOString().slice(0, 10),
        startTime: "19:30",
        endTime: "21:30",
        location: "Masjid Al-Ihsan",
        latitude: "-6.9147440",
        longitude: "107.6098100",
        attendanceRadius: 100,
        status: "scheduled",
        attendanceEnabled: true,
        attendanceOpenAt: new Date(Date.now() - 30 * 60000), // 30m ago
        attendanceCloseAt: new Date(Date.now() + 60 * 60000), // in 1h
        attendanceToken: "tok-open-1",
      },
      {
        id: "act-upcoming-1",
        title: "Bakti Sosial",
        topic: "Peduli Lingkungan",
        description: "Kegiatan bakti",
        activityDate: new Date(Date.now() + 3 * 86400000)
          .toISOString()
          .slice(0, 10),
        startTime: "08:00",
        endTime: "11:00",
        location: "Lapangan Cirengit",
        latitude: null,
        longitude: null,
        attendanceRadius: 100,
        status: "scheduled",
        attendanceEnabled: false,
        attendanceOpenAt: null,
        attendanceCloseAt: null,
        attendanceToken: null,
      },
    ];

    mockData.attendanceRecords = [
      {
        id: "att-1",
        activityId: "act-past-1",
        memberId: "mem-1",
        status: "present",
        attendanceMethod: "qr",
        checkedInAt: new Date(),
        notes: null,
      },
      {
        id: "att-2",
        activityId: "act-past-2",
        memberId: "mem-1",
        status: "permission",
        attendanceMethod: "manual",
        checkedInAt: null,
        notes: "Sakit",
      },
      {
        id: "att-3",
        activityId: "act-past-3",
        memberId: "mem-1",
        status: "absent",
        attendanceMethod: "manual",
        checkedInAt: null,
        notes: null,
      },
      {
        id: "att-4",
        activityId: "act-past-1",
        memberId: "mem-2", // other member
        status: "present",
        attendanceMethod: "qr",
        checkedInAt: new Date(),
        notes: null,
      },
    ];

    mockData.memberFeeRecords = [
      {
        id: "fee-1",
        memberId: "mem-1",
        year: 2026,
        month: 1,
        amountIdr: 20000,
        status: "paid",
        paidAt: "2026-01-15",
        note: null,
      },
      {
        id: "fee-2",
        memberId: "mem-1",
        year: 2026,
        month: 2,
        amountIdr: 20000,
        status: "unpaid",
        paidAt: null,
        note: null,
      },
      {
        id: "fee-3",
        memberId: "mem-1",
        year: 2026,
        month: 3,
        amountIdr: 20000,
        status: "unpaid",
        paidAt: null,
        note: null,
      },
      {
        id: "fee-4",
        memberId: "mem-2", // other member
        year: 2026,
        month: 3,
        amountIdr: 50000,
        status: "unpaid",
        paidAt: null,
        note: null,
      },
    ];

    mockData.notifications = [
      {
        id: "notif-1",
        userId: "user-mem-1",
        memberId: "mem-1",
        type: "profile_incomplete",
        title: "Lengkapi Profil Anda",
        message: "Nomor WhatsApp belum terdaftar",
        readAt: null,
      },
    ];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("enforces 'server-only' import in src/server/dal/members/portal.ts", () => {
    const filePath = path.resolve(
      process.cwd(),
      "src/server/dal/members/portal.ts",
    );
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toMatch(/import\s+['"]server-only['"]/);
  });

  describe("getMyDashboardSummary", () => {
    it("throws UnauthenticatedError when user session is missing", async () => {
      await expect(getMyDashboardSummary(null)).rejects.toThrow(
        UnauthenticatedError,
      );
    });

    it("throws MemberNotLinkedError when user account has no linked memberId", async () => {
      await expect(getMyDashboardSummary(unlinkedUserSession)).rejects.toThrow(
        MemberNotLinkedError,
      );
    });

    it("returns summary filtered strictly by authenticated memberId", async () => {
      const summary = await getMyDashboardSummary(memberUserSession);

      expect(summary.member).toBeDefined();
      expect(summary.member.id).toBe("mem-1");
      expect(summary.member.fullName).toBe("Salman Al-Farisi");

      // Open activities
      expect(summary.openActivities).toHaveLength(1);
      expect(summary.openActivities[0]?.id).toBe("act-open-1");

      // Upcoming activities
      expect(summary.upcomingActivities.length).toBeGreaterThanOrEqual(1);

      // Attendance stats (present: 1, excused: 1, absent: 1, total: 3, percentage: 33%)
      expect(summary.attendanceStats.present).toBe(1);
      expect(summary.attendanceStats.excused).toBe(1);
      expect(summary.attendanceStats.absent).toBe(1);
      expect(summary.attendanceStats.total).toBe(3);
      expect(summary.attendanceStats.percentage).toBe(33);

      // Outstanding dues balance (unpaid 20,000 + overdue 20,000 = 40,000)
      expect(summary.feeSummary.outstandingBalance).toBe(40000);
      expect(summary.feeSummary.hasOverdue).toBe(true);
      expect(summary.feeSummary.unpaidCount).toBe(1);
      expect(summary.feeSummary.overdueCount).toBe(1);
    });
  });

  describe("getMyFeeRecords", () => {
    it("requires PERMISSIONS.FINANCE_FEES_SELF and throws UnauthorizedError if missing", async () => {
      const unauthorizedSession = {
        session: { ...memberUserSession.session },
        user: {
          ...memberUserSession.user,
          roles: [{ name: "guest", permissions: [] }],
        },
      };

      await expect(getMyFeeRecords(unauthorizedSession)).rejects.toThrow(
        UnauthorizedError,
      );
    });

    it("returns member's fee records ordered by year and month desc", async () => {
      const result = await getMyFeeRecords(memberUserSession);

      expect(result.records).toHaveLength(3);
      // All records belong to mem-1
      for (const rec of result.records) {
        expect(rec.memberId).toBe("mem-1");
      }
      // Ordered year/month desc
      expect(result.records[0]?.month).toBe(3);
      expect(result.records[1]?.month).toBe(2);
      expect(result.records[2]?.month).toBe(1);
      expect(result.totalOutstanding).toBe(40000);
      expect(result.hasOverdue).toBe(true);
    });
  });

  describe("updateMyProfile", () => {
    it("updates contact details and clears active profile_incomplete notifications", async () => {
      expect(mockData.notifications).toHaveLength(1);

      const updated = await updateMyProfile(
        {
          phone: "08999999999",
          address: "Jl. Cirengit Baru No. 50",
          birthDate: "1998-05-14",
        },
        memberUserSession,
      );

      expect(updated.phone).toBe("08999999999");
      expect(updated.address).toBe("Jl. Cirengit Baru No. 50");

      // Notification must be cleared
      expect(mockData.notifications).toHaveLength(0);
    });

    it("throws MemberNotLinkedError for unlinked user", async () => {
      await expect(
        updateMyProfile({ phone: "0812345" }, unlinkedUserSession),
      ).rejects.toThrow(MemberNotLinkedError);
    });
  });
});
