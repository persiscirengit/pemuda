import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { PERMISSIONS } from "@/lib/permissions";
import { UnauthenticatedError, UnauthorizedError } from "@/server/dal/auth";

interface MockTx {
  id: string;
  type: "income" | "expense";
  financialCategoryId: string;
  amountIdr: number;
  transactionDate: string;
  title: string;
  description: string | null;
  paymentMethod: "cash" | "transfer" | "other";
  referenceNo: string | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

interface MockCat {
  id: string;
  name: string;
  slug: string;
  type: "income" | "expense";
  isActive: boolean;
}

interface MockUser {
  id: string;
  name: string;
  email: string;
}

const { mockTxState, mockCatState, mockUserState } = vi.hoisted(() => ({
  mockTxState: { items: [] as MockTx[] },
  mockCatState: { items: [] as MockCat[] },
  mockUserState: { items: [] as MockUser[] },
}));

vi.mock("@/db", () => {
  return {
    db: {
      select: vi.fn().mockImplementation(() => {
        const queryBuilder = {
          from: vi.fn().mockImplementation((_table) => {
            return {
              leftJoin: vi.fn().mockReturnThis(),
              innerJoin: vi.fn().mockReturnThis(),
              where: vi.fn().mockImplementation((_cond) => {
                const items = mockTxState.items.filter(
                  (item) => item.deletedAt === null,
                );
                const mapped = items.map((tx) => ({
                  transaction: tx,
                  category:
                    mockCatState.items.find(
                      (c) => c.id === tx.financialCategoryId,
                    ) || null,
                  creator:
                    mockUserState.items.find((u) => u.id === tx.createdBy) ||
                    null,
                }));

                return Object.assign(Promise.resolve(mapped), {
                  orderBy: vi
                    .fn()
                    .mockImplementation(() => Promise.resolve(mapped)),
                  limit: vi
                    .fn()
                    .mockImplementation((n: number) =>
                      Promise.resolve(mapped.slice(0, n)),
                    ),
                  offset: vi.fn().mockReturnThis(),
                });
              }),
              orderBy: vi.fn().mockImplementation(() => {
                return mockTxState.items.map((tx) => ({
                  transaction: tx,
                  category:
                    mockCatState.items.find(
                      (c) => c.id === tx.financialCategoryId,
                    ) || null,
                  creator:
                    mockUserState.items.find((u) => u.id === tx.createdBy) ||
                    null,
                }));
              }),
            };
          }),
        };
        return queryBuilder;
      }),
      insert: vi.fn().mockImplementation(() => ({
        values: vi.fn().mockImplementation((values) => {
          const inserted: MockTx = {
            id: values.id || "018d0000-0000-7000-8000-000000000001",
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
            description: null,
            paymentMethod: "cash",
            referenceNo: null,
            createdBy: null,
            ...values,
          };
          mockTxState.items.push(inserted);
          return {
            returning: vi.fn().mockResolvedValue([inserted]),
          };
        }),
      })),
      update: vi.fn().mockImplementation(() => ({
        set: vi.fn().mockImplementation((values) => ({
          where: vi.fn().mockImplementation((_cond) => {
            const target = mockTxState.items[0];
            if (target) {
              Object.assign(target, values, { updatedAt: new Date() });
            }
            return {
              returning: vi.fn().mockResolvedValue(target ? [target] : []),
            };
          }),
        })),
      })),
    },
  };
});

import {
  createTransaction,
  deleteTransaction,
  getTransactionById,
  getTransactions,
  updateTransaction,
} from "@/server/dal/finance/transactions";

describe("Financial Transactions DAL & Audit Governance", () => {
  const treasurerSession = {
    session: { id: "s1", userId: "u1", token: "tok", expiresAt: new Date() },
    user: {
      id: "u1",
      name: "Treasurer",
      email: "treasurer@pemuda.local",
      emailVerified: true,
      roles: [
        {
          name: "treasurer",
          permissions: [
            PERMISSIONS.FINANCE_TRANSACTIONS_READ,
            PERMISSIONS.FINANCE_TRANSACTIONS_CREATE,
            PERMISSIONS.FINANCE_TRANSACTIONS_UPDATE,
            PERMISSIONS.FINANCE_TRANSACTIONS_DELETE,
          ],
        },
      ],
    },
  };

  const readOnlySession = {
    session: { id: "s2", userId: "u2", token: "tok2", expiresAt: new Date() },
    user: {
      id: "u2",
      name: "Auditor",
      email: "auditor@pemuda.local",
      emailVerified: true,
      roles: [
        {
          name: "auditor",
          permissions: [PERMISSIONS.FINANCE_TRANSACTIONS_READ],
        },
      ],
    },
  };

  beforeEach(() => {
    mockTxState.items = [
      {
        id: "tx-1",
        type: "income",
        financialCategoryId: "cat-1",
        amountIdr: 500000,
        transactionDate: "2026-03-01",
        title: "Friday Charity Inflow",
        description: "Weekly collection",
        paymentMethod: "cash",
        referenceNo: "INCOME-001",
        createdBy: "u1",
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      },
      {
        id: "tx-2",
        type: "expense",
        financialCategoryId: "cat-2",
        amountIdr: 150000,
        transactionDate: "2026-03-02",
        title: "Stationery Purchase",
        description: "Office supplies",
        paymentMethod: "transfer",
        referenceNo: "uploads/finance/receipt-1.webp",
        createdBy: "u1",
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      },
      {
        id: "tx-soft-deleted",
        type: "expense",
        financialCategoryId: "cat-2",
        amountIdr: 200000,
        transactionDate: "2026-03-03",
        title: "Cancelled Expense",
        description: "Erroneous entry",
        paymentMethod: "cash",
        referenceNo: null,
        createdBy: "u1",
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: new Date("2026-03-03T10:00:00Z"),
      },
    ];

    mockCatState.items = [
      {
        id: "cat-1",
        name: "Charity",
        slug: "charity",
        type: "income",
        isActive: true,
      },
      {
        id: "cat-2",
        name: "Operational",
        slug: "operational",
        type: "expense",
        isActive: true,
      },
    ];

    mockUserState.items = [
      { id: "u1", name: "Treasurer", email: "treasurer@pemuda.local" },
    ];
  });

  it("enforces 'server-only' import in src/server/dal/finance/transactions.ts", () => {
    const filePath = path.resolve(
      process.cwd(),
      "src/server/dal/finance/transactions.ts",
    );
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toMatch(/import\s+['"]server-only['"]/);
  });

  it("enforces RBAC permissions across all CRUD operations", async () => {
    await expect(getTransactions({}, null)).rejects.toThrow(
      UnauthenticatedError,
    );

    await expect(
      createTransaction(
        {
          type: "income",
          financialCategoryId: "cat-1",
          amountIdr: 10000,
          transactionDate: "2026-03-05",
          title: "Charity",
        },
        readOnlySession,
      ),
    ).rejects.toThrow(UnauthorizedError);

    await expect(
      updateTransaction("tx-1", { title: "Updated" }, readOnlySession),
    ).rejects.toThrow(UnauthorizedError);

    await expect(deleteTransaction("tx-1", readOnlySession)).rejects.toThrow(
      UnauthorizedError,
    );
  });

  it("requires valid non-negative integer amount greater than zero", async () => {
    await expect(
      createTransaction(
        {
          type: "income",
          financialCategoryId: "cat-1",
          amountIdr: 0,
          transactionDate: "2026-03-05",
          title: "Zero Amount",
        },
        treasurerSession,
      ),
    ).rejects.toThrow(/greater than 0/i);

    await expect(
      createTransaction(
        {
          type: "income",
          financialCategoryId: "cat-1",
          amountIdr: -50000,
          transactionDate: "2026-03-05",
          title: "Negative Amount",
        },
        treasurerSession,
      ),
    ).rejects.toThrow(/greater than 0/i);

    await expect(
      createTransaction(
        {
          type: "income",
          financialCategoryId: "cat-1",
          amountIdr: 10500.5,
          transactionDate: "2026-03-05",
          title: "Fractional Rupiah",
        },
        treasurerSession,
      ),
    ).rejects.toThrow(/integer/i);
  });

  it("soft delete sets deletedAt timestamp without removing row from database", async () => {
    const deleted = await deleteTransaction("tx-1", treasurerSession);
    expect(deleted.deletedAt).toBeInstanceOf(Date);
    const foundInDb = mockTxState.items.find((item) => item.id === "tx-1");
    expect(foundInDb).toBeDefined();
    expect(foundInDb?.deletedAt).toBeInstanceOf(Date);
  });

  it("excludes soft-deleted transactions from standard ledger lists", async () => {
    const list = await getTransactions({}, treasurerSession);
    const deletedItem = list.find((t) => t.id === "tx-soft-deleted");
    expect(deletedItem).toBeUndefined();
  });

  it("normalizes and handles relative storage key for receipt attachment", async () => {
    const tx = await createTransaction(
      {
        type: "expense",
        financialCategoryId: "cat-2",
        amountIdr: 75000,
        transactionDate: "2026-03-06",
        title: "Snacks",
        receiptAttachment: "uploads/finance/receipt-123.webp",
      },
      treasurerSession,
    );

    expect(tx.referenceNo).toBe("uploads/finance/receipt-123.webp");
  });

  it("fetches single transaction by id", async () => {
    const tx = await getTransactionById("tx-1", treasurerSession);
    expect(tx).toBeDefined();
    expect(tx?.id).toBe("tx-1");
  });
});
