import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { PERMISSIONS } from "@/lib/permissions";
import { UnauthorizedError } from "@/server/dal/auth";

interface MockArticleCat {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  color: string | null;
  isActive: boolean;
  sortOrder: number | null;
  createdAt: Date;
  updatedAt: Date;
}

interface ChunkObject {
  name?: string;
  value?: unknown;
  queryChunks?: unknown[];
}

const { mockArticleCategoriesState } = vi.hoisted(() => ({
  mockArticleCategoriesState: { items: [] as MockArticleCat[] },
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

function filterArticleCategoriesByCondition(
  items: MockArticleCat[],
  cond: unknown,
): MockArticleCat[] {
  if (!cond) return [...items];
  const obj = cond as ChunkObject;
  const flat = flattenChunks(obj.queryChunks || []).map(getChunkValue);
  return items.filter((row) => {
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
    const activeIdx = flat.indexOf("is_active");
    if (activeIdx !== -1 && flat[activeIdx + 1] === " = ") {
      if (row.isActive !== flat[activeIdx + 2]) return false;
    }
    return true;
  });
}

function makeArticleQuery() {
  const getItems = () => mockArticleCategoriesState.items;
  const basePromise = Promise.resolve(getItems());
  return Object.assign(basePromise, {
    orderBy: () => Promise.resolve(getItems()),
    where: (cond: unknown) => {
      const filtered = filterArticleCategoriesByCondition(
        mockArticleCategoriesState.items,
        cond,
      );
      const sub = Promise.resolve(filtered);
      return Object.assign(sub, {
        limit: (n: number) => Promise.resolve(filtered.slice(0, n)),
        orderBy: () => Promise.resolve(filtered),
      });
    },
  });
}

vi.mock("@/db", () => {
  return {
    db: {
      select: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockImplementation(() => makeArticleQuery()),
      })),
      insert: vi.fn().mockImplementation(() => ({
        values: vi.fn().mockImplementation((values) => {
          const inserted = {
            id: values.id || "018d0000-0000-7000-8000-000000000002",
            createdAt: new Date(),
            updatedAt: new Date(),
            ...values,
          };
          mockArticleCategoriesState.items.push(inserted);
          const p = Promise.resolve([inserted]);
          return Object.assign(p, {
            returning: vi.fn().mockResolvedValue([inserted]),
          });
        }),
      })),
      update: vi.fn().mockImplementation(() => ({
        set: vi.fn().mockImplementation((values) => ({
          where: vi.fn().mockImplementation((cond) => {
            const matched = filterArticleCategoriesByCondition(
              mockArticleCategoriesState.items,
              cond,
            );
            const target = matched[0] || mockArticleCategoriesState.items[0];
            const updated = { ...target, ...values, updatedAt: new Date() };
            const idx = mockArticleCategoriesState.items.findIndex(
              (c) => c.id === target?.id,
            );
            if (idx !== -1) mockArticleCategoriesState.items[idx] = updated;
            const p = Promise.resolve([updated]);
            return Object.assign(p, {
              returning: vi.fn().mockResolvedValue([updated]),
            });
          }),
        })),
      })),
      delete: vi.fn().mockImplementation(() => ({
        where: vi.fn().mockImplementation((cond) => {
          const matched = filterArticleCategoriesByCondition(
            mockArticleCategoriesState.items,
            cond,
          );
          const target = matched[0] || mockArticleCategoriesState.items[0];
          mockArticleCategoriesState.items =
            mockArticleCategoriesState.items.filter((c) => c.id !== target?.id);
          const p = Promise.resolve([target]);
          return Object.assign(p, {
            returning: vi.fn().mockResolvedValue([target]),
          });
        }),
      })),
    },
  };
});

import {
  createArticleCategory,
  deleteArticleCategory,
  getArticleCategories,
  getArticleCategoryById,
  toggleArticleCategoryStatus,
  updateArticleCategory,
} from "@/server/dal/content/categories";

