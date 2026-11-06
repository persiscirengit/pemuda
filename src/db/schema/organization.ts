import { relations } from "drizzle-orm";
import {
  date,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { v7 as uuidv7 } from "uuid";

// -----------------------------------------------------------------------------
// Enums
// -----------------------------------------------------------------------------

export const departmentStatusEnum = pgEnum("department_status", [
  "active",
  "inactive",
]);

export const positionStatusEnum = pgEnum("position_status", [
  "active",
  "inactive",
]);

export const memberStatusEnum = pgEnum("member_status", [
  "active",
  "inactive",
  "alumni",
  "moved",
]);

export const inactiveReasonEnum = pgEnum("inactive_reason", [
  "rarely_active",
  "resigned",
  "age_limit",
  "transferred_to_persis",
  "moved_domicile",
  "other",
]);

// -----------------------------------------------------------------------------
// Tables
// -----------------------------------------------------------------------------

export const departments = pgTable(
  "departments",
  {
    id: uuid("id")
      .defaultRandom()
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    name: varchar("name", { length: 100 }).notNull().unique(),
    description: text("description"),
    status: departmentStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("departments_status_idx").on(t.status)],
);

export const positions = pgTable(
  "positions",
  {
    id: uuid("id")
      .defaultRandom()
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    name: varchar("name", { length: 100 }).notNull().unique(),
    description: text("description"),
    status: positionStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("positions_status_idx").on(t.status)],
);

export const members = pgTable(
  "members",
  {
    id: uuid("id")
      .defaultRandom()
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    departmentId: uuid("department_id").references(() => departments.id, {
      onDelete: "set null",
    }),
    positionId: uuid("position_id").references(() => positions.id, {
      onDelete: "set null",
    }),
    fullName: varchar("full_name", { length: 150 }).notNull(),
    memberNumber: varchar("member_number", { length: 50 }).unique(), // NPA
    phone: varchar("phone", { length: 30 }),
    email: varchar("email", { length: 255 }),
    address: text("address"),
    profilePhoto: varchar("profile_photo", { length: 255 }), // Relative S3 key (e.g. uploads/members/<uuid>.webp)
    joinedAt: date("joined_at"),
    birthDate: date("birth_date"),
    memberStatus: memberStatusEnum("member_status").notNull().default("active"),
    inactiveReason: inactiveReasonEnum("inactive_reason"),
    inactiveAt: date("inactive_at"),
    statusNotes: text("status_notes"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("members_department_id_idx").on(t.departmentId),
    index("members_position_id_idx").on(t.positionId),
    index("members_status_idx").on(t.memberStatus),
    index("members_joined_at_idx").on(t.joinedAt),
  ],
);

export const systemSettings = pgTable("system_settings", {
  id: uuid("id")
    .defaultRandom()
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  key: varchar("key", { length: 100 }).notNull().unique(),
  value: text("value"),
  type: varchar("type", { length: 30 }).default("string"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull(),
});

// -----------------------------------------------------------------------------
// Relations
// -----------------------------------------------------------------------------

export const departmentsRelations = relations(departments, ({ many }) => ({
  members: many(members),
}));

export const positionsRelations = relations(positions, ({ many }) => ({
  members: many(members),
}));

export const membersRelations = relations(members, ({ one }) => ({
  department: one(departments, {
    fields: [members.departmentId],
    references: [departments.id],
  }),
  position: one(positions, {
    fields: [members.positionId],
    references: [positions.id],
  }),
}));

// -----------------------------------------------------------------------------
// Inferred Types
// -----------------------------------------------------------------------------

export type Department = typeof departments.$inferSelect;
export type NewDepartment = typeof departments.$inferInsert;
export type Position = typeof positions.$inferSelect;
export type NewPosition = typeof positions.$inferInsert;
export type Member = typeof members.$inferSelect;
export type NewMember = typeof members.$inferInsert;
export type SystemSetting = typeof systemSettings.$inferSelect;
export type NewSystemSetting = typeof systemSettings.$inferInsert;
