import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { PERMISSIONS } from "@/lib/permissions";
import { UnauthorizedError } from "@/server/dal/auth";

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

interface ChunkObject {
  name?: string;
  value?: unknown;
  queryChunks?: unknown[];
}

const { mockArticlesState } = vi.hoisted(() => ({
  mockArticlesState: { items: [] as MockArticle[] },
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
    // deleted_at is null check
    const deletedIdx = flat.indexOf("deleted_at");
    if (deletedIdx !== -1 && flat[deletedIdx + 1] === " is null") {
      if (row.deletedAt !== null) return false;
    }

    const idIdx = flat.indexOf("id");
    if (idIdx !== -1 && flat[idIdx + 1] === " = ") {
      if (row.id !== flat[idIdx + 2]) return false;
    }
    const notIdIdx = flat.indexOf("id");
    if (notIdIdx !== -1 && flat[notIdIdx + 1] === " <> ") {
      if (row.id === flat[notIdIdx + 2]) return false;
    }

    const slugIdx = flat.indexOf("slug");
    if (slugIdx !== -1 && flat[slugIdx + 1] === " = ") {
      if (row.slug !== flat[slugIdx + 2]) return false;
    }

    const statusIdx = flat.indexOf("status");
    if (statusIdx !== -1 && flat[statusIdx + 1] === " = ") {
      if (row.status !== flat[statusIdx + 2]) return false;
    }

    const categoryIdx = flat.indexOf("article_category_id");
    if (categoryIdx !== -1 && flat[categoryIdx + 1] === " = ") {
      if (row.articleCategoryId !== flat[categoryIdx + 2]) return false;
    }

    const deptIdx = flat.indexOf("department_id");
    if (deptIdx !== -1 && flat[deptIdx + 1] === " = ") {
      if (row.departmentId !== flat[deptIdx + 2]) return false;
    }

    return true;
  });
}

function makeArticleQuery() {
  const getItems = () =>
    mockArticlesState.items.filter((a) => a.deletedAt === null);

  const createQueryObject = (currentItems: MockArticle[]) => {
    const basePromise = Promise.resolve(currentItems);
    return Object.assign(basePromise, {
      orderBy: () => createQueryObject(currentItems),
      limit: (n: number) => Promise.resolve(currentItems.slice(0, n)),
      where: (cond: unknown) => {
        const filtered = filterArticlesByCondition(currentItems, cond);
        return createQueryObject(filtered);
      },
      leftJoin: () => createQueryObject(currentItems),
    });
  };

  return createQueryObject(getItems());
}

vi.mock("@/db", () => {
  return {
    db: {
      select: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockImplementation(() => makeArticleQuery()),
      })),
      insert: vi.fn().mockImplementation(() => ({
        values: vi.fn().mockImplementation((values) => {
          const inserted: MockArticle = {
            id: values.id || "018d0000-0000-7000-8000-000000000001",
            articleCategoryId: values.articleCategoryId ?? null,
            title: values.title,
            slug: values.slug,
            excerpt: values.excerpt ?? null,
            content: values.content ?? null,
            bannerImage: values.bannerImage ?? null,
            youtubeUrl: values.youtubeUrl ?? null,
            status: values.status || "draft",
            isFeatured: values.isFeatured || false,
            viewsCount: values.viewsCount || 0,
            authorId: values.authorId ?? null,
            departmentId: values.departmentId ?? null,
            publishedAt: values.publishedAt ?? null,
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
          };
          mockArticlesState.items.push(inserted);
          const p = Promise.resolve([inserted]);
          return Object.assign(p, {
            returning: vi.fn().mockResolvedValue([inserted]),
          });
        }),
      })),
      update: vi.fn().mockImplementation(() => ({
        set: vi.fn().mockImplementation((values) => ({
          where: vi.fn().mockImplementation((cond) => {
            const matched = filterArticlesByCondition(
              mockArticlesState.items,
              cond,
            );
            const target = matched[0] || mockArticlesState.items[0];
            const updated = { ...target, ...values, updatedAt: new Date() };
            const idx = mockArticlesState.items.findIndex(
              (a) => a.id === target?.id,
            );
            if (idx !== -1) mockArticlesState.items[idx] = updated;
            const p = Promise.resolve([updated]);
            return Object.assign(p, {
              returning: vi.fn().mockResolvedValue([updated]),
            });
          }),
        })),
      })),
      delete: vi.fn().mockImplementation(() => ({
        where: vi.fn().mockImplementation((cond) => {
          const matched = filterArticlesByCondition(
            mockArticlesState.items,
            cond,
          );
          const target = matched[0];
          if (target) {
            mockArticlesState.items = mockArticlesState.items.filter(
              (a) => a.id !== target.id,
            );
          }
          const p = Promise.resolve(target ? [target] : []);
          return Object.assign(p, {
            returning: vi.fn().mockResolvedValue(target ? [target] : []),
          });
        }),
      })),
    },
  };
});

