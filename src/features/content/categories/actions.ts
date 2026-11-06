"use server";

import { z } from "zod";
import { PERMISSIONS } from "@/lib/permissions";
import { createPermissionActionClient } from "@/lib/safe-action";
import {
  createArticleCategory,
  deleteArticleCategory,
  toggleArticleCategoryStatus,
  updateArticleCategory,
} from "@/server/dal/content/categories";

const manageContentCategoryClient = createPermissionActionClient(
  PERMISSIONS.CONTENT_CATEGORIES_MANAGE,
);

const createArticleCategorySchema = z.object({
  name: z.string().min(1, { message: "Name is required" }).max(100),
  slug: z.string().max(120).optional(),
  description: z.string().optional().nullable(),
  color: z.string().max(30).optional().nullable(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional().nullable(),
});

const updateArticleCategorySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, { message: "Name is required" }).max(100).optional(),
  slug: z.string().max(120).optional(),
  description: z.string().optional().nullable(),
  color: z.string().max(30).optional().nullable(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional().nullable(),
});

const categoryIdSchema = z.object({
  id: z.string().uuid(),
});

export const createArticleCategoryAction = manageContentCategoryClient
  .inputSchema(createArticleCategorySchema)
  .action(async ({ parsedInput, ctx }) => {
    return await createArticleCategory(parsedInput, {
      session: ctx.session,
      user: ctx.user,
    });
  });

export const updateArticleCategoryAction = manageContentCategoryClient
  .inputSchema(updateArticleCategorySchema)
  .action(async ({ parsedInput, ctx }) => {
    const { id, ...data } = parsedInput;
    return await updateArticleCategory(id, data, {
      session: ctx.session,
      user: ctx.user,
    });
  });

export const toggleArticleCategoryStatusAction = manageContentCategoryClient
  .inputSchema(categoryIdSchema)
  .action(async ({ parsedInput, ctx }) => {
    return await toggleArticleCategoryStatus(parsedInput.id, {
      session: ctx.session,
      user: ctx.user,
    });
  });

export const deleteArticleCategoryAction = manageContentCategoryClient
  .inputSchema(categoryIdSchema)
  .action(async ({ parsedInput, ctx }) => {
    return await deleteArticleCategory(parsedInput.id, {
      session: ctx.session,
      user: ctx.user,
    });
  });
