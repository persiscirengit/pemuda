import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { PERMISSIONS } from "@/lib/permissions";
import { UnauthenticatedError, UnauthorizedError } from "@/server/dal/auth";
import { createNotification } from "@/server/dal/notifications/inbox";
import {
  getMyNotificationPreferences,
  updateMyNotificationPreferences,
} from "@/server/dal/notifications/preferences";

interface MockPreference {
  id: string;
  userId: string;
  memberId: string | null;
  category: string;
  inAppEnabled: boolean;
  pushEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface MockNotificationRecord {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
}

const { mockPreferences, mockNotifications } = vi.hoisted(() => ({
  mockPreferences: [] as MockPreference[],
  mockNotifications: [] as MockNotificationRecord[],
}));

vi.mock("@/db", () => {
  return {
    db: {
      select: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockImplementation((table) => {
          const tableName =
            table?.[Symbol.for("drizzle:Name")] || table?.name || "";

          return {
            where: vi.fn().mockImplementation((_condition) => {
              if (tableName === "notification_preferences") {
                return Promise.resolve(mockPreferences);
              }
              return Promise.resolve([]);
            }),
          };
        }),
      })),
      insert: vi.fn().mockImplementation((_table) => ({
        values: vi.fn().mockImplementation((vals) => ({
          onConflictDoUpdate: vi.fn().mockImplementation(() => {
            const list = Array.isArray(vals) ? vals : [vals];
            for (const item of list) {
              const idx = mockPreferences.findIndex(
                (p) => p.userId === item.userId && p.category === item.category,
              );
              if (idx !== -1 && mockPreferences[idx]) {
                const curr = mockPreferences[idx];
                mockPreferences[idx] = {
                  ...curr,
                  inAppEnabled: item.inAppEnabled,
                  pushEnabled: item.pushEnabled,
                  updatedAt: new Date(),
                };
              } else {
                mockPreferences.push({
                  id: item.id || `pref-${Date.now()}-${Math.random()}`,
                  userId: item.userId,
                  memberId: item.memberId ?? null,
                  category: item.category,
                  inAppEnabled: item.inAppEnabled,
                  pushEnabled: item.pushEnabled,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                });
              }
            }
            return Promise.resolve(list);
          }),
          onConflictDoNothing: vi.fn().mockImplementation(() => ({
            returning: vi.fn().mockImplementation(() => {
              const val = Array.isArray(vals) ? vals[0] : vals;
              mockNotifications.push(val);
              return Promise.resolve([val]);
            }),
          })),
        })),
      })),
    },
  };
});

describe("Notification Preferences DAL Specification", () => {
  const authorizedUserSession = {
    session: {
      id: "sess-1",
      userId: "user-1",
      token: "tok-1",
      expiresAt: new Date(Date.now() + 86400000),
    },
    user: {
      id: "user-1",
      name: "Ahmad Fauzi",
      email: "ahmad@pemuda.local",
      emailVerified: true,
      roles: [
        {
          name: "member",
          permissions: [PERMISSIONS.NOTIFICATIONS_PREFERENCES_SELF],
        },
      ],
    },
  };

  const unauthorizedUserSession = {
    session: {
      id: "sess-2",
      userId: "user-2",
      token: "tok-2",
      expiresAt: new Date(Date.now() + 86400000),
    },
    user: {
      id: "user-2",
      name: "Guest User",
      email: "guest@pemuda.local",
      emailVerified: true,
      roles: [
        {
          name: "guest",
          permissions: [],
        },
      ],
    },
  };

  beforeEach(() => {
    mockPreferences.length = 0;
    mockNotifications.length = 0;
  });

  it('mandates "server-only" import in preferences DAL', () => {
    const dalPath = path.resolve(
      process.cwd(),
      "src/server/dal/notifications/preferences.ts",
    );
    expect(fs.existsSync(dalPath)).toBe(true);
    const content = fs.readFileSync(dalPath, "utf-8");
    expect(content.startsWith('import "server-only";')).toBe(true);
  });

  it("requires NOTIFICATIONS_PREFERENCES_SELF permission", async () => {
    await expect(
      getMyNotificationPreferences(unauthorizedUserSession),
    ).rejects.toThrow(UnauthorizedError);

    await expect(getMyNotificationPreferences(null)).rejects.toThrow(
      UnauthenticatedError,
    );
  });

  it("resolves default toggles for all 8 categories when no preferences saved", async () => {
    const prefs = await getMyNotificationPreferences(authorizedUserSession);
    expect(prefs.length).toBe(8);

    // Profile reminder default push is false
    const profilePref = prefs.find((p) => p.category === "profile_reminder");
    expect(profilePref).toBeDefined();
    expect(profilePref?.inAppEnabled).toBe(true);
    expect(profilePref?.pushEnabled).toBe(false);

    // Activity reminder default push is true
    const activityPref = prefs.find((p) => p.category === "activity_reminder");
    expect(activityPref?.inAppEnabled).toBe(true);
    expect(activityPref?.pushEnabled).toBe(true);
  });

  it("persists updated toggles and merges with defaults", async () => {
    await updateMyNotificationPreferences(
      [
        {
          category: "activity_reminder",
          inAppEnabled: false,
          pushEnabled: false,
        },
      ],
      authorizedUserSession,
    );

    const prefs = await getMyNotificationPreferences(authorizedUserSession);
    const activityPref = prefs.find((p) => p.category === "activity_reminder");
    expect(activityPref?.inAppEnabled).toBe(false);
    expect(activityPref?.pushEnabled).toBe(false);

    // Other categories must still resolve their defaults
    const announcementPref = prefs.find(
      (p) => p.category === "admin_announcement",
    );
    expect(announcementPref?.inAppEnabled).toBe(true);
    expect(announcementPref?.pushEnabled).toBe(true);
  });

  it("suppresses in-app notification creation when user disabled inAppEnabled for category", async () => {
    mockPreferences.push({
      id: "pref-1",
      userId: "user-1",
      memberId: null,
      category: "attendance_opened",
      inAppEnabled: false,
      pushEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const notif = await createNotification({
      userId: "user-1",
      type: "attendance_opened",
      title: "Attendance Open",
      message: "Please check in",
    });

    expect(notif).toBeNull();
    expect(mockNotifications.length).toBe(0);
  });
});
