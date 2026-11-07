import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  isPushThrottled,
  recordPushSent,
  sendPushNotification,
} from "@/server/services/web-push";

const mockWebPush = vi.hoisted(() => ({
  setVapidDetails: vi.fn(),
  sendNotification: vi.fn(),
}));

vi.mock("web-push", () => ({
  default: {
    setVapidDetails: mockWebPush.setVapidDetails,
    sendNotification: mockWebPush.sendNotification,
  },
  WebPushError: class WebPushError extends Error {
    statusCode: number;
    headers: Record<string, string>;
    body: string;
    endpoint: string;
    constructor(
      message: string,
      statusCode: number,
      headers: Record<string, string> = {},
      body = "",
      endpoint = "",
    ) {
      super(message);
      this.name = "WebPushError";
      this.statusCode = statusCode;
      this.headers = headers;
      this.body = body;
      this.endpoint = endpoint;
    }
  },
}));

interface MockDbSubscription {
  id: string;
  userId: string | null;
  endpoint: string;
  revokedAt: Date | null;
  lastUsedAt: Date | null;
}

const { mockSubscriptionsDb, mockPushLogsDb } = vi.hoisted(() => ({
  mockSubscriptionsDb: [] as MockDbSubscription[],
  mockPushLogsDb: [] as {
    userId: string;
    type: string;
    relatedId: string | null;
    sentAt: Date;
  }[],
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
      select: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockImplementation((table) => {
          const tableName =
            table?.[Symbol.for("drizzle:Name")] || table?.name || "";

          return {
            where: vi.fn().mockImplementation((condition) => {
              if (tableName === "push_subscriptions") {
                return Promise.resolve(mockSubscriptionsDb);
              }
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
                const targetType = flat.find(
                  (x: unknown): x is string =>
                    typeof x === "string" && x.startsWith("attendance_"),
                );

                const matches = mockPushLogsDb.filter((l) => {
                  if (targetUser && l.userId !== targetUser) return false;
                  if (targetType && l.type !== targetType) return false;
                  if (Date.now() - l.sentAt.getTime() > 30 * 60 * 1000)
                    return false;
                  return true;
                });
                return Promise.resolve(matches);
              }
              return Promise.resolve([]);
            }),
          };
        }),
      })),
      insert: vi.fn().mockImplementation((_table) => ({
        values: vi.fn().mockImplementation((val) => {
          mockPushLogsDb.push({
            userId: val.userId,
            type: val.type,
            relatedId: val.relatedId ?? null,
            sentAt: val.createdAt ?? new Date(),
          });
          return Promise.resolve([val]);
        }),
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

            for (const sub of mockSubscriptionsDb) {
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

describe("Web Push Service Specification", () => {
  const sampleSubscription = {
    endpoint: "https://fcm.googleapis.com/fcm/send/sample-token",
    publicKey: "BMsampleKey123",
    authToken: "sampleAuthToken456",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSubscriptionsDb.length = 0;
    mockPushLogsDb.length = 0;
    mockSubscriptionsDb.push({
      id: "sub-1",
      userId: "user-1",
      endpoint: "https://fcm.googleapis.com/fcm/send/sample-token",
      revokedAt: null,
      lastUsedAt: null,
    });
  });

  it('mandates "server-only" import in web-push service file', () => {
    const servicePath = path.resolve(
      process.cwd(),
      "src/server/services/web-push.ts",
    );
    expect(fs.existsSync(servicePath)).toBe(true);
    const content = fs.readFileSync(servicePath, "utf-8");
    expect(content.startsWith('import "server-only";')).toBe(true);
  });

  it("successfully formats VAPID payloads and headers with TTL", async () => {
    mockWebPush.sendNotification.mockResolvedValueOnce({ statusCode: 201 });

    const payload = {
      title: "Activity Starting",
      body: "Scheduled study starting in 15 minutes.",
      url: "/dashboard/activities/123",
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-72.png",
      type: "activity_reminder",
    };

    const result = await sendPushNotification(sampleSubscription, payload);

    expect(result.success).toBe(true);
    expect(mockWebPush.sendNotification).toHaveBeenCalledTimes(1);

    const callArgs = mockWebPush.sendNotification.mock.calls[0];
    expect(callArgs).toBeDefined();
    if (!callArgs) return;
    const [subscriptionArg, payloadStringArg, optionsArg] = callArgs;

    expect(subscriptionArg.endpoint).toBe(sampleSubscription.endpoint);
    expect(subscriptionArg.keys.p256dh).toBe(sampleSubscription.publicKey);
    expect(subscriptionArg.keys.auth).toBe(sampleSubscription.authToken);

    const parsedPayload = JSON.parse(payloadStringArg);
    expect(parsedPayload.title).toBe("Activity Starting");
    expect(parsedPayload.url).toBe("/dashboard/activities/123");
    expect(optionsArg.TTL).toBe(3600);
  });

  it("catches HTTP 404/410 errors and automatically revokes expired subscription", async () => {
    const error410 = {
      name: "WebPushError",
      statusCode: 410,
      message: "Subscription has expired or is no longer valid",
      endpoint: sampleSubscription.endpoint,
    };
    mockWebPush.sendNotification.mockRejectedValueOnce(error410);

    const payload = {
      title: "Test Alert",
      body: "Test Body",
      url: "/dashboard",
      type: "admin_announcement",
    };

    const result = await sendPushNotification(sampleSubscription, payload);

    expect(result.success).toBe(false);
    expect(result.revoked).toBe(true);

    const target = mockSubscriptionsDb.find(
      (s) => s.endpoint === sampleSubscription.endpoint,
    );
    expect(target?.revokedAt).not.toBeNull();
  });

  it("respects 30-minute quiet period throttling for attendance reminders", async () => {
    const userId = "user-1";
    const type = "attendance_not_submitted";
    const relatedId = "event-456";

    // First time: should not be throttled
    const throttledFirst = await isPushThrottled(userId, type, relatedId);
    expect(throttledFirst).toBe(false);

    // Record push dispatched just now
    await recordPushSent(userId, type, relatedId, new Date());

    // Second check within 30 minutes: must be throttled
    const throttledSecond = await isPushThrottled(userId, type, relatedId);
    expect(throttledSecond).toBe(true);

    // After 31 minutes: should not be throttled anymore
    const thirtyOneMinutesAgo = new Date(Date.now() - 31 * 60 * 1000);
    const firstLog = mockPushLogsDb[0];
    if (firstLog) {
      firstLog.sentAt = thirtyOneMinutesAgo;
    }

    const throttledThird = await isPushThrottled(userId, type, relatedId);
    expect(throttledThird).toBe(false);
  });
});
