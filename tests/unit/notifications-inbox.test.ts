import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { PERMISSIONS } from "@/lib/permissions";
import { UnauthenticatedError, UnauthorizedError } from "@/server/dal/auth";
import {
  createNotification,
  getMyNotifications,
  getUnreadNotificationsCount,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "@/server/dal/notifications/inbox";

interface MockNotification {
  id: string;
  userId: string | null;
  memberId: string | null;
  type: string;
  relatedType: string | null;
  relatedId: string | null;
  dedupeKey: string | null;
  title: string;
  message: string;
  url: string | null;
  data: Record<string, unknown> | null;
  readAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

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

const { mockNotifications, mockPreferences } = vi.hoisted(() => ({
  mockNotifications: [] as MockNotification[],
  mockPreferences: [] as MockPreference[],
}));

function flattenChunks(chunks: unknown[]): unknown[] {
  let res: unknown[] = [];
  for (const c of chunks) {
    const chunk = c as { queryChunks?: unknown[] } | undefined;
    if (chunk?.queryChunks) {
      res = res.concat(flattenChunks(chunk.queryChunks));
    } else {
      res.push(c);
    }
  }
  return res;
}

vi.mock("@/db", () => {
  return {
    db: {
      select: vi.fn().mockImplementation((_selectObj) => ({
        from: vi.fn().mockImplementation((table) => {
          const tableName =
            table?.[Symbol.for("drizzle:Name")] || table?.name || "";

          return {
            where: vi.fn().mockImplementation((condition) => {
              if (tableName === "notifications") {
                const flat = flattenChunks(
                  (condition as { queryChunks?: unknown[] })?.queryChunks || [],
                ).map((c: unknown) => {
                  const obj = c as { value?: unknown } | undefined;
                  return obj?.value !== undefined ? obj.value : c;
                });
                const targetUser = flat.find(
                  (x: unknown): x is string =>
                    typeof x === "string" && x.startsWith("user-"),
                );
                const unread = mockNotifications.filter(
                  (n) =>
                    (!targetUser || n.userId === targetUser) &&
                    n.readAt === null,
                );

                return Object.assign(Promise.resolve(unread), {
                  orderBy: vi.fn().mockImplementation(() => {
                    return {
                      limit: vi.fn().mockImplementation((l: number) => {
                        return {
                          offset: vi.fn().mockImplementation((o: number) => {
                            return Promise.resolve(
                              mockNotifications.slice(o, o + l),
                            );
                          }),
                        };
                      }),
                    };
                  }),
                });
              }
              return Promise.resolve([]);
            }),
          };
        }),
      })),
      insert: vi.fn().mockImplementation((_table) => ({
        values: vi.fn().mockImplementation((val) => ({
          onConflictDoNothing: vi.fn().mockImplementation(() => ({
            returning: vi.fn().mockImplementation(() => {
              // Deduplication logic check:
              const exists = mockNotifications.some(
                (n) => n.userId === val.userId && n.dedupeKey === val.dedupeKey,
              );
              if (exists) {
                return Promise.resolve([]);
              }
              const newRecord: MockNotification = {
                id: val.id || `notif-${Date.now()}-${Math.random()}`,
                userId: val.userId,
                memberId: val.memberId ?? null,
                type: val.type,
                relatedType: val.relatedType ?? null,
                relatedId: val.relatedId ?? null,
                dedupeKey: val.dedupeKey,
                title: val.title,
                message: val.message,
                url: val.url ?? null,
                data: val.data ?? null,
                readAt: val.readAt ?? null,
                createdAt: new Date(),
                updatedAt: new Date(),
              };
              mockNotifications.push(newRecord);
              return Promise.resolve([newRecord]);
            }),
          })),
        })),
      })),
      update: vi.fn().mockImplementation((_table) => ({
        set: vi.fn().mockImplementation((values) => ({
          where: vi.fn().mockImplementation((condition) => {
            const flat = flattenChunks(
              (condition as { queryChunks?: unknown[] })?.queryChunks || [],
            ).map((c: unknown) => {
              const obj = c as { value?: unknown } | undefined;
              return obj?.value !== undefined ? obj.value : c;
            });

            const targetId = flat.find(
              (x: unknown): x is string =>
                typeof x === "string" && x.startsWith("notif-"),
            );
            const targetUser = flat.find(
              (x: unknown): x is string =>
                typeof x === "string" && x.startsWith("user-"),
            );

            for (const notif of mockNotifications) {
              if (targetId) {
                if (notif.id === targetId && values.readAt) {
                  notif.readAt = values.readAt;
                }
              } else if (targetUser) {
                if (notif.userId === targetUser && values.readAt) {
                  notif.readAt = values.readAt;
                }
              }
            }
            return Promise.resolve([]);
          }),
        })),
      })),
    },
  };
});

describe("Notifications Inbox DAL Specification", () => {
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
          permissions: [PERMISSIONS.NOTIFICATIONS_INBOX_SELF],
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
    mockNotifications.length = 0;
    mockPreferences.length = 0;
  });

  it('mandates "server-only" import in DAL source file', () => {
    const dalPath = path.resolve(
      process.cwd(),
      "src/server/dal/notifications/inbox.ts",
    );
    expect(fs.existsSync(dalPath)).toBe(true);
    const content = fs.readFileSync(dalPath, "utf-8");
    expect(content.startsWith('import "server-only";')).toBe(true);
  });

  it("requires NOTIFICATIONS_INBOX_SELF permission", async () => {
    await expect(
      getMyNotifications({}, unauthorizedUserSession),
    ).rejects.toThrow(UnauthorizedError);

    await expect(getMyNotifications({}, null)).rejects.toThrow(
      UnauthenticatedError,
    );
  });

  it("creates notifications with unique deduplication key", async () => {
    const created1 = await createNotification({
      userId: "user-1",
      type: "activity_reminder",
      relatedType: "activity",
      relatedId: "act-123",
      title: "Activity Reminder",
      message: "Quran study starts in 1 hour.",
    });

    expect(created1).not.toBeNull();
    expect(created1?.dedupeKey).toBe("activity_reminder:activity:act-123");

    // Second call with same parameters must be deduplicated
    const created2 = await createNotification({
      userId: "user-1",
      type: "activity_reminder",
      relatedType: "activity",
      relatedId: "act-123",
      title: "Activity Reminder",
      message: "Quran study starts in 1 hour.",
    });

    expect(created2).toBeNull();
    expect(mockNotifications.length).toBe(1);
  });

  it("marks individual notification as read", async () => {
    const notif = await createNotification({
      userId: "user-1",
      type: "admin_announcement",
      title: "Announcement",
      message: "General meeting this Sunday",
    });

    expect(notif).not.toBeNull();
    if (!notif) return;
    expect(notif.readAt).toBeNull();

    await markNotificationAsRead(notif.id, authorizedUserSession);
    const updated = mockNotifications.find((n) => n.id === notif.id);
    expect(updated?.readAt).not.toBeNull();
  });

  it("marks all unread notifications as read for current user", async () => {
    await createNotification({
      userId: "user-1",
      type: "admin_announcement",
      title: "A1",
      message: "M1",
    });
    await createNotification({
      userId: "user-1",
      type: "activity_reminder",
      title: "A2",
      message: "M2",
    });
    await createNotification({
      userId: "user-other",
      type: "activity_reminder",
      title: "A3",
      message: "M3",
    });

    await markAllNotificationsAsRead(authorizedUserSession);

    const user1Notifs = mockNotifications.filter((n) => n.userId === "user-1");
    expect(user1Notifs.every((n) => n.readAt !== null)).toBe(true);

    const otherNotifs = mockNotifications.filter(
      (n) => n.userId === "user-other",
    );
    expect(otherNotifs.every((n) => n.readAt === null)).toBe(true);
  });

  it("counts unread notifications for current user", async () => {
    await createNotification({
      userId: "user-1",
      type: "admin_announcement",
      title: "Notice 1",
      message: "Notice 1 body",
    });
    await createNotification({
      userId: "user-1",
      type: "activity_reminder",
      title: "Notice 2",
      message: "Notice 2 body",
    });

    const count = await getUnreadNotificationsCount(authorizedUserSession);
    expect(count).toBe(2);

    await markAllNotificationsAsRead(authorizedUserSession);
    const countAfter = await getUnreadNotificationsCount(authorizedUserSession);
    expect(countAfter).toBe(0);
  });
});
