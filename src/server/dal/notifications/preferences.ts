import "server-only";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { notificationPreferences } from "@/db/schema/notifications";
import { PERMISSIONS } from "@/lib/permissions";
import { requirePermission, type UserSession } from "@/server/dal/auth";

export const NOTIFICATION_CATEGORIES = [
  "activity_reminder",
  "attendance_opened",
  "attendance_closing_soon",
  "attendance_not_submitted",
  "activity_updated",
  "admin_announcement",
  "attendance_status",
  "profile_reminder",
] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export const DEFAULT_NOTIFICATION_PREFERENCES: Record<
  NotificationCategory,
  { inAppEnabled: boolean; pushEnabled: boolean }
> = {
  activity_reminder: { inAppEnabled: true, pushEnabled: true },
  attendance_opened: { inAppEnabled: true, pushEnabled: true },
  attendance_closing_soon: { inAppEnabled: true, pushEnabled: true },
  attendance_not_submitted: { inAppEnabled: true, pushEnabled: true },
  activity_updated: { inAppEnabled: true, pushEnabled: true },
  admin_announcement: { inAppEnabled: true, pushEnabled: true },
  attendance_status: { inAppEnabled: true, pushEnabled: true },
  profile_reminder: { inAppEnabled: true, pushEnabled: false },
};

export interface NotificationPreferenceEntry {
  category: NotificationCategory;
  inAppEnabled: boolean;
  pushEnabled: boolean;
}

/**
 * Resolves user's notification preferences across all 8 functional categories,
 * falling back to system defaults for any unsaved categories.
 */
export async function getMyNotificationPreferences(
  sessionOverride?: UserSession | null,
): Promise<NotificationPreferenceEntry[]> {
  const session = await requirePermission(
    PERMISSIONS.NOTIFICATIONS_PREFERENCES_SELF,
    sessionOverride,
  );

  const existing = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, session.user.id));

  const existingMap = new Map(
    existing.map((row) => [row.category as NotificationCategory, row]),
  );

  return NOTIFICATION_CATEGORIES.map((cat) => {
    const row = existingMap.get(cat);
    if (row) {
      return {
        category: cat,
        inAppEnabled: row.inAppEnabled,
        pushEnabled: row.pushEnabled,
      };
    }
    const def = DEFAULT_NOTIFICATION_PREFERENCES[cat];
    return {
      category: cat,
      inAppEnabled: def.inAppEnabled,
      pushEnabled: def.pushEnabled,
    };
  });
}

/**
 * Upserts user's notification channel toggles.
 */
export async function updateMyNotificationPreferences(
  entries: Array<{
    category: NotificationCategory;
    inAppEnabled: boolean;
    pushEnabled: boolean;
  }>,
  sessionOverride?: UserSession | null,
): Promise<void> {
  const session = await requirePermission(
    PERMISSIONS.NOTIFICATIONS_PREFERENCES_SELF,
    sessionOverride,
  );

  if (entries.length === 0) return;

  const valuesToUpsert = entries.map((entry) => ({
    userId: session.user.id,
    category: entry.category,
    inAppEnabled: entry.inAppEnabled,
    pushEnabled: entry.pushEnabled,
    updatedAt: new Date(),
  }));

  await db
    .insert(notificationPreferences)
    .values(valuesToUpsert)
    .onConflictDoUpdate({
      target: [
        notificationPreferences.userId,
        notificationPreferences.category,
      ],
      set: {
        inAppEnabled: notificationPreferences.inAppEnabled,
        pushEnabled: notificationPreferences.pushEnabled,
        updatedAt: new Date(),
      },
    });
}

/**
 * Checks whether a specific category has in-app notifications enabled for a user.
 */
export async function isCategoryInAppEnabled(
  userId: string,
  category: string,
): Promise<boolean> {
  const [row] = await db
    .select()
    .from(notificationPreferences)
    .where(
      and(
        eq(notificationPreferences.userId, userId),
        eq(notificationPreferences.category, category),
      ),
    );

  if (row) {
    return row.inAppEnabled;
  }

  const cat = category as NotificationCategory;
  if (cat in DEFAULT_NOTIFICATION_PREFERENCES) {
    return DEFAULT_NOTIFICATION_PREFERENCES[cat].inAppEnabled;
  }

  return true;
}
