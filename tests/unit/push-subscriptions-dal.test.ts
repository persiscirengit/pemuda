import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { PERMISSIONS } from "@/lib/permissions";
import { UnauthenticatedError, UnauthorizedError } from "@/server/dal/auth";
import {
  getMyPushSubscriptions,
  revokePushSubscription,
  savePushSubscription,
  sendTestPushNotification,
} from "@/server/dal/notifications/push";
import { sendPushNotification } from "@/server/services/web-push";

interface MockSubscription {
  id: string;
  userId: string | null;
  memberId: string | null;
  endpoint: string;
  publicKey: string | null;
  authToken: string | null;
  contentEncoding: string | null;
  userAgent: string | null;
  deviceName: string | null;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const { mockSubscriptions } = vi.hoisted(() => ({
  mockSubscriptions: [] as MockSubscription[],
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

vi.mock("@/server/services/web-push", () => ({
  sendPushNotification: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/db", () => {
  return {
    db: {
      select: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockImplementation((table) => {
          const tableName =
            table?.[Symbol.for("drizzle:Name")] || table?.name || "";

          return {
            where: vi.fn().mockImplementation((condition) => {
              if (tableName === "push_subscriptions") {
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
                const activeOnly = flat.some(
                  (x: unknown) =>
                    typeof x === "string" && x.includes("is null"),
                );

                const filtered = mockSubscriptions.filter((s) => {
                  if (targetUser && s.userId !== targetUser) return false;
                  if (activeOnly && s.revokedAt !== null) return false;
                  return true;
                });
                return Object.assign(Promise.resolve(filtered), {
                  orderBy: vi.fn().mockReturnValue(Promise.resolve(filtered)),
                });
              }
              return Promise.resolve([]);
            }),
          };
        }),
      })),
      insert: vi.fn().mockImplementation((_table) => ({
        values: vi.fn().mockImplementation((val) => ({
          onConflictDoUpdate: vi.fn().mockImplementation(({ set }) => ({
            returning: vi.fn().mockImplementation(() => {
              const existingIndex = mockSubscriptions.findIndex(
                (s) => s.endpoint === val.endpoint,
              );
              if (existingIndex >= 0) {
                const existing = mockSubscriptions[existingIndex];
                if (!existing) throw new Error("Existing not found");
                const updated: MockSubscription = {
                  id: existing.id,
                  userId: existing.userId,
                  memberId: existing.memberId,
                  endpoint: existing.endpoint,
                  publicKey: val.publicKey ?? existing.publicKey,
                  authToken: val.authToken ?? existing.authToken,
                  contentEncoding:
                    val.contentEncoding ?? existing.contentEncoding,
                  userAgent: val.userAgent ?? existing.userAgent,
                  deviceName: val.deviceName ?? existing.deviceName,
                  lastUsedAt: existing.lastUsedAt,
                  revokedAt: set.revokedAt === null ? null : existing.revokedAt,
                  createdAt: existing.createdAt,
                  updatedAt: new Date(),
                };
                mockSubscriptions[existingIndex] = updated;
                return Promise.resolve([updated]);
              }
              const newRecord: MockSubscription = {
                id: val.id || `sub-${Date.now()}-${Math.random()}`,
                userId: val.userId,
                memberId: val.memberId ?? null,
                endpoint: val.endpoint,
                publicKey: val.publicKey ?? null,
                authToken: val.authToken ?? null,
                contentEncoding: val.contentEncoding ?? "aes128gcm",
                userAgent: val.userAgent ?? null,
                deviceName: val.deviceName ?? null,
                lastUsedAt: null,
                revokedAt: null,
                createdAt: new Date(),
                updatedAt: new Date(),
              };
              mockSubscriptions.push(newRecord);
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

            const targetEndpoint = flat.find(
              (x: unknown): x is string =>
                typeof x === "string" && x.startsWith("https://"),
            );

            for (const sub of mockSubscriptions) {
              if (targetEndpoint && sub.endpoint === targetEndpoint) {
                if (values.revokedAt !== undefined) {
                  sub.revokedAt = values.revokedAt;
                }
                if (values.lastUsedAt !== undefined) {
                  sub.lastUsedAt = values.lastUsedAt;
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

describe("Push Subscriptions DAL Specification", () => {
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
          permissions: [PERMISSIONS.NOTIFICATIONS_PUSH_SELF],
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
    mockSubscriptions.length = 0;
    vi.clearAllMocks();
  });

  it('mandates "server-only" import in DAL source file', () => {
    const dalPath = path.resolve(
      process.cwd(),
      "src/server/dal/notifications/push.ts",
    );
    expect(fs.existsSync(dalPath)).toBe(true);
    const content = fs.readFileSync(dalPath, "utf-8");
    expect(content.startsWith('import "server-only";')).toBe(true);
  });

  it("requires NOTIFICATIONS_PUSH_SELF permission", async () => {
    await expect(
      savePushSubscription(
        {
          endpoint: "https://push.example.com/sub-1",
          publicKey: "key1",
          authToken: "auth1",
        },
        unauthorizedUserSession,
      ),
    ).rejects.toThrow(UnauthorizedError);

    await expect(
      savePushSubscription(
        {
          endpoint: "https://push.example.com/sub-1",
          publicKey: "key1",
          authToken: "auth1",
        },
        null,
      ),
    ).rejects.toThrow(UnauthenticatedError);
  });

  it("saves subscription and enforces uniqueness of endpoint", async () => {
    await savePushSubscription(
      {
        endpoint: "https://push.example.com/sub-1",
        publicKey: "key1",
        authToken: "auth1",
        deviceName: "Chrome on Android",
      },
      authorizedUserSession,
    );

    expect(mockSubscriptions.length).toBe(1);
    expect(mockSubscriptions[0]?.endpoint).toBe(
      "https://push.example.com/sub-1",
    );

    // Save again with same endpoint (e.g. device refresh or renewal)
    await savePushSubscription(
      {
        endpoint: "https://push.example.com/sub-1",
        publicKey: "key1-updated",
        authToken: "auth1-updated",
        deviceName: "Chrome on Android Updated",
      },
      authorizedUserSession,
    );

    expect(mockSubscriptions.length).toBe(1);
    expect(mockSubscriptions[0]?.publicKey).toBe("key1-updated");
  });

  it("allows multiple devices to be registered for a single user", async () => {
    await savePushSubscription(
      {
        endpoint: "https://push.example.com/device-phone",
        publicKey: "key-phone",
        authToken: "auth-phone",
        deviceName: "Pixel 8",
      },
      authorizedUserSession,
    );

    await savePushSubscription(
      {
        endpoint: "https://push.example.com/device-laptop",
        publicKey: "key-laptop",
        authToken: "auth-laptop",
        deviceName: "MacBook Pro",
      },
      authorizedUserSession,
    );

    expect(mockSubscriptions.length).toBe(2);
    expect(mockSubscriptions.every((s) => s.userId === "user-1")).toBe(true);
  });

  it("revokes push subscription by endpoint", async () => {
    await savePushSubscription(
      {
        endpoint: "https://push.example.com/sub-to-revoke",
        publicKey: "key-rev",
        authToken: "auth-rev",
      },
      authorizedUserSession,
    );

    expect(mockSubscriptions[0]?.revokedAt).toBeNull();

    await revokePushSubscription(
      "https://push.example.com/sub-to-revoke",
      authorizedUserSession,
    );

    expect(mockSubscriptions[0]?.revokedAt).not.toBeNull();
  });

  it("sends test push notification to user active subscriptions", async () => {
    await savePushSubscription(
      {
        endpoint: "https://push.example.com/device-1",
        publicKey: "key-1",
        authToken: "auth-1",
      },
      authorizedUserSession,
    );

    const result = await sendTestPushNotification(authorizedUserSession);
    expect(result.sentCount).toBe(1);
    expect(sendPushNotification).toHaveBeenCalledTimes(1);
  });

  it("retrieves active subscriptions for current user", async () => {
    await savePushSubscription(
      {
        endpoint: "https://push.example.com/device-active",
        publicKey: "key-act",
        authToken: "auth-act",
      },
      authorizedUserSession,
    );

    const activeSubs = await getMyPushSubscriptions(authorizedUserSession);
    expect(activeSubs.length).toBe(1);
    expect(activeSubs[0]?.endpoint).toBe(
      "https://push.example.com/device-active",
    );
  });
});
