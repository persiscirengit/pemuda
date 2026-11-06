import fs from "node:fs";
import path from "node:path";
import { getTableName } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

interface MockArticle {
  id: string;
  articleCategoryId: string | null;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string | null;
  bannerImage: string | null;
  youtubeUrl: string | null;
  status: "draft" | "published" | "archived";
  isFeatured: boolean;
  viewsCount: number;
  authorId: string | null;
  departmentId: string | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

interface MockActivity {
  id: string;
  title: string;
  topic: string | null;
  activityDate: string;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  status: string;
}

interface MockCategory {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  isActive: boolean;
}

interface ChunkObject {
  name?: string;
  value?: unknown;
  queryChunks?: unknown[];
}

const { mockArticlesState, mockActivitiesState, mockCategoriesState } =
  vi.hoisted(() => ({
    mockArticlesState: { items: [] as MockArticle[] },
    mockActivitiesState: { items: [] as MockActivity[] },
    mockCategoriesState: { items: [] as MockCategory[] },
  }));

function flattenChunks(chunks: unknown[]): unknown[] {
  let res: unknown[] = [];
  for (const c of chunks) {
    const chunk = c as ChunkObject;
    if (chunk?.queryChunks) {
      res = res.concat(flattenChunks(chunk.queryChunks));
    } else {
      res.push(c);
    }
  }
  return res;
}

function getChunkValue(c: unknown): unknown {
  if (!c) return c;
  if (typeof c === "string") return c;
  const obj = c as ChunkObject;
  if (typeof obj.name === "string") return obj.name;
  if ("value" in obj) {
    if (Array.isArray(obj.value)) return obj.value[0];
    return obj.value;
  }
  return c;
}

function filterArticlesByCondition(
  items: MockArticle[],
  cond: unknown,
): MockArticle[] {
  if (!cond) return [...items];
  const obj = cond as ChunkObject;
  const flat = flattenChunks(obj.queryChunks || []).map(getChunkValue);

  return items.filter((row) => {
    const deletedIdx = flat.indexOf("deleted_at");
    if (deletedIdx !== -1 && flat[deletedIdx + 1] === " is null") {
      if (row.deletedAt !== null) return false;
    }

    const idIdx = flat.indexOf("id");
    if (idIdx !== -1 && flat[idIdx + 1] === " = ") {
      if (row.id !== flat[idIdx + 2]) return false;
    }

    const slugIdx = flat.indexOf("slug");
    if (slugIdx !== -1 && flat[slugIdx + 1] === " = ") {
      if (row.slug !== flat[slugIdx + 2]) return false;
    }

    const statusIdx = flat.indexOf("status");
    if (statusIdx !== -1 && flat[statusIdx + 1] === " = ") {
      if (row.status !== flat[statusIdx + 2]) return false;
    }

    const featuredIdx = flat.indexOf("is_featured");
    if (featuredIdx !== -1 && flat[featuredIdx + 1] === " = ") {
      if (row.isFeatured !== flat[featuredIdx + 2]) return false;
    }

    const categoryIdx = flat.indexOf("article_category_id");
    if (categoryIdx !== -1 && flat[categoryIdx + 1] === " = ") {
      if (row.articleCategoryId !== flat[categoryIdx + 2]) return false;
    }

    const pubIdx = flat.indexOf("published_at");
    if (pubIdx !== -1 && flat[pubIdx + 1] === " <= ") {
      const targetDate = flat[pubIdx + 2];
      if (
        row.publishedAt === null ||
        (targetDate instanceof Date && row.publishedAt > targetDate)
      ) {
        return false;
      }
    }

    return true;
  });
}

function makeQueryObject<T>(items: T[]) {
  const basePromise = Promise.resolve(items);
  return Object.assign(basePromise, {
    orderBy: () => makeQueryObject(items),
    limit: (n: number) => makeQueryObject(items.slice(0, n)),
    where: (cond: unknown) => {
      // If items are articles
      if (items.length > 0 && "slug" in (items[0] as object)) {
        const filtered = filterArticlesByCondition(
          items as unknown as MockArticle[],
          cond,
        );
        return makeQueryObject(filtered as unknown as T[]);
      }
      return makeQueryObject(items);
    },
    leftJoin: () => makeQueryObject(items),
  });
}

vi.mock("@/db", () => {
  return {
    db: {
      select: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockImplementation((table) => {
          let tableName = "";
          try {
            tableName = getTableName(table);
          } catch {
            tableName = table?.name || "";
          }
          if (tableName === "activities") {
            const sched = mockActivitiesState.items.filter(
              (a) => a.status === "scheduled",
            );
            return makeQueryObject(sched);
          }
          if (tableName === "article_categories") {
            const active = mockCategoriesState.items.filter((c) => c.isActive);
            return makeQueryObject(active);
          }
          const nonDeleted = mockArticlesState.items.filter(
            (a) => a.deletedAt === null,
          );
          return makeQueryObject(nonDeleted);
        }),
      })),
      update: vi.fn().mockImplementation(() => ({
        set: vi.fn().mockImplementation((values) => ({
          where: vi.fn().mockImplementation((cond) => {
            const matched = filterArticlesByCondition(
              mockArticlesState.items,
              cond,
            );
            const target = matched[0];
            if (target) {
              const updated = { ...target };
              if ("viewsCount" in values) {
                // handles sql viewsCount + 1 or direct number
                updated.viewsCount = target.viewsCount + 1;
              }
              const idx = mockArticlesState.items.findIndex(
                (a) => a.id === target.id,
              );
              if (idx !== -1) mockArticlesState.items[idx] = updated;
              const p = Promise.resolve([updated]);
              return Object.assign(p, {
                returning: vi.fn().mockResolvedValue([updated]),
                execute: vi.fn().mockResolvedValue([updated]),
              });
            }
            const p = Promise.resolve([]);
            return Object.assign(p, {
              returning: vi.fn().mockResolvedValue([]),
              execute: vi.fn().mockResolvedValue([]),
            });
          }),
        })),
      })),
    },
  };
});

