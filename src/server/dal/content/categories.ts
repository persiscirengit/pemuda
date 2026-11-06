import "server-only";

import { and, asc, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { type ArticleCategory, articleCategories } from "@/db/schema/content";
import { PERMISSIONS } from "@/lib/permissions";
import { generateSlug } from "@/lib/slug";
import {
  publicQuery,
  requirePermission,
  type UserSession,
} from "@/server/dal/auth";

export interface GetArticleCategoriesParams {
  isPublic?: boolean;
  isActive?: boolean;
}

export interface CreateArticleCategoryInput {
  name: string;
  slug?: string;
  description?: string | null;
  color?: string | null;
  isActive?: boolean;
  sortOrder?: number | null;
}

export interface UpdateArticleCategoryInput {
  name?: string;
  slug?: string;
  description?: string | null;
  color?: string | null;
  isActive?: boolean;
  sortOrder?: number | null;
}

export async function getArticleCategories(
  params?: GetArticleCategoriesParams,
  sessionOverride?: UserSession | null,
): Promise<ArticleCategory[]> {
  if (params?.isPublic) {
    await publicQuery();
  } else {
    await requirePermission(
      PERMISSIONS.CONTENT_CATEGORIES_READ,
      sessionOverride,
    );
  }

  const conditions = [];

  if (params?.isActive !== undefined) {
    conditions.push(eq(articleCategories.isActive, params.isActive));
  }

  const query = db.select().from(articleCategories);

  if (conditions.length > 0) {
    return query
      .where(and(...conditions))
      .orderBy(asc(articleCategories.sortOrder), asc(articleCategories.name));
  }

  return query.orderBy(
    asc(articleCategories.sortOrder),
    asc(articleCategories.name),
  );
}

export async function getArticleCategoryById(
  id: string,
  isPublic = false,
  sessionOverride?: UserSession | null,
): Promise<ArticleCategory | null> {
  if (isPublic) {
    await publicQuery();
  } else {
    await requirePermission(
      PERMISSIONS.CONTENT_CATEGORIES_READ,
      sessionOverride,
    );
  }

  const [category] = await db
    .select()
    .from(articleCategories)
    .where(eq(articleCategories.id, id))
    .limit(1);

  return category || null;
}

export async function createArticleCategory(
  input: CreateArticleCategoryInput,
  sessionOverride?: UserSession | null,
): Promise<ArticleCategory> {
  await requirePermission(
    PERMISSIONS.CONTENT_CATEGORIES_MANAGE,
    sessionOverride,
  );

  if (!input.name || input.name.trim().length === 0) {
    throw new Error("Category name is required");
  }

  const slug = input.slug?.trim() || generateSlug(input.name);

  // Check unique slug
  const [existing] = await db
    .select()
    .from(articleCategories)
    .where(eq(articleCategories.slug, slug))
    .limit(1);

  if (existing) {
    throw new Error(`Category with slug "${slug}" already exists`);
  }

  const [created] = await db
    .insert(articleCategories)
    .values({
      name: input.name.trim(),
      slug,
      description: input.description ?? null,
      color: input.color ?? null,
      isActive: input.isActive ?? true,
      sortOrder: input.sortOrder ?? null,
    })
    .returning();

  if (!created) {
    throw new Error("Failed to create article category");
  }

  return created;
}

export async function updateArticleCategory(
  id: string,
  input: UpdateArticleCategoryInput,
  sessionOverride?: UserSession | null,
): Promise<ArticleCategory> {
  await requirePermission(
    PERMISSIONS.CONTENT_CATEGORIES_MANAGE,
    sessionOverride,
  );

  const [current] = await db
    .select()
    .from(articleCategories)
    .where(eq(articleCategories.id, id))
    .limit(1);

  if (!current) {
    throw new Error("Article category not found");
  }

  let slug = input.slug?.trim();
  if (!slug && input.name && input.name !== current.name) {
    slug = generateSlug(input.name);
  }

  if (slug && slug !== current.slug) {
    const [existing] = await db
      .select()
      .from(articleCategories)
      .where(
        and(eq(articleCategories.slug, slug), ne(articleCategories.id, id)),
      )
      .limit(1);

    if (existing) {
      throw new Error(`Category with slug "${slug}" already exists`);
    }
  }

  const updateData: Partial<typeof articleCategories.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (input.name !== undefined) updateData.name = input.name.trim();
  if (slug !== undefined) updateData.slug = slug;
  if (input.description !== undefined)
    updateData.description = input.description;
  if (input.color !== undefined) updateData.color = input.color;
  if (input.isActive !== undefined) updateData.isActive = input.isActive;
  if (input.sortOrder !== undefined) updateData.sortOrder = input.sortOrder;

  const [updated] = await db
    .update(articleCategories)
    .set(updateData)
    .where(eq(articleCategories.id, id))
    .returning();

  if (!updated) {
    throw new Error("Failed to update article category");
  }

  return updated;
}

export async function toggleArticleCategoryStatus(
  id: string,
  sessionOverride?: UserSession | null,
): Promise<ArticleCategory> {
  await requirePermission(
    PERMISSIONS.CONTENT_CATEGORIES_MANAGE,
    sessionOverride,
  );

  const [current] = await db
    .select()
    .from(articleCategories)
    .where(eq(articleCategories.id, id))
    .limit(1);

  if (!current) {
    throw new Error("Article category not found");
  }

  const [updated] = await db
    .update(articleCategories)
    .set({
      isActive: !current.isActive,
      updatedAt: new Date(),
    })
    .where(eq(articleCategories.id, id))
    .returning();

  if (!updated) {
    throw new Error("Failed to toggle article category status");
  }

  return updated;
}

export async function deleteArticleCategory(
  id: string,
  sessionOverride?: UserSession | null,
): Promise<ArticleCategory> {
  await requirePermission(
    PERMISSIONS.CONTENT_CATEGORIES_MANAGE,
    sessionOverride,
  );

  const [deleted] = await db
    .delete(articleCategories)
    .where(eq(articleCategories.id, id))
    .returning();

  if (!deleted) {
    throw new Error("Failed to delete article category");
  }

  return deleted;
}
