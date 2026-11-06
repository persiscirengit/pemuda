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
  deletedAt: Date | null;
}

interface MockCat {
  id: string;
  name: string;
  color: string | null;
  type: "income" | "expense";
}

const { mockTxState, mockCatState } = vi.hoisted(() => ({
  mockTxState: { items: [] as MockTx[] },
  mockCatState: { items: [] as MockCat[] },
}));

vi.mock("@/db", () => {
  return {
    db: {
      select: vi.fn().mockImplementation(() => {
        return {
          from: vi.fn().mockImplementation(() => {
            return {
              leftJoin: vi.fn().mockReturnThis(),
              where: vi.fn().mockImplementation((_cond) => {
                const nonDeleted = mockTxState.items.filter(
                  (t) => t.deletedAt === null,
                );
                const mapped = nonDeleted.map((tx) => ({
                  transaction: tx,
                  category:
                    mockCatState.items.find(
                      (c) => c.id === tx.financialCategoryId,
                    ) || null,
                }));
                return Object.assign(Promise.resolve(mapped), {
                  orderBy: vi
                    .fn()
                    .mockImplementation(() => Promise.resolve(mapped)),
                });
              }),
            };
          }),
        };
      }),
    },
  };
});

import { getFinanceSummary } from "@/server/dal/finance/analytics";

describe("Treasurer Financial Analytics DAL Specification", () => {
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
          permissions: [PERMISSIONS.FINANCE_REPORTS_READ],
        },
      ],
    },
  };

  const unauthorizedSession = {
    session: { id: "s2", userId: "u2", token: "tok2", expiresAt: new Date() },
    user: {
      id: "u2",
      name: "Member",
      email: "member@pemuda.local",
      emailVerified: true,
      roles: [
        {
          name: "member",
          permissions: [],
        },
      ],
    },
  };

  beforeEach(() => {
    mockCatState.items = [
      { id: "cat-charity", name: "Charity", color: "#10b981", type: "income" },
      { id: "cat-dues", name: "Dues", color: "#3b82f6", type: "income" },
      { id: "cat-ops", name: "Operations", color: "#f59e0b", type: "expense" },
      { id: "cat-events", name: "Events", color: "#ef4444", type: "expense" },
    ];

    mockTxState.items = [
      // Jan 2026
      {
        id: "tx-1",
        type: "income",
        financialCategoryId: "cat-charity",
        amountIdr: 1000000,
        transactionDate: "2026-01-15",
        title: "Friday Charity Jan",
        deletedAt: null,
      },
      {
        id: "tx-2",
        type: "expense",
        financialCategoryId: "cat-ops",
        amountIdr: 400000,
        transactionDate: "2026-01-20",
        title: "Stationery Jan",
        deletedAt: null,
      },
      // Feb 2026
      {
        id: "tx-3",
        type: "income",
        financialCategoryId: "cat-dues",
        amountIdr: 1500000,
        transactionDate: "2026-02-10",
        title: "Member Dues Feb",
        deletedAt: null,
      },
      {
        id: "tx-4",
        type: "expense",
        financialCategoryId: "cat-events",
        amountIdr: 600000,
        transactionDate: "2026-02-18",
        title: "Annual Conference Expense",
        deletedAt: null,
      },
      // Soft-deleted entry (Must be excluded!)
      {
        id: "tx-deleted",
        type: "income",
        financialCategoryId: "cat-charity",
        amountIdr: 5000000,
        transactionDate: "2026-02-01",
        title: "Erroneous Charity",
        deletedAt: new Date("2026-02-02"),
      },
    ];
  });

  it("enforces 'server-only' import in src/server/dal/finance/analytics.ts", () => {
    const filePath = path.resolve(
      process.cwd(),
      "src/server/dal/finance/analytics.ts",
    );
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toMatch(/import\s+['"]server-only['"]/);
  });

  it("enforces requirePermission(PERMISSIONS.FINANCE_REPORTS_READ)", async () => {
    await expect(getFinanceSummary(undefined, undefined, null)).rejects.toThrow(
      UnauthenticatedError,
    );
    await expect(
      getFinanceSummary(undefined, undefined, unauthorizedSession),
    ).rejects.toThrow(UnauthorizedError);
  });

  it("calculates net balance accurately: Balance = sum(Income) - sum(Expenses)", async () => {
    const summary = await getFinanceSummary(
      undefined,
      undefined,
      treasurerSession,
    );

    // Income: 1,000,000 + 1,500,000 = 2,500,000
    expect(summary.totalIncomeIdr).toBe(2500000);
    // Expense: 400,000 + 600,000 = 1,000,000
    expect(summary.totalExpenseIdr).toBe(1000000);
    // Net: 2,500,000 - 1,000,000 = 1,500,000
    expect(summary.netBalanceIdr).toBe(1500000);
  });

  it("aggregates monthly time buckets chronologically", async () => {
    const summary = await getFinanceSummary(
      undefined,
      undefined,
      treasurerSession,
    );

    expect(summary.monthlyBuckets).toHaveLength(2);

    const jan = summary.monthlyBuckets.find((b) => b.yearMonth === "2026-01");
    expect(jan).toBeDefined();
    expect(jan?.incomeIdr).toBe(1000000);
    expect(jan?.expenseIdr).toBe(400000);
    expect(jan?.netIdr).toBe(600000);

    const feb = summary.monthlyBuckets.find((b) => b.yearMonth === "2026-02");
    expect(feb).toBeDefined();
    expect(feb?.incomeIdr).toBe(1500000);
    expect(feb?.expenseIdr).toBe(600000);
    expect(feb?.netIdr).toBe(900000);
  });

  it("computes category distribution with percentages", async () => {
    const summary = await getFinanceSummary(
      undefined,
      undefined,
      treasurerSession,
    );

    const incomeCategories = summary.categoryDistribution.filter(
      (c) => c.type === "income",
    );
    const charity = incomeCategories.find((c) => c.categoryName === "Charity");
    expect(charity?.totalAmountIdr).toBe(1000000);
    expect(charity?.percentage).toBe(40); // 1,000,000 / 2,500,000 = 40%

    const dues = incomeCategories.find((c) => c.categoryName === "Dues");
    expect(dues?.totalAmountIdr).toBe(1500000);
    expect(dues?.percentage).toBe(60); // 1,500,000 / 2,500,000 = 60%
  });
});
