import "server-only";

import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { type Notification, notifications } from "@/db/schema/notifications";
import { PERMISSIONS } from "@/lib/permissions";
import { requirePermission, type UserSession } from "@/server/dal/auth";
import { isCategoryInAppEnabled } from "@/server/dal/notifications/preferences";

export interface GetMyNotificationsParams {
  limit?: number;
  offset?: number;
  unreadOnly?: boolean;
}

export interface CreateNotificationInput {
  userId: string;
  memberId?: string | null;
  type: string;
  relatedType?: string | null;
  relatedId?: string | null;
  title: string;
  message: string;
  url?: string | null;
  data?: Record<string, unknown> | null;
}

/**
 * Resolves paginated notifications for current user.
 */
export async function getMyNotifications(
  params?: GetMyNotificationsParams,
  sessionOverride?: UserSession | null,
): Promise<Notification[]> {
  const session = await requirePermission(
    PERMISSIONS.NOTIFICATIONS_INBOX_SELF,
    sessionOverride,
  );

  const conditions = [eq(notifications.userId, session.user.id)];

  if (params?.unreadOnly) {
    conditions.push(isNull(notifications.readAt));
  }

  const query = db
    .select()
    .from(notifications)
    .where(and(...conditions))
    .orderBy(desc(notifications.createdAt));

  if (params?.limit) {
    query.limit(params.limit);
  }

  if (params?.offset) {
    query.offset(params.offset);
  }

  return await query;
}

/**
 * Resolves count of unread notifications for current user.
 */
export async function getUnreadNotificationsCount(
  sessionOverride?: UserSession | null,
): Promise<number> {
  const session = await requirePermission(
    PERMISSIONS.NOTIFICATIONS_INBOX_SELF,
    sessionOverride,
  );

  const unreadRows = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, session.user.id),
        isNull(notifications.readAt),
      ),
    );

  return unreadRows.length;
}

/**
 * Marks a specific notification as read.
 */
export async function markNotificationAsRead(
  id: string,
  sessionOverride?: UserSession | null,
): Promise<void> {
  const session = await requirePermission(
    PERMISSIONS.NOTIFICATIONS_INBOX_SELF,
    sessionOverride,
  );

  await db
    .update(notifications)
    .set({
      readAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(notifications.id, id),
        eq(notifications.userId, session.user.id),
        isNull(notifications.readAt),
      ),
    );
}

/**
 * Marks all unread notifications as read for current user.
 */
export async function markAllNotificationsAsRead(
  sessionOverride?: UserSession | null,
): Promise<void> {
  const session = await requirePermission(
    PERMISSIONS.NOTIFICATIONS_INBOX_SELF,
    sessionOverride,
  );

  await db
    .update(notifications)
    .set({
      readAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(notifications.userId, session.user.id),
        isNull(notifications.readAt),
      ),
    );
}

/**
 * Internal/system method to create in-app notification with strict deduplication
 * and user preference suppression.
 */
export async function createNotification(
  input: CreateNotificationInput,
): Promise<Notification | null> {
  // Check if user has disabled in-app alerts for this category
  const isEnabled = await isCategoryInAppEnabled(input.userId, input.type);
  if (!isEnabled) {
    return null;
  }

  const dedupeKey = `${input.type}:${input.relatedType || ""}:${input.relatedId || ""}`;

  const [created] = await db
    .insert(notifications)
    .values({
      userId: input.userId,
      memberId: input.memberId ?? null,
      type: input.type,
      relatedType: input.relatedType ?? null,
      relatedId: input.relatedId ?? null,
      dedupeKey,
      title: input.title,
      message: input.message,
      url: input.url ?? null,
      data: input.data ?? null,
    })
    .onConflictDoNothing({
      target: [notifications.userId, notifications.dedupeKey],
    })
    .returning();

  return created || null;
}
