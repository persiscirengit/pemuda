import { relations } from "drizzle-orm";
import {
  bigint,
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  smallint,
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

export const financialCategoryTypeEnum = pgEnum("financial_category_type", [
  "income",
  "expense",
]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "cash",
  "transfer",
  "other",
]);

export const memberFeeStatusEnum = pgEnum("member_fee_status", [
  "unpaid",
  "paid",
  "waived",
]);

// -----------------------------------------------------------------------------
// Tables
// -----------------------------------------------------------------------------

export const financialCategories = pgTable(
  "financial_categories",
  {
    id: uuid("id")
      .defaultRandom()
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    name: varchar("name", { length: 100 }).notNull(),
    slug: varchar("slug", { length: 120 }).notNull().unique(),
    type: financialCategoryTypeEnum("type").notNull(),
    description: text("description"),
    color: varchar("color", { length: 30 }),
    icon: varchar("icon", { length: 50 }),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("financial_categories_type_active_idx").on(t.type, t.isActive),
    index("financial_categories_sort_name_idx").on(t.sortOrder, t.name),
  ],
);

export const financialTransactions = pgTable(
  "financial_transactions",
  {
    id: uuid("id")
      .defaultRandom()
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    type: financialCategoryTypeEnum("type").notNull(),
    financialCategoryId: uuid("financial_category_id")
      .notNull()
      .references(() => financialCategories.id, { onDelete: "restrict" }),
    amountIdr: bigint("amount_idr", { mode: "number" }).notNull(), // Integer Rupiah
    transactionDate: date("transaction_date").notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description"),
    paymentMethod: paymentMethodEnum("payment_method").default("cash"),
    referenceNo: varchar("reference_no", { length: 100 }),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }), // Soft delete
  },
  (t) => [
    index("financial_transactions_type_date_idx").on(t.type, t.transactionDate),
    index("financial_transactions_category_idx").on(t.financialCategoryId),
    index("financial_transactions_date_idx").on(t.transactionDate),
    index("financial_transactions_deleted_at_idx").on(t.deletedAt),
  ],
);

export const membershipFeeSettings = pgTable(
  "membership_fee_settings",
  {
    id: uuid("id")
      .defaultRandom()
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    name: varchar("name", { length: 150 })
      .notNull()
      .default("Monthly Membership Fee"),
    defaultAmountIdr: bigint("default_amount_idr", { mode: "number" })
      .notNull()
      .default(0),
    effectiveFrom: date("effective_from"),
    effectiveTo: date("effective_to"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("membership_fee_settings_period_idx").on(
      t.isActive,
      t.effectiveFrom,
      t.effectiveTo,
    ),
  ],
);

export const memberFeeSettings = pgTable(
  "member_fee_settings",
  {
    id: uuid("id")
      .defaultRandom()
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    amountIdr: bigint("amount_idr", { mode: "number" }).notNull().default(0),
    effectiveFrom: date("effective_from"),
    effectiveTo: date("effective_to"),
    isActive: boolean("is_active").notNull().default(true),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("member_fee_settings_member_idx").on(t.memberId, t.isActive),
    index("member_fee_settings_period_idx").on(t.effectiveFrom, t.effectiveTo),
  ],
);

export const memberFeeRecords = pgTable(
  "member_fee_records",
  {
    id: uuid("id")
      .defaultRandom()
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    year: smallint("year").notNull(),
    month: smallint("month").notNull(), // 1 - 12
    amountIdr: bigint("amount_idr", { mode: "number" }).notNull().default(0),
    status: memberFeeStatusEnum("status").notNull().default("unpaid"),
    paidAt: date("paid_at"),
    note: text("note"),
    recordedBy: uuid("recorded_by").references(() => users.id, {
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
    unique("member_fee_records_member_period_unique").on(
      t.memberId,
      t.year,
      t.month,
    ),
    index("member_fee_records_period_idx").on(t.year, t.month),
    index("member_fee_records_status_idx").on(t.status),
    index("member_fee_records_member_idx").on(t.memberId),
  ],
);

// -----------------------------------------------------------------------------
// Relations
// -----------------------------------------------------------------------------

export const financialCategoriesRelations = relations(
  financialCategories,
  ({ many }) => ({
    transactions: many(financialTransactions),
  }),
);

export const financialTransactionsRelations = relations(
  financialTransactions,
  ({ one }) => ({
    category: one(financialCategories, {
      fields: [financialTransactions.financialCategoryId],
      references: [financialCategories.id],
    }),
    creator: one(users, {
      fields: [financialTransactions.createdBy],
      references: [users.id],
    }),
  }),
);

export const memberFeeSettingsRelations = relations(
  memberFeeSettings,
  ({ one }) => ({
    member: one(members, {
      fields: [memberFeeSettings.memberId],
      references: [members.id],
    }),
  }),
);

export const memberFeeRecordsRelations = relations(
  memberFeeRecords,
  ({ one }) => ({
    member: one(members, {
      fields: [memberFeeRecords.memberId],
      references: [members.id],
    }),
    recorder: one(users, {
      fields: [memberFeeRecords.recordedBy],
      references: [users.id],
    }),
  }),
);

// -----------------------------------------------------------------------------
// Inferred Types
// -----------------------------------------------------------------------------

export type FinancialCategory = typeof financialCategories.$inferSelect;
export type NewFinancialCategory = typeof financialCategories.$inferInsert;
export type FinancialTransaction = typeof financialTransactions.$inferSelect;
export type NewFinancialTransaction = typeof financialTransactions.$inferInsert;
export type MembershipFeeSetting = typeof membershipFeeSettings.$inferSelect;
export type NewMembershipFeeSetting = typeof membershipFeeSettings.$inferInsert;
export type MemberFeeSetting = typeof memberFeeSettings.$inferSelect;
export type NewMemberFeeSetting = typeof memberFeeSettings.$inferInsert;
export type MemberFeeRecord = typeof memberFeeRecords.$inferSelect;
export type NewMemberFeeRecord = typeof memberFeeRecords.$inferInsert;
