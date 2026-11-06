import { relations } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  smallint,
  text,
  time,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { v7 as uuidv7 } from "uuid";
import { users } from "./auth";
import { departments, members } from "./organization";

// -----------------------------------------------------------------------------
// Enums
// -----------------------------------------------------------------------------

export const scheduleTypeEnum = pgEnum("schedule_type", [
  "incidental",
  "weekly",
  "monthly",
  "yearly",
]);

export const activityStatusEnum = pgEnum("activity_status", [
  "scheduled",
  "completed",
  "holiday",
  "postponed",
  "relocated",
  "cancelled",
]);

export const attendanceStatusEnum = pgEnum("attendance_status", [
  "present",
  "permission",
  "absent",
  "need_verification",
]);

export const attendanceMethodEnum = pgEnum("attendance_method", [
  "qr",
  "link",
  "manual",
]);

export const attendanceVerificationStatusEnum = pgEnum(
  "attendance_verification_status",
  ["valid", "need_verification", "rejected"],
);

// -----------------------------------------------------------------------------
// Tables
// -----------------------------------------------------------------------------

export const activityLocations = pgTable(
  "activity_locations",
  {
    id: uuid("id")
      .defaultRandom()
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    name: varchar("name", { length: 150 }).notNull(),
    address: text("address"),
    latitude: numeric("latitude", { precision: 10, scale: 7 }),
    longitude: numeric("longitude", { precision: 10, scale: 7 }),
    radiusMeters: integer("radius_meters").notNull().default(100),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("activity_locations_is_active_idx").on(t.isActive)],
);

export const agendaSchedules = pgTable(
  "agenda_schedules",
  {
    id: uuid("id")
      .defaultRandom()
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    departmentId: uuid("department_id").references(() => departments.id, {
      onDelete: "set null",
    }),
    picId: uuid("pic_id").references(() => members.id, {
      onDelete: "set null",
    }),
    activityLocationId: uuid("activity_location_id").references(
      () => activityLocations.id,
      { onDelete: "set null" },
    ),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description"),
    scheduleType: scheduleTypeEnum("schedule_type").notNull(),
    dayOfWeek: smallint("day_of_week"), // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    dayOfMonth: smallint("day_of_month"), // 1 - 31
    specificDate: date("specific_date"),
    startTime: time("start_time"),
    endTime: time("end_time"),
    defaultLocation: varchar("default_location", { length: 255 }),
    defaultLatitude: numeric("default_latitude", { precision: 10, scale: 7 }),
    defaultLongitude: numeric("default_longitude", { precision: 10, scale: 7 }),
    defaultRadius: integer("default_radius").notNull().default(100),
    isActive: boolean("is_active").notNull().default(true),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("agenda_schedules_department_idx").on(t.departmentId),
    index("agenda_schedules_pic_idx").on(t.picId),
    index("agenda_schedules_location_idx").on(t.activityLocationId),
    index("agenda_schedules_type_idx").on(t.scheduleType),
    index("agenda_schedules_active_idx").on(t.isActive),
  ],
);

