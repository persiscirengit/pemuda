import "server-only";

import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  type PushSubscription as PushSubscriptionModel,
  pushSubscriptions,
} from "@/db/schema/notifications";
import { PERMISSIONS } from "@/lib/permissions";
import { requirePermission, type UserSession } from "@/server/dal/auth";
import { sendPushNotification } from "@/server/services/web-push";

export interface SavePushSubscriptionInput {
  endpoint: string;
  publicKey?: string | null;
  authToken?: string | null;
  contentEncoding?: string | null;
  userAgent?: string | null;
  deviceName?: string | null;
}

export interface SendTestPushResult {
  sentCount: number;
  totalSubs: number;
}

/**
 * Returns active push subscriptions for current user.
 */
export async function getMyPushSubscriptions(
  sessionOverride?: UserSession | null,
): Promise<PushSubscriptionModel[]> {
  const session = await requirePermission(
    PERMISSIONS.NOTIFICATIONS_PUSH_SELF,
    sessionOverride,
  );

  return await db
    .select()
    .from(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.userId, session.user.id),
        isNull(pushSubscriptions.revokedAt),
      ),
    )
    .orderBy(desc(pushSubscriptions.createdAt));
}

/**
 * Saves or updates a push subscription for current user.
 * Reactivates subscription if it was previously revoked.
 */
export async function savePushSubscription(
  input: SavePushSubscriptionInput,
  sessionOverride?: UserSession | null,
): Promise<PushSubscriptionModel> {
  const session = await requirePermission(
    PERMISSIONS.NOTIFICATIONS_PUSH_SELF,
    sessionOverride,
  );

  const [saved] = await db
    .insert(pushSubscriptions)
    .values({
      userId: session.user.id,
      endpoint: input.endpoint,
      publicKey: input.publicKey ?? null,
      authToken: input.authToken ?? null,
      contentEncoding: input.contentEncoding ?? "aes128gcm",
      userAgent: input.userAgent ?? null,
      deviceName: input.deviceName ?? null,
      revokedAt: null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: {
        userId: session.user.id,
        publicKey: input.publicKey ?? null,
        authToken: input.authToken ?? null,
        contentEncoding: input.contentEncoding ?? "aes128gcm",
        userAgent: input.userAgent ?? null,
        deviceName: input.deviceName ?? null,
        revokedAt: null,
        updatedAt: new Date(),
      },
    })
    .returning();

  if (!saved) {
    throw new Error("Failed to save push subscription");
  }

  return saved;
}

/**
 * Revokes a push subscription by its endpoint.
 */
export async function revokePushSubscription(
  endpoint: string,
  sessionOverride?: UserSession | null,
): Promise<void> {
  const session = await requirePermission(
    PERMISSIONS.NOTIFICATIONS_PUSH_SELF,
    sessionOverride,
  );

  await db
    .update(pushSubscriptions)
    .set({
      revokedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(pushSubscriptions.endpoint, endpoint),
        eq(pushSubscriptions.userId, session.user.id),
      ),
    );
}

/**
 * Dispatches a test push notification to all active devices of current user.
 */
export async function sendTestPushNotification(
  sessionOverride?: UserSession | null,
): Promise<SendTestPushResult> {
  const session = await requirePermission(
    PERMISSIONS.NOTIFICATIONS_PUSH_SELF,
    sessionOverride,
  );

  const activeSubs = await db
    .select()
    .from(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.userId, session.user.id),
        isNull(pushSubscriptions.revokedAt),
      ),
    );

  let sentCount = 0;
  for (const sub of activeSubs) {
    const res = await sendPushNotification(
      {
        endpoint: sub.endpoint,
        publicKey: sub.publicKey,
        authToken: sub.authToken,
      },
      {
        title: "Pemuda Persis Test Notification",
        body: "Web Push successfully enabled on this device.",
        url: "/dashboard/notifications",
        type: "admin_announcement",
      },
    );
    if (res.success) {
      sentCount++;
    }
  }

  return { sentCount, totalSubs: activeSubs.length };
}