describe("Article Categories DAL & Governance", () => {
  beforeEach(() => {
    mockArticleCategoriesState.items = [
      {
        id: "art-cat-1",
        name: "Quran Exegesis",
        slug: "quran-exegesis",
        description: "Articles explaining Quranic verses",
        color: "#059669",
        isActive: true,
        sortOrder: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
  });

  it("enforces 'server-only' import in src/server/dal/content/categories.ts", () => {
    const filePath = path.resolve(
      process.cwd(),
      "src/server/dal/content/categories.ts",
    );
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toMatch(/import\s+['"]server-only['"]/);
  });

  it("allows public queries without admin authentication", async () => {
    const categories = await getArticleCategories({ isPublic: true });
    expect(categories).toBeDefined();
    expect(Array.isArray(categories)).toBe(true);
  });

  it("enforces requirePermission(PERMISSIONS.CONTENT_CATEGORIES_READ) when query is not public", async () => {
    const unauthorizedSession = {
      session: {
        id: "s-anon",
        userId: "u-anon",
        token: "tok",
        expiresAt: new Date(),
      },
      user: {
        id: "u-anon",
        name: "Standard Member",
        email: "member@pemuda.local",
        emailVerified: true,
        roles: [
          {
            name: "member",
            permissions: [PERMISSIONS.ACTIVITIES_CHECKIN_SELF],
          },
        ],
      },
    };

    await expect(
      getArticleCategories({ isPublic: false }, unauthorizedSession),
    ).rejects.toThrow(UnauthorizedError);

    await expect(
      getArticleCategoryById("art-cat-1", false, unauthorizedSession),
    ).rejects.toThrow(UnauthorizedError);
  });

  it("auto-generates slug from name when slug is omitted", async () => {
    const session = {
      session: { id: "s1", userId: "u1", token: "tok", expiresAt: new Date() },
      user: {
        id: "u1",
        name: "Secretary",
        email: "secretary@pemuda.local",
        emailVerified: true,
        roles: [
          {
            name: "secretary",
            permissions: [PERMISSIONS.CONTENT_CATEGORIES_MANAGE],
          },
        ],
      },
    };

    const created = await createArticleCategory(
      {
        name: "Branch News & Announcements",
        description: "Official branch news",
      },
      session,
    );

    expect(created.slug).toBe("branch-news-announcements");
  });

  it("rejects duplicate slug when category with same slug exists", async () => {
    const session = {
      session: { id: "s1", userId: "u1", token: "tok", expiresAt: new Date() },
      user: {
        id: "u1",
        name: "Secretary",
        email: "secretary@pemuda.local",
        emailVerified: true,
        roles: [
          {
            name: "secretary",
            permissions: [PERMISSIONS.CONTENT_CATEGORIES_MANAGE],
          },
        ],
      },
    };

    await expect(
      createArticleCategory(
        {
          name: "Quran Exegesis",
          slug: "quran-exegesis",
        },
        session,
      ),
    ).rejects.toThrow(/already exists|duplicate/i);
  });

  it("enforces requirePermission(PERMISSIONS.CONTENT_CATEGORIES_MANAGE) on mutations", async () => {
    const readOnlySession = {
      session: {
        id: "s-reader",
        userId: "u-reader",
        token: "tok",
        expiresAt: new Date(),
      },
      user: {
        id: "u-reader",
        name: "Reader",
        email: "reader@pemuda.local",
        emailVerified: true,
        roles: [
          {
            name: "reader",
            permissions: [PERMISSIONS.CONTENT_CATEGORIES_READ],
          },
        ],
      },
    };

    await expect(
      createArticleCategory({ name: "Hadith Studies" }, readOnlySession),
    ).rejects.toThrow(UnauthorizedError);

    await expect(
      updateArticleCategory("art-cat-1", { name: "Updated" }, readOnlySession),
    ).rejects.toThrow(UnauthorizedError);

    await expect(
      toggleArticleCategoryStatus("art-cat-1", readOnlySession),
    ).rejects.toThrow(UnauthorizedError);

    await expect(
      deleteArticleCategory("art-cat-1", readOnlySession),
    ).rejects.toThrow(UnauthorizedError);
  });
});
