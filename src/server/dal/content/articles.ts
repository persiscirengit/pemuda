import "server-only";

import { and, desc, eq, ilike, isNull, ne, or } from "drizzle-orm";
import sanitizeHtml from "sanitize-html";
import { db } from "@/db";
import { type Article, articles } from "@/db/schema/content";
import { PERMISSIONS } from "@/lib/permissions";
import { calculateReadingTimeMinutes } from "@/lib/reading-time";
import { generateSlug } from "@/lib/slug";
import {
  publicQuery,
  requirePermission,
  type UserSession,
} from "@/server/dal/auth";

export { calculateReadingTimeMinutes };

export interface GetArticlesParams {
  search?: string;
  categoryId?: string;
  departmentId?: string;
  status?: "draft" | "published" | "archived";
  authorId?: string;
  isFeatured?: boolean;
  isPublic?: boolean;
}

export interface CreateArticleInput {
  title: string;
  slug?: string;
  excerpt?: string | null;
  content?: string | null;
  bannerImage?: string | null;
  youtubeUrl?: string | null;
  status?: "draft" | "published" | "archived";
  isFeatured?: boolean;
  articleCategoryId?: string | null;
  departmentId?: string | null;
  authorId?: string | null;
  publishedAt?: Date | null;
}

export interface UpdateArticleInput {
  title?: string;
  slug?: string;
  excerpt?: string | null;
  content?: string | null;
  bannerImage?: string | null;
  youtubeUrl?: string | null;
  status?: "draft" | "published" | "archived";
  isFeatured?: boolean;
  articleCategoryId?: string | null;
  departmentId?: string | null;
  authorId?: string | null;
  publishedAt?: Date | null;
}

/**
 * Sanitizes rich HTML for organizational bulletin and Islamic studies articles.
 * Enforces strict XSS protections while preserving Arabic typography, RTL directionality,
 * and responsive callouts.
 */
export function sanitizeArticleContent(rawHtml: string): string {
  if (!rawHtml) return "";
  return sanitizeHtml(rawHtml, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      "img",
      "h1",
      "h2",
      "h3",
      "div",
      "span",
    ]),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      "*": ["class", "dir", "lang"],
      img: ["src", "alt", "title", "width", "height"],
    },
    allowedClasses: {
      div: ["arabic", "callout", "text-center"],
      p: ["arabic", "lead"],
      span: ["arabic"],
      blockquote: ["arabic"],
    },
  });
}

export async function getArticles(
  params?: GetArticlesParams,
  sessionOverride?: UserSession | null,
): Promise<Article[]> {
  if (params?.isPublic) {
    await publicQuery();
  } else {
    await requirePermission(PERMISSIONS.CONTENT_ARTICLES_READ, sessionOverride);
  }

  const conditions = [isNull(articles.deletedAt)];

  if (params?.isPublic) {
    conditions.push(eq(articles.status, "published"));
  } else if (params?.status) {
    conditions.push(eq(articles.status, params.status));
  }

  if (params?.categoryId) {
    conditions.push(eq(articles.articleCategoryId, params.categoryId));
  }

  if (params?.departmentId) {
    conditions.push(eq(articles.departmentId, params.departmentId));
  }

  if (params?.authorId) {
    conditions.push(eq(articles.authorId, params.authorId));
  }

  if (params?.isFeatured !== undefined) {
    conditions.push(eq(articles.isFeatured, params.isFeatured));
  }

  if (params?.search && params.search.trim().length > 0) {
    const q = `%${params.search.trim()}%`;
    const searchCond = or(ilike(articles.title, q), ilike(articles.excerpt, q));
    if (searchCond) {
      conditions.push(searchCond);
    }
  }

  const query = db.select().from(articles);

  return query
    .where(and(...conditions))
    .orderBy(desc(articles.publishedAt), desc(articles.createdAt));
}

export async function getArticleById(
  id: string,
  isPublic = false,
  sessionOverride?: UserSession | null,
): Promise<Article | null> {
  if (isPublic) {
    await publicQuery();
  } else {
    await requirePermission(PERMISSIONS.CONTENT_ARTICLES_READ, sessionOverride);
  }

  const conditions = [eq(articles.id, id), isNull(articles.deletedAt)];
  if (isPublic) {
    conditions.push(eq(articles.status, "published"));
  }

  const [article] = await db
    .select()
    .from(articles)
    .where(and(...conditions))
    .limit(1);

  return article || null;
}

export async function getArticleBySlug(
  slug: string,
  isPublic = false,
  sessionOverride?: UserSession | null,
): Promise<Article | null> {
  if (isPublic) {
    await publicQuery();
  } else {
    await requirePermission(PERMISSIONS.CONTENT_ARTICLES_READ, sessionOverride);
  }

  const conditions = [eq(articles.slug, slug), isNull(articles.deletedAt)];
  if (isPublic) {
    conditions.push(eq(articles.status, "published"));
  }

  const [article] = await db
    .select()
    .from(articles)
    .where(and(...conditions))
    .limit(1);

  return article || null;
}

