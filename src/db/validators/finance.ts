import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import {
  financialCategories,
  financialTransactions,
  memberFeeRecords,
  memberFeeSettings,
  membershipFeeSettings,
} from "@/db/schema/finance";

export const insertFinancialCategorySchema =
  createInsertSchema(financialCategories);
export const selectFinancialCategorySchema =
  createSelectSchema(financialCategories);

export const insertFinancialTransactionSchema = createInsertSchema(
  financialTransactions,
);
export const selectFinancialTransactionSchema = createSelectSchema(
  financialTransactions,
);

export const insertMembershipFeeSettingSchema = createInsertSchema(
  membershipFeeSettings,
);
export const selectMembershipFeeSettingSchema = createSelectSchema(
  membershipFeeSettings,
);

export const insertMemberFeeSettingSchema =
  createInsertSchema(memberFeeSettings);
export const selectMemberFeeSettingSchema =
  createSelectSchema(memberFeeSettings);

export const insertMemberFeeRecordSchema = createInsertSchema(memberFeeRecords);
export const selectMemberFeeRecordSchema = createSelectSchema(memberFeeRecords);
