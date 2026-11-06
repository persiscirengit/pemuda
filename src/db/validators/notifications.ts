import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import {
  broadcastNotifications,
  notificationPreferences,
  notifications,
  pushSubscriptions,
} from "@/db/schema/notifications";

export const insertNotificationSchema = createInsertSchema(notifications);
export const selectNotificationSchema = createSelectSchema(notifications);

export const insertPushSubscriptionSchema =
  createInsertSchema(pushSubscriptions);
export const selectPushSubscriptionSchema =
  createSelectSchema(pushSubscriptions);

export const insertBroadcastNotificationSchema = createInsertSchema(
  broadcastNotifications,
);
export const selectBroadcastNotificationSchema = createSelectSchema(
  broadcastNotifications,
);

export const insertNotificationPreferenceSchema = createInsertSchema(
  notificationPreferences,
);
export const selectNotificationPreferenceSchema = createSelectSchema(
  notificationPreferences,
);
