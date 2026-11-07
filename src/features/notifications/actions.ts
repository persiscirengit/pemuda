"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
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

const inboxActionClient = createPermissionActionClient(
  PERMISSIONS.NOTIFICATIONS_INBOX_SELF,
);

const preferencesActionClient = createPermissionActionClient(
  PERMISSIONS.NOTIFICATIONS_PREFERENCES_SELF,
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
