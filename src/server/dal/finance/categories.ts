import "server-only";

import { and, asc, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  type FinancialCategory,
  financialCategories,
  financialTransactions,
} from "@/db/schema/finance";
import { PERMISSIONS } from "@/lib/permissions";
import { generateSlug } from "@/lib/slug";
import { requirePermission, type UserSession } from "@/server/dal/auth";

export class RestrictedDeletionError extends Error {
  constructor(
    message = "Cannot delete category referenced by existing transactions",
  ) {
    super(message);
    this.name = "RestrictedDeletionError";
  }
}

export interface GetFinancialCategoriesParams {
  type?: "income" | "expense";
  isActive?: boolean;
}

export interface CreateFinancialCategoryInput {
  name: string;
  slug?: string;
  type: "income" | "expense";
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  isActive?: boolean;
  sortOrder?: number | null;
}

export interface UpdateFinancialCategoryInput {
  name?: string;
  slug?: string;
  type?: "income" | "expense";
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  isActive?: boolean;
  sortOrder?: number | null;
}

export async function getFinancialCategories(
  params?: GetFinancialCategoriesParams,
  sessionOverride?: UserSession | null,
): Promise<FinancialCategory[]> {
  await requirePermission(PERMISSIONS.FINANCE_CATEGORIES_READ, sessionOverride);

  const conditions = [];

  if (params?.type) {
    conditions.push(eq(financialCategories.type, params.type));
  }

  if (params?.isActive !== undefined) {
    conditions.push(eq(financialCategories.isActive, params.isActive));
  }

  const query = db.select().from(financialCategories);

  if (conditions.length > 0) {
    return query
      .where(and(...conditions))
      .orderBy(
        asc(financialCategories.sortOrder),
        asc(financialCategories.name),
      );
  }

  return query.orderBy(
    asc(financialCategories.sortOrder),
    asc(financialCategories.name),
  );
}

export async function getFinancialCategoryById(
  id: string,
  sessionOverride?: UserSession | null,
): Promise<FinancialCategory | null> {
  await requirePermission(PERMISSIONS.FINANCE_CATEGORIES_READ, sessionOverride);

  const [category] = await db
    .select()
    .from(financialCategories)
    .where(eq(financialCategories.id, id))
    .limit(1);

  return category || null;
}

export async function createFinancialCategory(
  input: CreateFinancialCategoryInput,
  sessionOverride?: UserSession | null,
): Promise<FinancialCategory> {
  await requirePermission(
    PERMISSIONS.FINANCE_CATEGORIES_MANAGE,
    sessionOverride,
  );

  if (!input.name || input.name.trim().length === 0) {
    throw new Error("Category name is required");
  }

  if (input.type !== "income" && input.type !== "expense") {
    throw new Error(
      "Invalid financial category type. Must be 'income' or 'expense'",
    );
  }

  const slug = input.slug?.trim() || generateSlug(input.name);

  // Check unique slug
  const [existing] = await db
    .select()
    .from(financialCategories)
    .where(eq(financialCategories.slug, slug))
    .limit(1);

  if (existing) {
    throw new Error(`Category with slug "${slug}" already exists`);
  }

  const [created] = await db
    .insert(financialCategories)
    .values({
      name: input.name.trim(),
      slug,
      type: input.type,
      description: input.description ?? null,
      color: input.color ?? null,
      icon: input.icon ?? null,
      isActive: input.isActive ?? true,
      sortOrder: input.sortOrder ?? null,
    })
    .returning();

  if (!created) {
    throw new Error("Failed to create financial category");
  }

  return created;
}

export async function updateFinancialCategory(
  id: string,
  input: UpdateFinancialCategoryInput,
  sessionOverride?: UserSession | null,
): Promise<FinancialCategory> {
  await requirePermission(
    PERMISSIONS.FINANCE_CATEGORIES_MANAGE,
    sessionOverride,
  );

  const [current] = await db
    .select()
    .from(financialCategories)
    .where(eq(financialCategories.id, id))
    .limit(1);

  if (!current) {
    throw new Error("Financial category not found");
  }

  if (input.type && input.type !== "income" && input.type !== "expense") {
    throw new Error(
      "Invalid financial category type. Must be 'income' or 'expense'",
    );
  }

  let slug = input.slug?.trim();
  if (!slug && input.name && input.name !== current.name) {
    slug = generateSlug(input.name);
  }

  if (slug && slug !== current.slug) {
    const [existing] = await db
      .select()
      .from(financialCategories)
      .where(
        and(eq(financialCategories.slug, slug), ne(financialCategories.id, id)),
      )
      .limit(1);

    if (existing) {
      throw new Error(`Category with slug "${slug}" already exists`);
    }
  }

  const updateData: Partial<typeof financialCategories.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (input.name !== undefined) updateData.name = input.name.trim();
  if (slug !== undefined) updateData.slug = slug;
  if (input.type !== undefined) updateData.type = input.type;
  if (input.description !== undefined)
    updateData.description = input.description;
  if (input.color !== undefined) updateData.color = input.color;
  if (input.icon !== undefined) updateData.icon = input.icon;
  if (input.isActive !== undefined) updateData.isActive = input.isActive;
  if (input.sortOrder !== undefined) updateData.sortOrder = input.sortOrder;

  const [updated] = await db
    .update(financialCategories)
    .set(updateData)
    .where(eq(financialCategories.id, id))
    .returning();

  if (!updated) {
    throw new Error("Failed to update financial category");
  }

  return updated;
}

export async function toggleFinancialCategoryStatus(
  id: string,
  sessionOverride?: UserSession | null,
): Promise<FinancialCategory> {
  await requirePermission(
    PERMISSIONS.FINANCE_CATEGORIES_MANAGE,
    sessionOverride,
  );

  const [current] = await db
    .select()
    .from(financialCategories)
    .where(eq(financialCategories.id, id))
    .limit(1);

  if (!current) {
    throw new Error("Financial category not found");
  }

  const [updated] = await db
    .update(financialCategories)
    .set({
      isActive: !current.isActive,
      updatedAt: new Date(),
    })
    .where(eq(financialCategories.id, id))
    .returning();

  if (!updated) {
    throw new Error("Failed to toggle financial category status");
  }

  return updated;
}

export async function deleteFinancialCategory(
  id: string,
  sessionOverride?: UserSession | null,
): Promise<FinancialCategory> {
  await requirePermission(
    PERMISSIONS.FINANCE_CATEGORIES_MANAGE,
    sessionOverride,
  );

  // Check if transactions reference this category
  const existingTransactions = await db
    .select()
    .from(financialTransactions)
    .where(eq(financialTransactions.financialCategoryId, id));

  if (existingTransactions && existingTransactions.length > 0) {
    throw new RestrictedDeletionError();
  }

  const [deleted] = await db
    .delete(financialCategories)
    .where(eq(financialCategories.id, id))
    .returning();

  if (!deleted) {
    throw new Error("Failed to delete financial category");
  }

  return deleted;
}