import {
  getFeaturedArticles,
  getPublicArticleBySlug,
  getPublicArticleCategories,
  getPublicArticles,
  getUpcomingPublicActivities,
} from "@/server/dal/content/public-articles";

describe("Public Articles DAL Specification", () => {
  beforeEach(() => {
    mockArticlesState.items = [
      {
        id: "art-1",
        articleCategoryId: "cat-1",
        title: "Published Article 1",
        slug: "published-article-1",
        excerpt: "Excerpt 1",
        content: "<p>Content 1</p>",
        bannerImage: "uploads/articles/b1.webp",
        youtubeUrl: null,
        status: "published",
        isFeatured: true,
        viewsCount: 10,
        authorId: "user-1",
        departmentId: null,
        publishedAt: new Date("2026-01-01T00:00:00Z"),
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date("2026-01-01T00:00:00Z"),
        deletedAt: null,
      },
      {
        id: "art-2",
        articleCategoryId: "cat-2",
        title: "Draft Article",
        slug: "draft-article",
        excerpt: "Draft excerpt",
        content: "<p>Draft content</p>",
        bannerImage: null,
        youtubeUrl: null,
        status: "draft",
        isFeatured: false,
        viewsCount: 0,
        authorId: "user-1",
        departmentId: null,
        publishedAt: null,
        createdAt: new Date("2026-01-02T00:00:00Z"),
        updatedAt: new Date("2026-01-02T00:00:00Z"),
        deletedAt: null,
      },
      {
        id: "art-3",
        articleCategoryId: "cat-1",
        title: "Archived Article",
        slug: "archived-article",
        excerpt: "Archived excerpt",
        content: "<p>Archived content</p>",
        bannerImage: null,
        youtubeUrl: null,
        status: "archived",
        isFeatured: true,
        viewsCount: 50,
        authorId: "user-1",
        departmentId: null,
        publishedAt: new Date("2025-01-01T00:00:00Z"),
        createdAt: new Date("2025-01-01T00:00:00Z"),
        updatedAt: new Date("2025-01-01T00:00:00Z"),
        deletedAt: null,
      },
      {
        id: "art-4",
        articleCategoryId: "cat-1",
        title: "Future Published Article",
        slug: "future-published-article",
        excerpt: "Future excerpt",
        content: "<p>Future content</p>",
        bannerImage: null,
        youtubeUrl: null,
        status: "published",
        isFeatured: false,
        viewsCount: 0,
        authorId: "user-1",
        departmentId: null,
        publishedAt: new Date(Date.now() + 86400000 * 7), // 7 days in future
        createdAt: new Date("2026-01-03T00:00:00Z"),
        updatedAt: new Date("2026-01-03T00:00:00Z"),
        deletedAt: null,
      },
      {
        id: "art-5",
        articleCategoryId: "cat-1",
        title: "Soft Deleted Published Article",
        slug: "soft-deleted-article",
        excerpt: "Deleted excerpt",
        content: "<p>Deleted content</p>",
        bannerImage: null,
        youtubeUrl: null,
        status: "published",
        isFeatured: true,
        viewsCount: 100,
        authorId: "user-1",
        departmentId: null,
        publishedAt: new Date("2026-01-01T00:00:00Z"),
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date("2026-01-01T00:00:00Z"),
        deletedAt: new Date("2026-01-04T00:00:00Z"),
      },
    ];

    mockActivitiesState.items = [
      {
        id: "act-1",
        title: "Weekly Quran Study",
        topic: "Surah Al-Mulk",
        activityDate: "2026-11-10",
        startTime: "18:30",
        endTime: "20:00",
        location: "Mosque",
        status: "scheduled",
      },
      {
        id: "act-2",
        title: "Past Activity",
        topic: "Completed",
        activityDate: "2026-10-01",
        startTime: "18:30",
        endTime: "20:00",
        location: "Mosque",
        status: "completed",
      },
    ];

    mockCategoriesState.items = [
      {
        id: "cat-1",
        name: "Tafsir",
        slug: "tafsir",
        color: "#10b981",
        isActive: true,
      },
      {
        id: "cat-2",
        name: "Inactive Category",
        slug: "inactive-category",
        color: null,
        isActive: false,
      },
    ];
  });

  it('mandates "server-only" import in DAL source file', () => {
    const dalPath = path.resolve(
      process.cwd(),
      "src/server/dal/content/public-articles.ts",
    );
    expect(fs.existsSync(dalPath)).toBe(true);
    const content = fs.readFileSync(dalPath, "utf-8");
    expect(content).toMatch(/import\s+["']server-only["']/);
  });

  describe("getPublicArticles", () => {
    it("returns only currently published non-deleted articles", async () => {
      const articles = await getPublicArticles();
      expect(articles.length).toBe(1);
      expect(articles[0]?.slug).toBe("published-article-1");
      expect(articles.some((a) => a.status !== "published")).toBe(false);
      expect(articles.some((a) => a.deletedAt !== null)).toBe(false);
    });

    it("filters articles by category", async () => {
      const cat1Articles = await getPublicArticles({ categoryId: "cat-1" });
      expect(cat1Articles.length).toBe(1);

      const cat2Articles = await getPublicArticles({ categoryId: "cat-2" });
      expect(cat2Articles.length).toBe(0);
    });
  });

  describe("getPublicArticleBySlug", () => {
    it("returns null for draft, archived, or soft-deleted articles", async () => {
      expect(await getPublicArticleBySlug("draft-article")).toBeNull();
      expect(await getPublicArticleBySlug("archived-article")).toBeNull();
      expect(await getPublicArticleBySlug("soft-deleted-article")).toBeNull();
      expect(await getPublicArticleBySlug("non-existent-slug")).toBeNull();
    });

    it("returns published article and increments viewsCount", async () => {
      const article = await getPublicArticleBySlug("published-article-1");
      expect(article).not.toBeNull();
      expect(article?.slug).toBe("published-article-1");

      // Verify views count incremented in mock db
      const item = mockArticlesState.items.find(
        (a) => a.slug === "published-article-1",
      );
      expect(item?.viewsCount).toBe(11);
    });
  });

  describe("getFeaturedArticles", () => {
    it("returns published featured articles up to limit", async () => {
      const featured = await getFeaturedArticles(3);
      expect(featured.length).toBe(1);
      expect(featured[0]?.isFeatured).toBe(true);
      expect(featured[0]?.status).toBe("published");
    });
  });

  describe("getUpcomingPublicActivities", () => {
    it("returns only scheduled activities up to limit", async () => {
      const activities = await getUpcomingPublicActivities(4);
      expect(activities.length).toBe(1);
      expect(activities[0]?.title).toBe("Weekly Quran Study");
      expect(activities[0]?.status).toBe("scheduled");
    });
  });

  describe("getPublicArticleCategories", () => {
    it("returns active categories ordered by name", async () => {
      const categories = await getPublicArticleCategories();
      expect(categories.length).toBe(1);
      expect(categories[0]?.name).toBe("Tafsir");
    });
  });
});
