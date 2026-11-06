"use server";

import { z } from "zod";
import { PERMISSIONS } from "@/lib/permissions";
import { createPermissionActionClient } from "@/lib/safe-action";
import {
  createFinancialCategory,
  deleteFinancialCategory,
  toggleFinancialCategoryStatus,
  updateFinancialCategory,
} from "@/server/dal/finance/categories";

const manageCategoryClient = createPermissionActionClient(
  PERMISSIONS.FINANCE_CATEGORIES_MANAGE,
);

const createFinancialCategorySchema = z.object({
  name: z.string().min(1, { message: "Name is required" }).max(100),
  slug: z.string().max(120).optional(),
  type: z.enum(["income", "expense"]),
  description: z.string().optional().nullable(),
  color: z.string().max(30).optional().nullable(),
  icon: z.string().max(50).optional().nullable(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional().nullable(),
});

const updateFinancialCategorySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, { message: "Name is required" }).max(100).optional(),
  slug: z.string().max(120).optional(),
  type: z.enum(["income", "expense"]).optional(),
  description: z.string().optional().nullable(),
  color: z.string().max(30).optional().nullable(),
  icon: z.string().max(50).optional().nullable(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional().nullable(),
});

const categoryIdSchema = z.object({
  id: z.string().uuid(),
});

export const createFinancialCategoryAction = manageCategoryClient
  .inputSchema(createFinancialCategorySchema)
  .action(async ({ parsedInput, ctx }) => {
    return await createFinancialCategory(parsedInput, {
      session: ctx.session,
      user: ctx.user,
    });
  });

export const updateFinancialCategoryAction = manageCategoryClient
  .inputSchema(updateFinancialCategorySchema)
  .action(async ({ parsedInput, ctx }) => {
    const { id, ...data } = parsedInput;
    return await updateFinancialCategory(id, data, {
      session: ctx.session,
      user: ctx.user,
    });
  });

export const toggleFinancialCategoryStatusAction = manageCategoryClient
  .inputSchema(categoryIdSchema)
  .action(async ({ parsedInput, ctx }) => {
    return await toggleFinancialCategoryStatus(parsedInput.id, {
      session: ctx.session,
      user: ctx.user,
    });
  });

export const deleteFinancialCategoryAction = manageCategoryClient
  .inputSchema(categoryIdSchema)
  .action(async ({ parsedInput, ctx }) => {
    return await deleteFinancialCategory(parsedInput.id, {
      session: ctx.session,
      user: ctx.user,
    });
  });
