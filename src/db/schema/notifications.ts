import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { v7 as uuidv7 } from "uuid";
import { users } from "./auth";
import { members } from "./organization";

// -----------------------------------------------------------------------------
// Enums
// -----------------------------------------------------------------------------

export const broadcastChannelEnum = pgEnum("broadcast_channel", [
  "in_app",
  "push",
  "both",
]);

export const broadcastStatusEnum = pgEnum("broadcast_status", [
  "draft",
  "sent",
  "cancelled",
]);

export const broadcastTargetTypeEnum = pgEnum("broadcast_target_type", [
  "all_members",
  "active_members",
  "by_department",
  "by_position",
  "selected_members",
]);

// -----------------------------------------------------------------------------
// Tables
// -----------------------------------------------------------------------------

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id")
      .defaultRandom()
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    memberId: uuid("member_id").references(() => members.id, {
      onDelete: "set null",
    }),
    type: varchar("type", { length: 50 }).notNull(),
    relatedType: varchar("related_type", { length: 50 }),
    relatedId: uuid("related_id"),
    dedupeKey: varchar("dedupe_key", { length: 100 }),
    title: varchar("title", { length: 200 }).notNull(),
    message: text("message").notNull(),
    url: varchar("url", { length: 255 }),
    data: jsonb("data"),
    readAt: timestamp("read_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    unique("notifications_user_dedupe_unique").on(t.userId, t.dedupeKey),
    index("notifications_user_read_idx").on(t.userId, t.readAt),
    index("notifications_member_read_idx").on(t.memberId, t.readAt),
    index("notifications_type_created_idx").on(t.type, t.createdAt),
    index("notifications_user_related_idx").on(
      t.userId,
      t.type,
      t.relatedType,
      t.relatedId,
    ),
    index("notifications_member_related_idx").on(
      t.memberId,
      t.type,
      t.relatedType,
      t.relatedId,
    ),
  ],
);

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id")
      .defaultRandom()
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    memberId: uuid("member_id").references(() => members.id, {
      onDelete: "set null",
    }),
    endpoint: varchar("endpoint", { length: 1024 }).notNull().unique(),
    publicKey: text("public_key"),
    authToken: text("auth_token"),
    contentEncoding: varchar("content_encoding", { length: 30 }),
    userAgent: text("user_agent"),
    deviceName: varchar("device_name", { length: 100 }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true, mode: "date" }),
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("push_subscriptions_user_revoked_idx").on(t.userId, t.revokedAt),
    index("push_subscriptions_member_revoked_idx").on(t.memberId, t.revokedAt),
  ],
);

export const broadcastNotifications = pgTable(
  "broadcast_notifications",
  {
    id: uuid("id")
      .defaultRandom()
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    title: varchar("title", { length: 200 }).notNull(),
    message: text("message").notNull(),
    type: varchar("type", { length: 50 }).notNull().default("announcement"),
    targetType: broadcastTargetTypeEnum("target_type")
      .notNull()
      .default("active_members"),
    targetPayload: jsonb("target_payload"),
    channel: broadcastChannelEnum("channel").notNull().default("in_app"),
    url: varchar("url", { length: 255 }),
    status: broadcastStatusEnum("status").notNull().default("draft"),
    sentAt: timestamp("sent_at", { withTimezone: true, mode: "date" }),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    targetCount: integer("target_count").notNull().default(0),
    deliveredCount: integer("delivered_count").notNull().default(0),
    skippedCount: integer("skipped_count").notNull().default(0),
    pushAttemptedCount: integer("push_attempted_count").notNull().default(0),
    pushSentCount: integer("push_sent_count").notNull().default(0),
    pushFailedCount: integer("push_failed_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("broadcast_notifications_status_created_idx").on(
      t.status,
      t.createdAt,
    ),
    index("broadcast_notifications_type_created_idx").on(t.type, t.createdAt),
    index("broadcast_notifications_channel_created_idx").on(
      t.channel,
      t.createdAt,
    ),
  ],
);

export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    id: uuid("id")
      .defaultRandom()
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    memberId: uuid("member_id").references(() => members.id, {
      onDelete: "set null",
    }),
    category: varchar("category", { length: 50 }).notNull(),
    inAppEnabled: boolean("in_app_enabled").notNull().default(true),
    pushEnabled: boolean("push_enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    unique("notification_preferences_user_category_unique").on(
      t.userId,
      t.category,
    ),
    index("notification_preferences_member_category_idx").on(
      t.memberId,
      t.category,
    ),
  ],
);

// -----------------------------------------------------------------------------
// Relations
// -----------------------------------------------------------------------------

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  member: one(members, {
    fields: [notifications.memberId],
    references: [members.id],
  }),
}));

export const pushSubscriptionsRelations = relations(
  pushSubscriptions,
  ({ one }) => ({
    user: one(users, {
      fields: [pushSubscriptions.userId],
      references: [users.id],
    }),
    member: one(members, {
      fields: [pushSubscriptions.memberId],
      references: [members.id],
    }),
  }),
);

export const broadcastNotificationsRelations = relations(
  broadcastNotifications,
  ({ one }) => ({
    creator: one(users, {
      fields: [broadcastNotifications.createdBy],
      references: [users.id],
    }),
  }),
);

export const notificationPreferencesRelations = relations(
  notificationPreferences,
  ({ one }) => ({
    user: one(users, {
      fields: [notificationPreferences.userId],
      references: [users.id],
    }),
    member: one(members, {
      fields: [notificationPreferences.memberId],
      references: [members.id],
    }),
  }),
);

// -----------------------------------------------------------------------------
// Inferred Types
// -----------------------------------------------------------------------------

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type NewPushSubscription = typeof pushSubscriptions.$inferInsert;
export type BroadcastNotification = typeof broadcastNotifications.$inferSelect;
export type NewBroadcastNotification =
  typeof broadcastNotifications.$inferInsert;
export type NotificationPreference =
  typeof notificationPreferences.$inferSelect;
export type NewNotificationPreference =
  typeof notificationPreferences.$inferInsert;
