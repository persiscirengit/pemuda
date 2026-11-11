import { getTableName } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PERMISSIONS } from "@/lib/permissions";
import type { UserSession } from "@/server/dal/auth";

vi.mock("server-only", () => ({}));

interface MockActivity {
  id: string;
  title: string;
  activityDate: string;
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
  attendanceMethod: "qr" | "link" | "manual";
  checkedInAt: Date | null;
  latitude: string | null;
  longitude: string | null;
  distanceFromActivity: string | null;
  locationAccuracy: string | null;
  verificationStatus: "valid" | "need_verification" | "rejected";
  notes: string | null;
}

interface MockUser {
  id: string;
  memberId: string | null;
}

const { mockActivities, mockAttendanceRecords, mockUsers } = vi.hoisted(() => ({
  mockActivities: [] as MockActivity[],
  mockAttendanceRecords: [] as MockAttendanceRecord[],
  mockUsers: [] as MockUser[],
}));

function extractTableName(table: unknown): string {
  try {
    return getTableName(table as Parameters<typeof getTableName>[0]);
  } catch {
    return "";
  }
}

vi.mock("@/db", () => {
  return {
    db: {
      select: () => ({
        from: (table: unknown) => {
          const tableName = extractTableName(table);
          return {
            where: (_cond: unknown) => {
              return {
                limit: (_limit: number) => {
                  if (tableName === "activities") {
                    return Promise.resolve(mockActivities);
                  }
                  if (tableName === "attendance_records") {
                    return Promise.resolve(mockAttendanceRecords);
                  }
                  if (tableName === "user" || tableName === "users") {
                    return Promise.resolve(mockUsers);
                  }
                  return Promise.resolve([]);
                },
              };
            },
          };
        },
      }),
      update: (table: unknown) => {
        const tableName = extractTableName(table);
        return {
          set: (vals: Record<string, unknown>) => {
            return {
              where: (_cond: unknown) => {
                if (
                  tableName === "attendance_records" &&
                  mockAttendanceRecords.length > 0
                ) {
                  Object.assign(mockAttendanceRecords[0], vals);
                }
                return {
                  returning: () => {
                    return Promise.resolve(
                      mockAttendanceRecords.length > 0
                        ? [mockAttendanceRecords[0]]
                        : [],
                    );
                  },
                };
              },
            };
          },
        };
      },
      insert: (table: unknown) => {
        const tableName = extractTableName(table);
        return {
          values: (vals: Record<string, unknown>) => {
            if (tableName === "attendance_records") {
              mockAttendanceRecords.push(vals as unknown as MockAttendanceRecord);
            }
            return {
              returning: () => {
                return Promise.resolve([vals]);
              },
            };
          },
        };
      },
    },
  };
});

describe("Member Absence / Leave Request DAL (src/server/dal/activities/checkin.ts)", () => {
  const mockMemberSession: UserSession = {
    session: {
      id: "session-1",
      userId: "user-1",
      token: "tok-1",
      expiresAt: new Date(Date.now() + 86400000),
    },
    user: {
      id: "user-1",
      name: "Ahmad Member",
      email: "ahmad@persis.org",
      emailVerified: true,
      roles: [
        {
          name: "member",
          permissions: [PERMISSIONS.ACTIVITIES_CHECKIN_SELF],
        },
      ],
    },
  };

  beforeEach(() => {
    mockActivities.length = 0;
    mockAttendanceRecords.length = 0;
    mockUsers.length = 0;

    mockUsers.push({
      id: "user-1",
      memberId: "member-1",
    });

    const now = new Date();
    mockActivities.push({
      id: "act-1",
      title: "Kajian Pekanan Pemuda Persis",
      activityDate: "2026-11-15",
      attendanceEnabled: true,
      attendanceOpenAt: new Date(now.getTime() - 3600000),
      attendanceCloseAt: new Date(now.getTime() + 7200000),
      attendanceToken: "valid-token-12345",
    });
  });

  it("rejects absence submission if reason is empty or whitespace", async () => {
    const { submitMemberPermission } = await import(
      "@/server/dal/activities/checkin"
    );

    await expect(
      submitMemberPermission(
        "valid-token-12345",
        { reason: "   " },
        mockMemberSession,
      ),
    ).rejects.toThrow(/reason is required/i);
  });

  it("rejects absence submission if reason exceeds 500 characters", async () => {
    const { submitMemberPermission } = await import(
      "@/server/dal/activities/checkin"
    );

    const longReason = "A".repeat(501);

    await expect(
      submitMemberPermission(
        "valid-token-12345",
        { reason: longReason },
        mockMemberSession,
      ),
    ).rejects.toThrow(/cannot exceed 500 characters/i);
  });

  it("rejects absence submission if user is unlinked", async () => {
    const { submitMemberPermission } = await import(
      "@/server/dal/activities/checkin"
    );

    mockUsers[0].memberId = null;

    await expect(
      submitMemberPermission(
        "valid-token-12345",
        { reason: "Sakit flu dan demam" },
        mockMemberSession,
      ),
    ).rejects.toThrow(/not linked to any member/i);
  });

  it("rejects absence submission if attendance window is closed", async () => {
    const { submitMemberPermission } = await import(
      "@/server/dal/activities/checkin"
    );

    mockActivities[0].attendanceCloseAt = new Date(Date.now() - 3600000);

    await expect(
      submitMemberPermission(
        "valid-token-12345",
        { reason: "Sakit flu dan demam" },
        mockMemberSession,
      ),
    ).rejects.toThrow(/closed/i);
  });

  it("submits valid absence request and stores reason without GPS coordinates", async () => {
    const { submitMemberPermission } = await import(
      "@/server/dal/activities/checkin"
    );

    const record = await submitMemberPermission(
      "valid-token-12345",
      { reason: "Ada tugas kantor mendadak di luar kota" },
      mockMemberSession,
    );

    expect(record.status).toBe("permission");
    expect(record.verificationStatus).toBe("valid");
    expect(record.notes).toBe("Ada tugas kantor mendadak di luar kota");
    expect(record.latitude).toBeNull();
    expect(record.longitude).toBeNull();
  });
});
