import "server-only";

import { and, desc, eq, gte, ilike, isNull, lte, or } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema/auth";
import {
  type FinancialTransaction,
  financialCategories,
  financialTransactions,
} from "@/db/schema/finance";
import { PERMISSIONS } from "@/lib/permissions";
import { normalizeStorageKey } from "@/lib/storage";
import { requirePermission, type UserSession } from "@/server/dal/auth";

export interface GetTransactionsParams {
  type?: "income" | "expense";
  financialCategoryId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface TransactionWithDetails extends FinancialTransaction {
  category?: {
    id: string;
    name: string;
    slug: string;
    type: "income" | "expense";
    color: string | null;
    icon: string | null;
  } | null;
  creator?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

export interface CreateFinancialTransactionInput {
  type: "income" | "expense";
  financialCategoryId: string;
  amountIdr: number;
  transactionDate: string;
  title: string;
  description?: string | null;
  paymentMethod?: "cash" | "transfer" | "other";
  referenceNo?: string | null;
  receiptAttachment?: string | null;
}

export interface UpdateFinancialTransactionInput {
  type?: "income" | "expense";
  financialCategoryId?: string;
  amountIdr?: number;
  transactionDate?: string;
  title?: string;
  description?: string | null;
  paymentMethod?: "cash" | "transfer" | "other";
  referenceNo?: string | null;
  receiptAttachment?: string | null;
}

export async function getTransactions(
  params?: GetTransactionsParams,
  sessionOverride?: UserSession | null,
): Promise<TransactionWithDetails[]> {
  await requirePermission(
    PERMISSIONS.FINANCE_TRANSACTIONS_READ,
    sessionOverride,
  );

  const conditions = [isNull(financialTransactions.deletedAt)];

  if (params?.type) {
    conditions.push(eq(financialTransactions.type, params.type));
  }

  if (params?.financialCategoryId) {
    conditions.push(
      eq(financialTransactions.financialCategoryId, params.financialCategoryId),
    );
  }

  if (params?.startDate) {
    conditions.push(
      gte(financialTransactions.transactionDate, params.startDate),
    );
  }

  if (params?.endDate) {
    conditions.push(lte(financialTransactions.transactionDate, params.endDate));
  }

  if (params?.search && params.search.trim().length > 0) {
    const term = `%${params.search.trim()}%`;
    const searchCond = or(
      ilike(financialTransactions.title, term),
      ilike(financialTransactions.description, term),
      ilike(financialTransactions.referenceNo, term),
    );
    if (searchCond) {
      conditions.push(searchCond);
    }
  }

  const query = db
    .select({
      transaction: financialTransactions,
      category: {
        id: financialCategories.id,
        name: financialCategories.name,
        slug: financialCategories.slug,
        type: financialCategories.type,
        color: financialCategories.color,
        icon: financialCategories.icon,
      },
      creator: {
        id: users.id,
        name: users.name,
        email: users.email,
      },
    })
    .from(financialTransactions)
    .leftJoin(
      financialCategories,
      eq(financialTransactions.financialCategoryId, financialCategories.id),
    )
    .leftJoin(users, eq(financialTransactions.createdBy, users.id))
    .where(and(...conditions))
    .orderBy(
      desc(financialTransactions.transactionDate),
      desc(financialTransactions.createdAt),
    );

  if (params?.limit) {
    query.limit(params.limit);
  }

  if (params?.offset) {
    query.offset(params.offset);
  }

  const results = await query;

  return results.map((row) => ({
    ...row.transaction,
    category: row.category?.id ? row.category : null,
    creator: row.creator?.id ? row.creator : null,
  }));
}

export async function getTransactionById(
  id: string,
  sessionOverride?: UserSession | null,
): Promise<TransactionWithDetails | null> {
  await requirePermission(
    PERMISSIONS.FINANCE_TRANSACTIONS_READ,
    sessionOverride,
  );

  const [result] = await db
    .select({
      transaction: financialTransactions,
      category: {
        id: financialCategories.id,
        name: financialCategories.name,
        slug: financialCategories.slug,
        type: financialCategories.type,
        color: financialCategories.color,
        icon: financialCategories.icon,
      },
      creator: {
        id: users.id,
        name: users.name,
        email: users.email,
      },
    })
    .from(financialTransactions)
    .leftJoin(
      financialCategories,
      eq(financialTransactions.financialCategoryId, financialCategories.id),
    )
    .leftJoin(users, eq(financialTransactions.createdBy, users.id))
    .where(
      and(
        eq(financialTransactions.id, id),
        isNull(financialTransactions.deletedAt),
      ),
    )
    .limit(1);

  if (!result) return null;

  return {
    ...result.transaction,
    category: result.category?.id ? result.category : null,
    creator: result.creator?.id ? result.creator : null,
  };
}

export async function createTransaction(
  input: CreateFinancialTransactionInput,
  sessionOverride?: UserSession | null,
): Promise<FinancialTransaction> {
  const session = await requirePermission(
    PERMISSIONS.FINANCE_TRANSACTIONS_CREATE,
    sessionOverride,
  );

  if (!input.title || input.title.trim().length === 0) {
    throw new Error("Transaction title is required");
  }

  if (input.type !== "income" && input.type !== "expense") {
    throw new Error(
      "Invalid financial category type. Must be 'income' or 'expense'",
    );
  }

  if (
    typeof input.amountIdr !== "number" ||
    !Number.isInteger(input.amountIdr)
  ) {
    throw new Error("Amount in IDR must be an integer");
  }

  if (input.amountIdr <= 0) {
    throw new Error("Amount in IDR must be greater than 0");
  }

  if (!input.transactionDate) {
    throw new Error("Transaction date is required");
  }

  if (!input.financialCategoryId) {
    throw new Error("Financial category ID is required");
  }

  let referenceNo = input.referenceNo?.trim() || null;
  if (input.receiptAttachment) {
    const cleanKey = normalizeStorageKey(input.receiptAttachment);
    if (!referenceNo) {
      referenceNo = cleanKey;
    }
  }

  const [created] = await db
    .insert(financialTransactions)
    .values({
      type: input.type,
      financialCategoryId: input.financialCategoryId,
      amountIdr: input.amountIdr,
      transactionDate: input.transactionDate,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      paymentMethod: input.paymentMethod || "cash",
      referenceNo,
      createdBy: session.user.id,
    })
    .returning();

  if (!created) {
    throw new Error("Failed to create financial transaction");
  }

  return created;
}

export async function updateTransaction(
  id: string,
  input: UpdateFinancialTransactionInput,
  sessionOverride?: UserSession | null,
): Promise<FinancialTransaction> {
  await requirePermission(
    PERMISSIONS.FINANCE_TRANSACTIONS_UPDATE,
    sessionOverride,
  );

  if (input.amountIdr !== undefined) {
    if (
      typeof input.amountIdr !== "number" ||
      !Number.isInteger(input.amountIdr)
    ) {
      throw new Error("Amount in IDR must be an integer");
    }
    if (input.amountIdr <= 0) {
      throw new Error("Amount in IDR must be greater than 0");
    }
  }

  if (input.type && input.type !== "income" && input.type !== "expense") {
    throw new Error("Invalid transaction type");
  }

  const updateData: Partial<typeof financialTransactions.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (input.type !== undefined) updateData.type = input.type;
  if (input.financialCategoryId !== undefined)
    updateData.financialCategoryId = input.financialCategoryId;
  if (input.amountIdr !== undefined) updateData.amountIdr = input.amountIdr;
  if (input.transactionDate !== undefined)
    updateData.transactionDate = input.transactionDate;
  if (input.title !== undefined) updateData.title = input.title.trim();
  if (input.description !== undefined)
    updateData.description = input.description?.trim() || null;
  if (input.paymentMethod !== undefined)
    updateData.paymentMethod = input.paymentMethod;

  if (input.receiptAttachment !== undefined) {
    const cleanKey = input.receiptAttachment
      ? normalizeStorageKey(input.receiptAttachment)
      : null;
    updateData.referenceNo = input.referenceNo?.trim() || cleanKey;
  } else if (input.referenceNo !== undefined) {
    updateData.referenceNo = input.referenceNo?.trim() || null;
  }

  const [updated] = await db
    .update(financialTransactions)
    .set(updateData)
    .where(
      and(
        eq(financialTransactions.id, id),
        isNull(financialTransactions.deletedAt),
      ),
    )
    .returning();

  if (!updated) {
    throw new Error("Transaction not found or already deleted");
  }

  return updated;
}

export async function deleteTransaction(
  id: string,
  sessionOverride?: UserSession | null,
): Promise<FinancialTransaction> {
  await requirePermission(
    PERMISSIONS.FINANCE_TRANSACTIONS_DELETE,
    sessionOverride,
  );

  const [updated] = await db
    .update(financialTransactions)
    .set({
      deletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(financialTransactions.id, id),
        isNull(financialTransactions.deletedAt),
      ),
    )
    .returning();

  if (!updated) {
    throw new Error("Transaction not found or already deleted");
  }

  return updated;
}
