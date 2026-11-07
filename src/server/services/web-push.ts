import "server-only";

import { and, eq, gt } from "drizzle-orm";
import webpush from "web-push";
import { db } from "@/db";
import { notifications, pushSubscriptions } from "@/db/schema/notifications";
import { env } from "@/env";

let vapidConfigured = false;

function ensureVapidConfigured(): void {
  if (vapidConfigured) return;

  const subject = env.VAPID_SUBJECT;
  const publicKey = env.VAPID_PUBLIC_KEY;
  const privateKey = env.VAPID_PRIVATE_KEY;

  if (subject && publicKey && privateKey) {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    vapidConfigured = true;
  }
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string | null;
  icon?: string;
  badge?: string;
  type?: string;
  data?: Record<string, unknown>;
}

export interface SendPushOptions {
  TTL?: number;
  urgency?: "very-low" | "low" | "normal" | "high";
}

export interface SendPushResult {
  success: boolean;
  revoked?: boolean;
  statusCode?: number;
  error?: string;
}

export interface PushSubscriptionTarget {
  endpoint: string;
  publicKey?: string | null;
  authToken?: string | null;
}

/**
 * Synchronously dispatches a Web Push notification to a target subscription.
 * Handles automatic subscription revocation on HTTP 404 or 410 Gone.
 */
export async function sendPushNotification(
  subscription: PushSubscriptionTarget,
  payload: PushPayload,
  options?: SendPushOptions,
): Promise<SendPushResult> {
  ensureVapidConfigured();

  const pushSubscription = {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.publicKey || "",
      auth: subscription.authToken || "",
    },
  };

  const payloadString = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url || "/dashboard",
    icon: payload.icon || "/icons/icon-192.png",
    badge: payload.badge || "/icons/badge-72.png",
    type: payload.type || "admin_announcement",
    data: payload.data || {},
  });

  const sendOptions = {
    TTL: options?.TTL ?? 3600,
    urgency: options?.urgency ?? "normal",
  };

  try {
    const res = await webpush.sendNotification(
      pushSubscription,
      payloadString,
      sendOptions,
    );

    await db
      .update(pushSubscriptions)
      .set({
        lastUsedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(pushSubscriptions.endpoint, subscription.endpoint));

    return { success: true, statusCode: res?.statusCode ?? 201 };
  } catch (error: unknown) {
    const errObj = error as
      | { statusCode?: number; status?: number; message?: string }
      | undefined;
    const statusCode = errObj?.statusCode ?? errObj?.status;

    if (statusCode === 404 || statusCode === 410) {
      await db
        .update(pushSubscriptions)
        .set({
          revokedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(pushSubscriptions.endpoint, subscription.endpoint));

      return { success: false, revoked: true, statusCode };
    }

    return {
      success: false,
      statusCode,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

const QUIET_PERIOD_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Checks whether an attendance reminder push should be throttled.
 */
export async function isPushThrottled(
  userId: string,
  type: string,
  relatedId?: string | null,
): Promise<boolean> {
  if (
    type !== "attendance_not_submitted" &&
    type !== "attendance_closing_soon"
  ) {
    return false;
  }

  const thirtyMinutesAgo = new Date(Date.now() - QUIET_PERIOD_MS);

  const conditions = [
    eq(notifications.userId, userId),
    eq(notifications.type, type),
    gt(notifications.createdAt, thirtyMinutesAgo),
  ];

  if (relatedId) {
    conditions.push(eq(notifications.relatedId, relatedId));
  }

  const recent = await db
    .select()
    .from(notifications)
    .where(and(...conditions));

  return recent.length > 0;
}

/**
 * Records a push notification dispatched for tracking throttling.
 */
export async function recordPushSent(
  userId: string,
  type: string,
  relatedId?: string | null,
  sentAt?: Date,
): Promise<void> {
  const timestamp = sentAt || new Date();
  await db.insert(notifications).values({
    userId,
    type,
    relatedType: "activity",
    relatedId: relatedId || null,
    title: "Push Notification Record",
    message: "Dispatched push",
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}
