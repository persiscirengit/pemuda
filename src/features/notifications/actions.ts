"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { env } from "@/env";
import { PERMISSIONS } from "@/lib/permissions";
import { createPermissionActionClient } from "@/lib/safe-action";
import {
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "@/server/dal/notifications/inbox";
import {
  NOTIFICATION_CATEGORIES,
  updateMyNotificationPreferences,
} from "@/server/dal/notifications/preferences";
import {
  revokePushSubscription,
  savePushSubscription,
  sendTestPushNotification,
} from "@/server/dal/notifications/push";

const inboxActionClient = createPermissionActionClient(
  PERMISSIONS.NOTIFICATIONS_INBOX_SELF,
);

const preferencesActionClient = createPermissionActionClient(
  PERMISSIONS.NOTIFICATIONS_PREFERENCES_SELF,
);

const pushActionClient = createPermissionActionClient(
  PERMISSIONS.NOTIFICATIONS_PUSH_SELF,
);

const markAsReadSchema = z.object({
  id: z.string().uuid(),
});

export const markNotificationAsReadAction = inboxActionClient
  .inputSchema(markAsReadSchema)
  .action(async ({ parsedInput }) => {
    await markNotificationAsRead(parsedInput.id);
    revalidatePath("/notifications");
    revalidatePath("/dashboard/notifications");
    return { success: true };
  });

export const markAllNotificationsAsReadAction = inboxActionClient.action(
  async () => {
    await markAllNotificationsAsRead();
    revalidatePath("/notifications");
    revalidatePath("/dashboard/notifications");
    return { success: true };
  },
);

const updatePreferencesSchema = z.object({
  preferences: z.array(
    z.object({
      category: z.enum(NOTIFICATION_CATEGORIES),
      inAppEnabled: z.boolean(),
      pushEnabled: z.boolean(),
    }),
  ),
});

export const updateNotificationPreferencesAction = preferencesActionClient
  .inputSchema(updatePreferencesSchema)
  .action(async ({ parsedInput }) => {
    await updateMyNotificationPreferences(parsedInput.preferences);
    revalidatePath("/notifications");
    revalidatePath("/dashboard/notifications");
    revalidatePath("/dashboard/notifications/settings");
    return { success: true };
  });

const savePushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(1024),
  publicKey: z.string().optional().nullable(),
  authToken: z.string().optional().nullable(),
  contentEncoding: z.string().max(30).optional().nullable(),
  userAgent: z.string().optional().nullable(),
  deviceName: z.string().max(100).optional().nullable(),
});

const revokePushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(1024),
});

export const getVapidPublicKeyAction = pushActionClient.action(async () => {
  const publicKey = env.VAPID_PUBLIC_KEY || "";
  return { publicKey };
});

export const savePushSubscriptionAction = pushActionClient
  .inputSchema(savePushSubscriptionSchema)
  .action(async ({ parsedInput }) => {
    const saved = await savePushSubscription(parsedInput);
    revalidatePath("/notifications/settings");
    revalidatePath("/dashboard/notifications/settings");
    return { success: true, subscriptionId: saved.id };
  });

export const revokePushSubscriptionAction = pushActionClient
  .inputSchema(revokePushSubscriptionSchema)
  .action(async ({ parsedInput }) => {
    await revokePushSubscription(parsedInput.endpoint);
    revalidatePath("/notifications/settings");
    revalidatePath("/dashboard/notifications/settings");
    return { success: true };
  });

export const sendTestPushNotificationAction = pushActionClient.action(
  async () => {
    const result = await sendTestPushNotification();
    return { success: true, ...result };
  },
);