import {
  createArticle,
  deleteArticle,
  getArticleById,
  getArticleBySlug,
  getArticles,
  publishArticle,
  updateArticle,
} from "@/server/dal/content/articles";

describe("Articles DAL Unit Tests", () => {
  const adminSession = {
    session: {
      id: "sess-admin",
      userId: "user-admin",
      token: "tok-admin",
      expiresAt: new Date(Date.now() + 86400000),
    },
    user: {
      id: "user-admin",
      name: "Admin",
      email: "admin@persis.org",
      emailVerified: true,
      roles: [
        {
          name: "Admin",
          permissions: [
            PERMISSIONS.CONTENT_ARTICLES_READ,
            PERMISSIONS.CONTENT_ARTICLES_CREATE,
            PERMISSIONS.CONTENT_ARTICLES_UPDATE,
            PERMISSIONS.CONTENT_ARTICLES_DELETE,
            PERMISSIONS.CONTENT_ARTICLES_PUBLISH,
          ],
        },
      ],
    },
  };

  const readOnlySession = {
    session: {
      id: "sess-reader",
      userId: "user-reader",
      token: "tok-reader",
      expiresAt: new Date(Date.now() + 86400000),
    },
    user: {
      id: "user-reader",
      name: "Reader",
      email: "reader@persis.org",
      emailVerified: true,
      roles: [
        {
          name: "Reader",
          permissions: [PERMISSIONS.CONTENT_ARTICLES_READ],
        },
      ],
    },
  };

  const noPermSession = {
    session: {
      id: "sess-none",
      userId: "user-none",
      token: "tok-none",
      expiresAt: new Date(Date.now() + 86400000),
    },
    user: {
      id: "user-none",
      name: "None",
      email: "none@persis.org",
      emailVerified: true,
      roles: [
        {
          name: "None",
          permissions: [] as string[],
        },
      ],
    },
  };

  beforeEach(() => {
    mockArticlesState.items = [
      {
        id: "art-1",
        articleCategoryId: "cat-1",
        title: "Congregational Prayer Guide",
        slug: "congregational-prayer-guide",
        excerpt: "Complete guide to congregational prayer",
        content: "<p>Content of study</p>",
        bannerImage: "uploads/articles/banner1.webp",
        youtubeUrl: null,
        status: "published",
        isFeatured: true,
        viewsCount: 150,
        authorId: "user-admin",
        departmentId: "dept-1",
        publishedAt: new Date("2026-01-01T00:00:00Z"),
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date("2026-01-01T00:00:00Z"),
        deletedAt: null,
      },
      {
        id: "art-2",
        articleCategoryId: "cat-1",
        title: "Draft Islamic Study",
        slug: "draft-islamic-study",
        excerpt: "Draft study article",
        content: "<p>Draft study article</p>",
        bannerImage: null,
        youtubeUrl: null,
        status: "draft",
        isFeatured: false,
        viewsCount: 0,
        authorId: "user-admin",
        departmentId: "dept-1",
        publishedAt: null,
        createdAt: new Date("2026-01-02T00:00:00Z"),
        updatedAt: new Date("2026-01-02T00:00:00Z"),
        deletedAt: null,
      },
    ];
  });

  it('mandates "server-only" import in DAL source file', () => {
    const dalPath = path.resolve(
      process.cwd(),
      "src/server/dal/content/articles.ts",
    );
    expect(fs.existsSync(dalPath)).toBe(true);
    const content = fs.readFileSync(dalPath, "utf-8");
    expect(content).toMatch(/import\s+["']server-only["']/);
  });

  describe("Permission Verification", () => {
    it("rejects unauthorized read access", async () => {
      await expect(getArticles({}, noPermSession)).rejects.toThrow(
        UnauthorizedError,
      );
    });

    it("allows authorized read access", async () => {
      const articles = await getArticles({}, readOnlySession);
      expect(Array.isArray(articles)).toBe(true);
      expect(articles.length).toBe(2);
    });

    it("rejects unauthorized creation", async () => {
      await expect(
        createArticle(
          { title: "Unauthorized Article", content: "<p>Test</p>" },
          readOnlySession,
        ),
      ).rejects.toThrow(UnauthorizedError);
    });

    it("rejects unauthorized update", async () => {
      await expect(
        updateArticle("art-1", { title: "Updated" }, readOnlySession),
      ).rejects.toThrow(UnauthorizedError);
    });

    it("rejects unauthorized delete", async () => {
      await expect(deleteArticle("art-1", readOnlySession)).rejects.toThrow(
        UnauthorizedError,
      );
    });

    it("rejects unauthorized publish", async () => {
      await expect(publishArticle("art-2", readOnlySession)).rejects.toThrow(
        UnauthorizedError,
      );
    });
  });

  describe("Slug Uniqueness & Auto-Generation", () => {
    it("auto-generates slug from title if omitted", async () => {
      const created = await createArticle(
        {
          title: "Virtues of Ramadan",
          content: "<p>Ramadan virtues</p>",
        },
        adminSession,
      );
      expect(created.slug).toBe("virtues-of-ramadan");
    });

    it("throws error when creating article with duplicate slug", async () => {
      await expect(
        createArticle(
          {
            title: "Congregational Prayer Guide",
            slug: "congregational-prayer-guide",
            content: "<p>Duplicate</p>",
          },
          adminSession,
        ),
      ).rejects.toThrow(/already exists/i);
    });

    it("throws error when updating article to an existing slug of another article", async () => {
      await expect(
        updateArticle(
          "art-2",
          { slug: "congregational-prayer-guide" },
          adminSession,
        ),
      ).rejects.toThrow(/already exists/i);
    });

    it("allows updating article keeping its own current slug", async () => {
      const updated = await updateArticle(
        "art-1",
        {
          title: "Congregational Prayer Guide Revised",
          slug: "congregational-prayer-guide",
        },
        adminSession,
      );
      expect(updated.title).toBe("Congregational Prayer Guide Revised");
      expect(updated.slug).toBe("congregational-prayer-guide");
    });
  });

  describe("Soft Delete & Lifecycle", () => {
    it("soft deletes article by setting deletedAt without purging row", async () => {
      const deleted = await deleteArticle("art-1", adminSession);
      expect(deleted.deletedAt).toBeInstanceOf(Date);

      // Verify row still exists in mock storage
      const foundInStorage = mockArticlesState.items.find(
        (a) => a.id === "art-1",
      );
      expect(foundInStorage).toBeDefined();
      expect(foundInStorage?.deletedAt).toBeInstanceOf(Date);
    });

    it("excludes soft-deleted articles from getArticles query", async () => {
      await deleteArticle("art-1", adminSession);
      const remaining = await getArticles({}, adminSession);
      expect(remaining.some((a) => a.id === "art-1")).toBe(false);
      expect(remaining.length).toBe(1);
    });

    it("returns null when fetching soft-deleted article by id or slug", async () => {
      await deleteArticle("art-1", adminSession);
      const byId = await getArticleById("art-1", false, adminSession);
      expect(byId).toBeNull();

      const bySlug = await getArticleBySlug(
        "congregational-prayer-guide",
        false,
        adminSession,
      );
      expect(bySlug).toBeNull();
    });

    it("publishes draft article setting status and publishedAt", async () => {
      const published = await publishArticle("art-2", adminSession);
      expect(published.status).toBe("published");
      expect(published.publishedAt).toBeInstanceOf(Date);
    });
  });
});