export async function createArticle(
  input: CreateArticleInput,
  sessionOverride?: UserSession | null,
): Promise<Article> {
  await requirePermission(PERMISSIONS.CONTENT_ARTICLES_CREATE, sessionOverride);

  if (!input.title || input.title.trim().length === 0) {
    throw new Error("Article title is required");
  }

  const slug = input.slug?.trim() || generateSlug(input.title);

  // Check unique slug
  const [existing] = await db
    .select()
    .from(articles)
    .where(eq(articles.slug, slug))
    .limit(1);

  if (existing) {
    throw new Error(`Article with slug "${slug}" already exists`);
  }

  const sanitizedContent = input.content
    ? sanitizeArticleContent(input.content)
    : null;

  const status = input.status || "draft";
  let publishedAt = input.publishedAt ?? null;
  if (status === "published" && !publishedAt) {
    publishedAt = new Date();
  }

  const [created] = await db
    .insert(articles)
    .values({
      title: input.title.trim(),
      slug,
      excerpt: input.excerpt?.trim() ?? null,
      content: sanitizedContent,
      bannerImage: input.bannerImage ?? null,
      youtubeUrl: input.youtubeUrl?.trim() ?? null,
      status,
      isFeatured: input.isFeatured ?? false,
      articleCategoryId: input.articleCategoryId ?? null,
      departmentId: input.departmentId ?? null,
      authorId: input.authorId ?? null,
      publishedAt,
    })
    .returning();

  if (!created) {
    throw new Error("Failed to create article");
  }

  return created;
}

export async function updateArticle(
  id: string,
  input: UpdateArticleInput,
  sessionOverride?: UserSession | null,
): Promise<Article> {
  await requirePermission(PERMISSIONS.CONTENT_ARTICLES_UPDATE, sessionOverride);

  const [current] = await db
    .select()
    .from(articles)
    .where(and(eq(articles.id, id), isNull(articles.deletedAt)))
    .limit(1);

  if (!current) {
    throw new Error("Article not found");
  }

  let slug = input.slug?.trim();
  if (!slug && input.title && input.title !== current.title) {
    slug = generateSlug(input.title);
  }

  if (slug && slug !== current.slug) {
    const [existing] = await db
      .select()
      .from(articles)
      .where(and(eq(articles.slug, slug), ne(articles.id, id)))
      .limit(1);

    if (existing) {
      throw new Error(`Article with slug "${slug}" already exists`);
    }
  }

  const updateData: Partial<typeof articles.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (input.title !== undefined) updateData.title = input.title.trim();
  if (slug !== undefined) updateData.slug = slug;
  if (input.excerpt !== undefined)
    updateData.excerpt = input.excerpt?.trim() ?? null;
  if (input.content !== undefined) {
    updateData.content = input.content
      ? sanitizeArticleContent(input.content)
      : null;
  }
  if (input.bannerImage !== undefined)
    updateData.bannerImage = input.bannerImage;
  if (input.youtubeUrl !== undefined)
    updateData.youtubeUrl = input.youtubeUrl?.trim() ?? null;
  if (input.status !== undefined) {
    updateData.status = input.status;
    if (
      input.status === "published" &&
      !current.publishedAt &&
      !input.publishedAt
    ) {
      updateData.publishedAt = new Date();
    }
  }
  if (input.isFeatured !== undefined) updateData.isFeatured = input.isFeatured;
  if (input.articleCategoryId !== undefined)
    updateData.articleCategoryId = input.articleCategoryId;
  if (input.departmentId !== undefined)
    updateData.departmentId = input.departmentId;
  if (input.authorId !== undefined) updateData.authorId = input.authorId;
  if (input.publishedAt !== undefined)
    updateData.publishedAt = input.publishedAt;

  const [updated] = await db
    .update(articles)
    .set(updateData)
    .where(eq(articles.id, id))
    .returning();

  if (!updated) {
    throw new Error("Failed to update article");
  }

  return updated;
}

export async function deleteArticle(
  id: string,
  sessionOverride?: UserSession | null,
): Promise<Article> {
  await requirePermission(PERMISSIONS.CONTENT_ARTICLES_DELETE, sessionOverride);

  const [current] = await db
    .select()
    .from(articles)
    .where(and(eq(articles.id, id), isNull(articles.deletedAt)))
    .limit(1);

  if (!current) {
    throw new Error("Article not found");
  }

  const [deleted] = await db
    .update(articles)
    .set({
      deletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(articles.id, id))
    .returning();

  if (!deleted) {
    throw new Error("Failed to delete article");
  }

  return deleted;
}

export async function publishArticle(
  id: string,
  sessionOverride?: UserSession | null,
): Promise<Article> {
  await requirePermission(
    PERMISSIONS.CONTENT_ARTICLES_PUBLISH,
    sessionOverride,
  );

  const [current] = await db
    .select()
    .from(articles)
    .where(and(eq(articles.id, id), isNull(articles.deletedAt)))
    .limit(1);

  if (!current) {
    throw new Error("Article not found");
  }

  const [published] = await db
    .update(articles)
    .set({
      status: "published",
      publishedAt: current.publishedAt || new Date(),
      updatedAt: new Date(),
    })
    .where(eq(articles.id, id))
    .returning();

  if (!published) {
    throw new Error("Failed to publish article");
  }

  return published;
}