export const agendaWeeklyTopics = pgTable(
  "agenda_weekly_topics",
  {
    id: uuid("id")
      .defaultRandom()
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    agendaScheduleId: uuid("agenda_schedule_id")
      .notNull()
      .references(() => agendaSchedules.id, { onDelete: "cascade" }),
    weekNumber: smallint("week_number").notNull(), // 1 - 5
    topic: varchar("topic", { length: 255 }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    unique("agenda_weekly_topics_schedule_week_unique").on(
      t.agendaScheduleId,
      t.weekNumber,
    ),
    index("agenda_weekly_topics_schedule_idx").on(t.agendaScheduleId),
  ],
);

export const activities = pgTable(
  "activities",
  {
    id: uuid("id")
      .defaultRandom()
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    agendaScheduleId: uuid("agenda_schedule_id").references(
      () => agendaSchedules.id,
      { onDelete: "set null" },
    ),
    departmentId: uuid("department_id").references(() => departments.id, {
      onDelete: "set null",
    }),
    picId: uuid("pic_id").references(() => members.id, {
      onDelete: "set null",
    }),
    title: varchar("title", { length: 200 }).notNull(),
    topic: varchar("topic", { length: 255 }),
    description: text("description"),
    activityDate: date("activity_date").notNull(),
    startTime: time("start_time"),
    endTime: time("end_time"),
    location: varchar("location", { length: 255 }),
    latitude: numeric("latitude", { precision: 10, scale: 7 }),
    longitude: numeric("longitude", { precision: 10, scale: 7 }),
    attendanceRadius: integer("attendance_radius").notNull().default(100),
    status: activityStatusEnum("status").notNull().default("scheduled"),
    changeReason: text("change_reason"),
    attendanceEnabled: boolean("attendance_enabled").notNull().default(false),
    attendanceOpenAt: timestamp("attendance_open_at", {
      withTimezone: true,
      mode: "date",
    }),
    attendanceCloseAt: timestamp("attendance_close_at", {
      withTimezone: true,
      mode: "date",
    }),
    attendanceToken: varchar("attendance_token", { length: 64 }).unique(),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("activities_date_idx").on(t.activityDate),
    index("activities_status_idx").on(t.status),
    index("activities_schedule_idx").on(t.agendaScheduleId),
    index("activities_department_idx").on(t.departmentId),
    index("activities_pic_idx").on(t.picId),
    index("activities_date_status_idx").on(t.activityDate, t.status),
  ],
);

export const attendanceRecords = pgTable(
  "attendance_records",
  {
    id: uuid("id")
      .defaultRandom()
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    activityId: uuid("activity_id")
      .notNull()
      .references(() => activities.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    status: attendanceStatusEnum("status").notNull().default("present"),
    attendanceMethod: attendanceMethodEnum("attendance_method")
      .notNull()
      .default("manual"),
    checkedInAt: timestamp("checked_in_at", {
      withTimezone: true,
      mode: "date",
    }),
    latitude: numeric("latitude", { precision: 10, scale: 7 }),
    longitude: numeric("longitude", { precision: 10, scale: 7 }),
    distanceFromActivity: numeric("distance_from_activity", {
      precision: 10,
      scale: 2,
    }),
    locationAccuracy: numeric("location_accuracy", {
      precision: 10,
      scale: 2,
    }),
    verificationStatus: attendanceVerificationStatusEnum("verification_status")
      .notNull()
      .default("valid"),
    verifiedBy: uuid("verified_by").references(() => users.id, {
      onDelete: "set null",
    }),
    verifiedAt: timestamp("verified_at", {
      withTimezone: true,
      mode: "date",
    }),
    notes: text("notes"),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    unique("attendance_records_activity_member_unique").on(
      t.activityId,
      t.memberId,
    ),
    index("attendance_records_activity_idx").on(t.activityId),
    index("attendance_records_member_idx").on(t.memberId),
    index("attendance_records_status_idx").on(t.status),
    index("attendance_records_verification_idx").on(t.verificationStatus),
  ],
);

// -----------------------------------------------------------------------------
// Relations
// -----------------------------------------------------------------------------

export const agendaSchedulesRelations = relations(
  agendaSchedules,
  ({ one, many }) => ({
    department: one(departments, {
      fields: [agendaSchedules.departmentId],
      references: [departments.id],
    }),
    pic: one(members, {
      fields: [agendaSchedules.picId],
      references: [members.id],
    }),
    activityLocation: one(activityLocations, {
      fields: [agendaSchedules.activityLocationId],
      references: [activityLocations.id],
    }),
    creator: one(users, {
      fields: [agendaSchedules.createdBy],
      references: [users.id],
    }),
    weeklyTopics: many(agendaWeeklyTopics),
    activities: many(activities),
  }),
);

export const agendaWeeklyTopicsRelations = relations(
  agendaWeeklyTopics,
  ({ one }) => ({
    agendaSchedule: one(agendaSchedules, {
      fields: [agendaWeeklyTopics.agendaScheduleId],
      references: [agendaSchedules.id],
    }),
  }),
);

export const activitiesRelations = relations(activities, ({ one, many }) => ({
  agendaSchedule: one(agendaSchedules, {
    fields: [activities.agendaScheduleId],
    references: [agendaSchedules.id],
  }),
  department: one(departments, {
    fields: [activities.departmentId],
    references: [departments.id],
  }),
  pic: one(members, {
    fields: [activities.picId],
    references: [members.id],
  }),
  creator: one(users, {
    fields: [activities.createdBy],
    references: [users.id],
  }),
  attendanceRecords: many(attendanceRecords),
}));

export const attendanceRecordsRelations = relations(
  attendanceRecords,
  ({ one }) => ({
    activity: one(activities, {
      fields: [attendanceRecords.activityId],
      references: [activities.id],
    }),
    member: one(members, {
      fields: [attendanceRecords.memberId],
      references: [members.id],
    }),
    verifier: one(users, {
      fields: [attendanceRecords.verifiedBy],
      references: [users.id],
    }),
    creator: one(users, {
      fields: [attendanceRecords.createdBy],
      references: [users.id],
    }),
  }),
);

// -----------------------------------------------------------------------------
// Inferred Types
// -----------------------------------------------------------------------------

export type ActivityLocation = typeof activityLocations.$inferSelect;
export type NewActivityLocation = typeof activityLocations.$inferInsert;
export type AgendaSchedule = typeof agendaSchedules.$inferSelect;
export type NewAgendaSchedule = typeof agendaSchedules.$inferInsert;
export type AgendaWeeklyTopic = typeof agendaWeeklyTopics.$inferSelect;
export type NewAgendaWeeklyTopic = typeof agendaWeeklyTopics.$inferInsert;
export type Activity = typeof activities.$inferSelect;
export type NewActivity = typeof activities.$inferInsert;
export type AttendanceRecord = typeof attendanceRecords.$inferSelect;
export type NewAttendanceRecord = typeof attendanceRecords.$inferInsert;
