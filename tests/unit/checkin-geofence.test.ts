import fs from "node:fs";
import path from "node:path";
import { getTableName } from "drizzle-orm";
import { getDistance } from "geolib";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PERMISSIONS } from "@/lib/permissions";
import type { UserSession } from "@/server/dal/auth";

vi.mock("server-only", () => ({}));

interface MockActivity {
  id: string;
  title: string;
  activityDate: string;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  latitude: string | null;
  longitude: string | null;
  attendanceRadius: number;
  attendanceEnabled: boolean;
  attendanceOpenAt: Date | null;
  attendanceCloseAt: Date | null;
  attendanceToken: string | null;
  status: string;
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
                if (tableName === "activities" && mockActivities[0]) {
                  Object.assign(mockActivities[0], vals);
                }
                if (
                  tableName === "attendance_records" &&
                  mockAttendanceRecords[0]
                ) {
                  Object.assign(mockAttendanceRecords[0], vals);
                }
                return {
                  returning: () => {
                    return Promise.resolve(
                      mockAttendanceRecords[0]
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
              mockAttendanceRecords.push(
                vals as unknown as MockAttendanceRecord,
              );
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

describe("Geofence Check-In DAL (src/server/dal/activities/checkin.ts)", () => {
  const venueCoords = {
    latitude: -6.917464,
    longitude: 107.619122,
  };

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

  const mockAdminSession: UserSession = {
    session: {
      id: "session-admin",
      userId: "user-admin",
      token: "tok-admin",
      expiresAt: new Date(Date.now() + 86400000),
    },
    user: {
      id: "user-admin",
      name: "Admin User",
      email: "admin@persis.org",
      emailVerified: true,
      roles: [
        {
          name: "super_admin",
          permissions: Object.values(PERMISSIONS),
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
      startTime: "09:00",
      endTime: "11:30",
      location: "Masjid Al-Jihad Cirengit",
      latitude: String(venueCoords.latitude),
      longitude: String(venueCoords.longitude),
      attendanceRadius: 100,
      attendanceEnabled: true,
      attendanceOpenAt: new Date(now.getTime() - 3600000), // 1 hour ago
      attendanceCloseAt: new Date(now.getTime() + 7200000), // in 2 hours
      attendanceToken: "valid-token-12345",
      status: "scheduled",
    });
  });

  it("enforces 'server-only' import at the top of checkin DAL", () => {
    const filePath = path.resolve(
      __dirname,
      "../../src/server/dal/activities/checkin.ts",
    );
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content.startsWith('import "server-only";')).toBe(true);
  });

  it("rejects check-in if user lacks ACTIVITIES_CHECKIN_SELF permission", async () => {
    const { submitMemberCheckIn } = await import(
      "@/server/dal/activities/checkin"
    );

    const unauthorizedSession: UserSession = {
      ...mockMemberSession,
      user: {
        ...mockMemberSession.user,
        roles: [{ name: "guest", permissions: [] }],
      },
    };

    await expect(
      submitMemberCheckIn(
        "valid-token-12345",
        { latitude: -6.917, longitude: 107.619 },
        unauthorizedSession,
      ),
    ).rejects.toThrow(/Unauthorized/i);
  });

  it("rejects check-in if user account is not linked to any member", async () => {
    const { submitMemberCheckIn } = await import(
      "@/server/dal/activities/checkin"
    );

    const user = mockUsers[0];
    if (user) {
      user.memberId = null;
    }

    await expect(
      submitMemberCheckIn(
        "valid-token-12345",
        { latitude: -6.917, longitude: 107.619 },
        mockMemberSession,
      ),
    ).rejects.toThrow(/not linked to any member/i);
  });

  it("calculates geolib distance correctly and assigns 'present' within radius", async () => {
    const { submitMemberCheckIn } = await import(
      "@/server/dal/activities/checkin"
    );

    // Coordinates ~25m from venue
    const closeCoords = {
      latitude: -6.9176,
      longitude: 107.6192,
    };
    const distance = getDistance(closeCoords, venueCoords);
    expect(distance).toBeLessThanOrEqual(100);

    const result = await submitMemberCheckIn(
      "valid-token-12345",
      {
        latitude: closeCoords.latitude,
        longitude: closeCoords.longitude,
        locationAccuracy: 10.5,
      },
      mockMemberSession,
    );

    expect(result.status).toBe("present");
    expect(result.verificationStatus).toBe("valid");
    expect(result.distance).toBe(Number(distance.toFixed(2)));
    expect(result.activityTitle).toBe("Kajian Pekanan Pemuda Persis");
  });

  it("assigns 'need_verification' when member coordinates exceed radius", async () => {
    const { submitMemberCheckIn } = await import(
      "@/server/dal/activities/checkin"
    );

    // Coordinates ~1.4km from venue
    const farCoords = {
      latitude: -6.925,
      longitude: 107.63,
    };
    const distance = getDistance(farCoords, venueCoords);
    expect(distance).toBeGreaterThan(100);

    const result = await submitMemberCheckIn(
      "valid-token-12345",
      {
        latitude: farCoords.latitude,
        longitude: farCoords.longitude,
        locationAccuracy: 20,
      },
      mockMemberSession,
    );

    expect(result.status).toBe("need_verification");
    expect(result.verificationStatus).toBe("need_verification");
    expect(result.distance).toBe(Number(distance.toFixed(2)));
  });

  it("rejects check-in when attendance window is not yet open", async () => {
    const { submitMemberCheckIn } = await import(
      "@/server/dal/activities/checkin"
    );

    const act = mockActivities[0];
    if (act) {
      act.attendanceOpenAt = new Date(Date.now() + 3600000); // 1 hour in future
    }

    await expect(
      submitMemberCheckIn(
        "valid-token-12345",
        { latitude: venueCoords.latitude, longitude: venueCoords.longitude },
        mockMemberSession,
      ),
    ).rejects.toThrow(/not yet open/i);
  });

  it("rejects check-in when attendance window has closed", async () => {
    const { submitMemberCheckIn } = await import(
      "@/server/dal/activities/checkin"
    );

    const act = mockActivities[0];
    if (act) {
      act.attendanceCloseAt = new Date(Date.now() - 3600000); // 1 hour in past
    }

    await expect(
      submitMemberCheckIn(
        "valid-token-12345",
        { latitude: venueCoords.latitude, longitude: venueCoords.longitude },
        mockMemberSession,
      ),
    ).rejects.toThrow(/closed/i);
  });

  it("allows re-check-in when previous record was 'absent' or 'need_verification', but rejects when 'present'", async () => {
    const { submitMemberCheckIn } = await import(
      "@/server/dal/activities/checkin"
    );

    // Initial pre-synced record is absent
    mockAttendanceRecords.push({
      id: "rec-1",
      activityId: "act-1",
      memberId: "member-1",
      status: "absent",
      attendanceMethod: "manual",
      checkedInAt: null,
      latitude: null,
      longitude: null,
      distanceFromActivity: null,
      locationAccuracy: null,
      verificationStatus: "need_verification",
      notes: null,
    });

    // 1. Can check in from absent -> present
    const updated = await submitMemberCheckIn(
      "valid-token-12345",
      { latitude: venueCoords.latitude, longitude: venueCoords.longitude },
      mockMemberSession,
    );
    expect(updated.status).toBe("present");

    // 2. Reject if already present
    const rec = mockAttendanceRecords[0];
    if (rec) {
      rec.status = "present";
    }
    await expect(
      submitMemberCheckIn(
        "valid-token-12345",
        { latitude: venueCoords.latitude, longitude: venueCoords.longitude },
        mockMemberSession,
      ),
    ).rejects.toThrow(/already been recorded/i);
  });

  it("allows regenerating attendance token with ACTIVITIES_EVENTS_UPDATE permission", async () => {
    const { regenerateAttendanceToken } = await import(
      "@/server/dal/activities/checkin"
    );

    const result = await regenerateAttendanceToken("act-1", mockAdminSession);
    expect(result.attendanceToken).toHaveLength(64);
    expect(mockActivities[0]?.attendanceToken).toBe(result.attendanceToken);
  });
});
