import "server-only";

import { and, asc, eq, gte, isNull, lte } from "drizzle-orm";
import { db } from "@/db";
import {
  financialCategories,
  financialTransactions,
} from "@/db/schema/finance";
import { PERMISSIONS } from "@/lib/permissions";
import { requirePermission, type UserSession } from "@/server/dal/auth";

export interface MonthlyCashFlowBucket {
  yearMonth: string; // "YYYY-MM"
  incomeIdr: number;
  expenseIdr: number;
  netIdr: number;
}

export interface CategoryDistributionItem {
  categoryId: string;
  categoryName: string;
  categoryColor: string | null;
  type: "income" | "expense";
  totalAmountIdr: number;
  percentage: number;
}

export interface FinanceSummary {
  totalIncomeIdr: number;
  totalExpenseIdr: number;
  netBalanceIdr: number;
  monthlyBuckets: MonthlyCashFlowBucket[];
  categoryDistribution: CategoryDistributionItem[];
  recentTransactionsCount: number;
}

export async function getFinanceSummary(
  startDate?: string,
  endDate?: string,
  sessionOverride?: UserSession | null,
): Promise<FinanceSummary> {
  await requirePermission(PERMISSIONS.FINANCE_REPORTS_READ, sessionOverride);

  const conditions = [isNull(financialTransactions.deletedAt)];

  if (startDate) {
    conditions.push(gte(financialTransactions.transactionDate, startDate));
  }

  if (endDate) {
    conditions.push(lte(financialTransactions.transactionDate, endDate));
  }

  const rows = await db
    .select({
      transaction: financialTransactions,
      category: {
        id: financialCategories.id,
        name: financialCategories.name,
        color: financialCategories.color,
      },
    })
    .from(financialTransactions)
    .leftJoin(
      financialCategories,
      eq(financialTransactions.financialCategoryId, financialCategories.id),
    )
    .where(and(...conditions))
    .orderBy(asc(financialTransactions.transactionDate));

  let totalIncomeIdr = 0;
  let totalExpenseIdr = 0;

  const monthlyMap = new Map<
    string,
    { incomeIdr: number; expenseIdr: number }
  >();

  const categoryMap = new Map<
    string,
    {
      categoryId: string;
      categoryName: string;
      categoryColor: string | null;
      type: "income" | "expense";
      totalAmountIdr: number;
    }
  >();

  for (const { transaction, category } of rows) {
    const amount = Number(transaction.amountIdr);
    const dateStr =
      typeof transaction.transactionDate === "string"
        ? transaction.transactionDate
        : new Date(transaction.transactionDate).toISOString().slice(0, 10);
    const yearMonth = dateStr.slice(0, 7);

    if (transaction.type === "income") {
      totalIncomeIdr += amount;
    } else {
      totalExpenseIdr += amount;
    }

    // Monthly bucket aggregation
    const currentMonth = monthlyMap.get(yearMonth) ?? {
      incomeIdr: 0,
      expenseIdr: 0,
    };
    if (transaction.type === "income") {
      currentMonth.incomeIdr += amount;
    } else {
      currentMonth.expenseIdr += amount;
    }
    monthlyMap.set(yearMonth, currentMonth);

    // Category distribution
    const catId = category?.id ?? transaction.financialCategoryId;
    const catName = category?.name ?? "Uncategorized";
    const catColor = category?.color ?? null;

    const currentCat = categoryMap.get(catId) ?? {
      categoryId: catId,
      categoryName: catName,
      categoryColor: catColor,
      type: transaction.type,
      totalAmountIdr: 0,
    };
    currentCat.totalAmountIdr += amount;
    categoryMap.set(catId, currentCat);
  }

  const monthlyBuckets: MonthlyCashFlowBucket[] = Array.from(
    monthlyMap.entries(),
  )
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([yearMonth, { incomeIdr, expenseIdr }]) => ({
      yearMonth,
      incomeIdr,
      expenseIdr,
      netIdr: incomeIdr - expenseIdr,
    }));

  const categoryDistribution: CategoryDistributionItem[] = Array.from(
    categoryMap.values(),
  ).map((cat) => {
    const typeTotal = cat.type === "income" ? totalIncomeIdr : totalExpenseIdr;
    const percentage =
      typeTotal > 0 ? Math.round((cat.totalAmountIdr / typeTotal) * 100) : 0;
    return {
      ...cat,
      percentage,
    };
  });

  return {
    totalIncomeIdr,
    totalExpenseIdr,
    netBalanceIdr: totalIncomeIdr - totalExpenseIdr,
    monthlyBuckets,
    categoryDistribution,
    recentTransactionsCount: rows.length,
  };
}
