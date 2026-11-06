import "server-only";

import { and, asc, desc, eq, ilike, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { type Activity, activities } from "@/db/schema/activities";
import { users } from "@/db/schema/auth";
import {
  type Article,
  type ArticleCategory,
  articleCategories,
  articles,
} from "@/db/schema/content";
import { publicQuery } from "@/server/dal/auth";

export interface GetPublicArticlesParams {
  search?: string;
  categoryId?: string;
  categorySlug?: string;
  limit?: number;
  offset?: number;
}

export interface PublicArticleWithDetails extends Article {
  category?: {
    id: string;
    name: string;
    slug: string;
    color?: string | null;
  } | null;
  authorName?: string | null;
}

/**
 * Resolves published educational articles for public readership.
 * Excludes draft, archived, future-scheduled, and soft-deleted articles.
 */
export async function getPublicArticles(
  params?: GetPublicArticlesParams,
): Promise<Article[]> {
  await publicQuery();

  const now = new Date();
  const conditions = [
    eq(articles.status, "published"),
    lte(articles.publishedAt, now),
    isNull(articles.deletedAt),
  ];

  if (params?.categoryId) {
    conditions.push(eq(articles.articleCategoryId, params.categoryId));
  }

  if (params?.categorySlug) {
    const [matchedCategory] = await db
      .select({ id: articleCategories.id })
      .from(articleCategories)
      .where(eq(articleCategories.slug, params.categorySlug))
      .limit(1);

    if (matchedCategory) {
      conditions.push(eq(articles.articleCategoryId, matchedCategory.id));
    } else {
      // Non-existent category slug returns empty list
      return [];
    }
  }

  if (params?.search && params.search.trim().length > 0) {
    const q = `%${params.search.trim()}%`;
    const searchCond = or(ilike(articles.title, q), ilike(articles.excerpt, q));
    if (searchCond) {
      conditions.push(searchCond);
    }
  }

  const query = db
    .select()
    .from(articles)
    .where(and(...conditions))
    .orderBy(desc(articles.publishedAt), desc(articles.createdAt));

  if (params?.limit) {
    query.limit(params.limit);
  }

  return await query;
}

/**
 * Resolves a single public article by its URL slug.
 * Increments the article's view count automatically.
 */
export async function getPublicArticleBySlug(
  slug: string,
): Promise<PublicArticleWithDetails | null> {
  await publicQuery();

  const now = new Date();
  const [row] = await db
    .select()
    .from(articles)
    .where(
      and(
        eq(articles.slug, slug),
        eq(articles.status, "published"),
        lte(articles.publishedAt, now),
        isNull(articles.deletedAt),
      ),
    )
    .limit(1);

  if (!row) {
    return null;
  }

  // Increment view counter asynchronously
  db.update(articles)
    .set({
      viewsCount: sql`${articles.viewsCount} + 1`,
    })
    .where(eq(articles.id, row.id))
    .then(() => {})
    .catch(() => {});

  let category: PublicArticleWithDetails["category"] = null;
  if (row.articleCategoryId) {
    const [cat] = await db
      .select({
        id: articleCategories.id,
        name: articleCategories.name,
        slug: articleCategories.slug,
        color: articleCategories.color,
      })
      .from(articleCategories)
      .where(eq(articleCategories.id, row.articleCategoryId))
      .limit(1);

    if (cat) category = cat;
  }

  let authorName: string | null = null;
  if (row.authorId) {
    const [usr] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, row.authorId))
      .limit(1);

    if (usr) authorName = usr.name;
  }

  return {
    ...row,
    viewsCount: row.viewsCount + 1,
    category,
    authorName,
  };
}

/**
 * Resolves highlighted articles for the homepage showcase.
 */
export async function getFeaturedArticles(limit = 3): Promise<Article[]> {
  await publicQuery();

  const now = new Date();
  return await db
    .select()
    .from(articles)
    .where(
      and(
        eq(articles.status, "published"),
        eq(articles.isFeatured, true),
        lte(articles.publishedAt, now),
        isNull(articles.deletedAt),
      ),
    )
    .orderBy(desc(articles.publishedAt))
    .limit(limit);
}

/**
 * Resolves upcoming scheduled activities for public schedule displays.
 */
export async function getUpcomingPublicActivities(
  limit = 4,
): Promise<Activity[]> {
  await publicQuery();

  return await db
    .select()
    .from(activities)
    .where(eq(activities.status, "scheduled"))
    .orderBy(asc(activities.activityDate), asc(activities.startTime))
    .limit(limit);
}

/**
 * Resolves active article categories for public filtering.
 */
export async function getPublicArticleCategories(): Promise<ArticleCategory[]> {
  await publicQuery();

  return await db
    .select()
    .from(articleCategories)
    .where(eq(articleCategories.isActive, true))
    .orderBy(asc(articleCategories.name));
}
