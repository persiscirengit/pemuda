"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PERMISSIONS } from "@/lib/permissions";
import { createPermissionActionClient } from "@/lib/safe-action";
import {
  createTransaction,
  deleteTransaction,
  updateTransaction,
} from "@/server/dal/finance/transactions";

const createTransactionClient = createPermissionActionClient(
  PERMISSIONS.FINANCE_TRANSACTIONS_CREATE,
);

const updateTransactionClient = createPermissionActionClient(
  PERMISSIONS.FINANCE_TRANSACTIONS_UPDATE,
);

const deleteTransactionClient = createPermissionActionClient(
  PERMISSIONS.FINANCE_TRANSACTIONS_DELETE,
);

const createTransactionSchema = z.object({
  type: z.enum(["income", "expense"]),
  financialCategoryId: z.string().uuid(),
  amountIdr: z
    .number()
    .int()
    .positive({ message: "Amount must be greater than 0" }),
  transactionDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Date must be YYYY-MM-DD" }),
  title: z.string().min(1, { message: "Title is required" }).max(200),
  description: z.string().optional().nullable(),
  paymentMethod: z.enum(["cash", "transfer", "other"]).optional(),
  referenceNo: z.string().max(100).optional().nullable(),
  receiptAttachment: z.string().optional().nullable(),
});

const updateTransactionSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(["income", "expense"]).optional(),
  financialCategoryId: z.string().uuid().optional(),
  amountIdr: z.number().int().positive().optional(),
  transactionDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional().nullable(),
  paymentMethod: z.enum(["cash", "transfer", "other"]).optional(),
  referenceNo: z.string().max(100).optional().nullable(),
  receiptAttachment: z.string().optional().nullable(),
});

const transactionIdSchema = z.object({
  id: z.string().uuid(),
});

export const createTransactionAction = createTransactionClient
  .inputSchema(createTransactionSchema)
  .action(async ({ parsedInput, ctx }) => {
    const res = await createTransaction(parsedInput, {
      session: ctx.session,
      user: ctx.user,
    });
    revalidatePath("/finance");
    revalidatePath("/finance/transactions");
    return res;
  });

export const updateTransactionAction = updateTransactionClient
  .inputSchema(updateTransactionSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { id, ...data } = parsedInput;
    const res = await updateTransaction(id, data, {
      session: ctx.session,
      user: ctx.user,
    });
    revalidatePath("/finance");
    revalidatePath("/finance/transactions");
    return res;
  });

export const deleteTransactionAction = deleteTransactionClient
  .inputSchema(transactionIdSchema)
  .action(async ({ parsedInput, ctx }) => {
    const res = await deleteTransaction(parsedInput.id, {
      session: ctx.session,
      user: ctx.user,
    });
    revalidatePath("/finance");
    revalidatePath("/finance/transactions");
    return res;
  });
