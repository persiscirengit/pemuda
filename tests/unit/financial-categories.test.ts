import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { PERMISSIONS } from "@/lib/permissions";
import { UnauthorizedError } from "@/server/dal/auth";

interface MockCat {
  id: string;
  name: string;
  slug: string;
  type: "income" | "expense";
  description: string | null;
  color: string | null;
  icon: string | null;
  isActive: boolean;
  sortOrder: number | null;
  createdAt: Date;
  updatedAt: Date;
}

interface MockTx {
  id: string;
  financialCategoryId: string;
  amountIdr: number;
  transactionDate: string;
  title: string;
  type: "income" | "expense";
}

interface ChunkObject {
  name?: string;
  value?: unknown;
  queryChunks?: unknown[];
}

const { mockCategoriesState, mockTransactionsState } = vi.hoisted(() => ({
  mockCategoriesState: { items: [] as MockCat[] },
  mockTransactionsState: { items: [] as MockTx[] },
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

function filterCategoriesByCondition(
  items: MockCat[],
  cond: unknown,
): MockCat[] {
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
    const typeIdx = flat.indexOf("type");
    if (typeIdx !== -1 && flat[typeIdx + 1] === " = ") {
      if (row.type !== flat[typeIdx + 2]) return false;
    }
    const activeIdx = flat.indexOf("is_active");
    if (activeIdx !== -1 && flat[activeIdx + 1] === " = ") {
      if (row.isActive !== flat[activeIdx + 2]) return false;
    }
    return true;
  });
}

function filterTransactionsByCondition(
  items: MockTx[],
  cond: unknown,
): MockTx[] {
  if (!cond) return [...items];
  const obj = cond as ChunkObject;
  const flat = flattenChunks(obj.queryChunks || []).map(getChunkValue);
  return items.filter((row) => {
    const catIdx = flat.indexOf("financial_category_id");
    if (catIdx !== -1 && flat[catIdx + 1] === " = ") {
      if (row.financialCategoryId !== flat[catIdx + 2]) return false;
    }
    return true;
  });
}

function makeQuery(tableName: string) {
  const isTx = tableName === "financial_transactions";
  const getItems = () =>
    isTx ? mockTransactionsState.items : mockCategoriesState.items;

  const basePromise = Promise.resolve(getItems());
  return Object.assign(basePromise, {
    orderBy: () => Promise.resolve(getItems()),
    where: (cond: unknown) => {
      const filtered = isTx
        ? filterTransactionsByCondition(mockTransactionsState.items, cond)
        : filterCategoriesByCondition(mockCategoriesState.items, cond);
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
        from: vi.fn().mockImplementation((table) => {
          const tableName = table?.[Symbol.for("drizzle:Name")] || "";
          return makeQuery(tableName);
        }),
      })),
      insert: vi.fn().mockImplementation(() => ({
        values: vi.fn().mockImplementation((values) => {
          const inserted = {
            id: values.id || "018d0000-0000-7000-8000-000000000001",
            createdAt: new Date(),
            updatedAt: new Date(),
            ...values,
          };
          mockCategoriesState.items.push(inserted);
          const p = Promise.resolve([inserted]);
          return Object.assign(p, {
            returning: vi.fn().mockResolvedValue([inserted]),
          });
        }),
      })),
      update: vi.fn().mockImplementation(() => ({
        set: vi.fn().mockImplementation((values) => ({
          where: vi.fn().mockImplementation((cond) => {
            const matched = filterCategoriesByCondition(
              mockCategoriesState.items,
              cond,
            );
            const target = matched[0] || mockCategoriesState.items[0];
            const updated = { ...target, ...values, updatedAt: new Date() };
            const idx = mockCategoriesState.items.findIndex(
              (c) => c.id === target?.id,
            );
            if (idx !== -1) mockCategoriesState.items[idx] = updated;
            const p = Promise.resolve([updated]);
            return Object.assign(p, {
              returning: vi.fn().mockResolvedValue([updated]),
            });
          }),
        })),
      })),
      delete: vi.fn().mockImplementation(() => ({
        where: vi.fn().mockImplementation((cond) => {
          const matched = filterCategoriesByCondition(
            mockCategoriesState.items,
            cond,
          );
          const target = matched[0] || mockCategoriesState.items[0];
          mockCategoriesState.items = mockCategoriesState.items.filter(
            (c) => c.id !== target?.id,
          );
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
  createFinancialCategory,
  deleteFinancialCategory,
  getFinancialCategories,
  getFinancialCategoryById,
  RestrictedDeletionError,
  toggleFinancialCategoryStatus,
  updateFinancialCategory,
} from "@/server/dal/finance/categories";

describe("Financial Categories DAL & Governance", () => {
  beforeEach(() => {
    mockCategoriesState.items = [
      {
        id: "cat-1",
        name: "Friday Charity",
        slug: "friday-charity",
        type: "income",
        description: "Weekly Friday charity",
        color: "#10b981",
        icon: "Coins",
        isActive: true,
        sortOrder: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    mockTransactionsState.items = [];
  });

  it("enforces 'server-only' import in src/server/dal/finance/categories.ts", () => {
    const filePath = path.resolve(
      process.cwd(),
      "src/server/dal/finance/categories.ts",
    );
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toMatch(/import\s+['"]server-only['"]/);
  });

  it("requires valid type ('income' or 'expense') upon creation", async () => {
    const session = {
      session: { id: "s1", userId: "u1", token: "tok", expiresAt: new Date() },
      user: {
        id: "u1",
        name: "Treasurer",
        email: "treasurer@pemuda.local",
        emailVerified: true,
        roles: [
          {
            name: "treasurer",
            permissions: [PERMISSIONS.FINANCE_CATEGORIES_MANAGE],
          },
        ],
      },
    };

    await expect(
      createFinancialCategory(
        {
          name: "Invalid Type Cat",
          type: "investment" as unknown as "income",
        },
        session,
      ),
    ).rejects.toThrow();
  });

  it("auto-generates slug from name when slug is omitted", async () => {
    const session = {
      session: { id: "s1", userId: "u1", token: "tok", expiresAt: new Date() },
      user: {
        id: "u1",
        name: "Treasurer",
        email: "treasurer@pemuda.local",
        emailVerified: true,
        roles: [
          {
            name: "treasurer",
            permissions: [PERMISSIONS.FINANCE_CATEGORIES_MANAGE],
          },
        ],
      },
    };

    const created = await createFinancialCategory(
      {
        name: "Office Operations & Cleaning",
        type: "expense",
      },
      session,
    );

    expect(created.slug).toBe("office-operations-cleaning");
  });

  it("rejects duplicate slug when category with same slug exists", async () => {
    const session = {
      session: { id: "s1", userId: "u1", token: "tok", expiresAt: new Date() },
      user: {
        id: "u1",
        name: "Treasurer",
        email: "treasurer@pemuda.local",
        emailVerified: true,
        roles: [
          {
            name: "treasurer",
            permissions: [PERMISSIONS.FINANCE_CATEGORIES_MANAGE],
          },
        ],
      },
    };

    await expect(
      createFinancialCategory(
        {
          name: "Friday Charity",
          slug: "friday-charity",
          type: "income",
        },
        session,
      ),
    ).rejects.toThrow(/already exists|duplicate/i);
  });

  it("throws RestrictedDeletionError when category is referenced by existing transactions", async () => {
    const session = {
      session: { id: "s1", userId: "u1", token: "tok", expiresAt: new Date() },
      user: {
        id: "u1",
        name: "Treasurer",
        email: "treasurer@pemuda.local",
        emailVerified: true,
        roles: [
          {
            name: "treasurer",
            permissions: [PERMISSIONS.FINANCE_CATEGORIES_MANAGE],
          },
        ],
      },
    };

    mockTransactionsState.items = [
      {
        id: "tx-1",
        financialCategoryId: "cat-1",
        amountIdr: 50000,
        transactionDate: "2026-11-06",
        title: "Test Transaction",
        type: "income",
      },
    ];

    await expect(deleteFinancialCategory("cat-1", session)).rejects.toThrow(
      RestrictedDeletionError,
    );
  });

  it("deletes category successfully when no transactions reference it", async () => {
    const session = {
      session: { id: "s1", userId: "u1", token: "tok", expiresAt: new Date() },
      user: {
        id: "u1",
        name: "Treasurer",
        email: "treasurer@pemuda.local",
        emailVerified: true,
        roles: [
          {
            name: "treasurer",
            permissions: [PERMISSIONS.FINANCE_CATEGORIES_MANAGE],
          },
        ],
      },
    };

    mockTransactionsState.items = [];

    const deleted = await deleteFinancialCategory("cat-1", session);
    expect(deleted).toBeDefined();
  });

  it("enforces requirePermission(PERMISSIONS.FINANCE_CATEGORIES_READ) on queries", async () => {
    const unauthorizedSession = {
      session: { id: "s2", userId: "u2", token: "tok", expiresAt: new Date() },
      user: {
        id: "u2",
        name: "Standard Member",
        email: "member@pemuda.local",
        emailVerified: true,
        roles: [
          {
            name: "member",
            permissions: [PERMISSIONS.FINANCE_FEES_SELF],
          },
        ],
      },
    };

    await expect(
      getFinancialCategories({}, unauthorizedSession),
    ).rejects.toThrow(UnauthorizedError);

    await expect(
      getFinancialCategoryById("cat-1", unauthorizedSession),
    ).rejects.toThrow(UnauthorizedError);
  });

  it("enforces requirePermission(PERMISSIONS.FINANCE_CATEGORIES_MANAGE) on mutations", async () => {
    const readOnlySession = {
      session: { id: "s3", userId: "u3", token: "tok", expiresAt: new Date() },
      user: {
        id: "u3",
        name: "Auditor",
        email: "auditor@pemuda.local",
        emailVerified: true,
        roles: [
          {
            name: "auditor",
            permissions: [PERMISSIONS.FINANCE_CATEGORIES_READ],
          },
        ],
      },
    };

    await expect(
      createFinancialCategory({ name: "New", type: "income" }, readOnlySession),
    ).rejects.toThrow(UnauthorizedError);

    await expect(
      updateFinancialCategory("cat-1", { name: "Updated" }, readOnlySession),
    ).rejects.toThrow(UnauthorizedError);

    await expect(
      toggleFinancialCategoryStatus("cat-1", readOnlySession),
    ).rejects.toThrow(UnauthorizedError);

    await expect(
      deleteFinancialCategory("cat-1", readOnlySession),
    ).rejects.toThrow(UnauthorizedError);
  });
});
