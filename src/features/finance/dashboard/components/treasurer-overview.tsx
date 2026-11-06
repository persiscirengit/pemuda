"use client";

import {
  ArrowDownLeft,
  ArrowUpRight,
  BookOpen,
  Plus,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { FinancialCategory } from "@/db/schema/finance";
import { FinancialTransactionDialog } from "@/features/finance/transactions/components/financial-transaction-dialog";
import type { FinanceSummary } from "@/server/dal/finance/analytics";

export interface TreasurerOverviewProps {
  summary: FinanceSummary;
  categories: FinancialCategory[];
}

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function TreasurerOverview({
  summary,
  categories,
}: TreasurerOverviewProps) {
  const t = useTranslations("finance");
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const cashFlowChartConfig = React.useMemo<ChartConfig>(
    () => ({
      incomeIdr: {
        label: t("income"),
        color: "var(--color-income, #10b981)",
      },
      expenseIdr: {
        label: t("expense"),
        color: "var(--color-expense, #f43f5e)",
      },
    }),
    [t],
  );

  const categoryChartConfig = React.useMemo<ChartConfig>(() => {
    const config: ChartConfig = {};
    for (const item of summary.categoryDistribution) {
      config[item.categoryId] = {
        label: item.categoryName,
        color: item.categoryColor || "var(--primary)",
      };
    }
    return config;
  }, [summary.categoryDistribution]);

  const defaultCategoryColors = [
    "#10b981",
    "#3b82f6",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#ec4899",
    "#06b6d4",
  ];

  return (
    <div className="space-y-6">
      {/* Quick Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button onClick={() => setDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            {t("recordTransaction")}
          </Button>
          <Button variant="outline" asChild className="gap-2">
            <Link href="/finance/transactions">
              <BookOpen className="h-4 w-4" />
              {t("viewLedger")}
            </Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/finance/categories">{t("manageCategories")}</Link>
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("kpiTotalIncome")}
            </CardTitle>
            <div className="rounded-full bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-400">
              <ArrowDownLeft className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {formatRupiah(summary.totalIncomeIdr)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t("incomeTab")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("kpiTotalExpense")}
            </CardTitle>
            <div className="rounded-full bg-rose-500/10 p-2 text-rose-600 dark:text-rose-400">
              <ArrowUpRight className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-rose-600 dark:text-rose-400">
              {formatRupiah(summary.totalExpenseIdr)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t("expenseTab")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("kpiNetBalance")}
            </CardTitle>
            <div className="rounded-full bg-primary/10 p-2 text-primary">
              <Wallet className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold font-mono ${
                summary.netBalanceIdr >= 0
                  ? "text-primary"
                  : "text-rose-600 dark:text-rose-400"
              }`}
            >
              {formatRupiah(summary.netBalanceIdr)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t("overviewTitle")}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Visual Analytics Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-7">
        {/* Cash Flow Timeline Chart */}
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>{t("cashFlowChartTitle")}</CardTitle>
            <CardDescription>{t("cashFlowChartDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            {summary.monthlyBuckets.length > 0 ? (
              <ChartContainer
                config={cashFlowChartConfig}
                className="h-[300px] w-full"
              >
                <AreaChart
                  data={summary.monthlyBuckets}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop
                        offset="95%"
                        stopColor="#10b981"
                        stopOpacity={0.0}
                      />
                    </linearGradient>
                    <linearGradient
                      id="expenseGrad"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4} />
                      <stop
                        offset="95%"
                        stopColor="#f43f5e"
                        stopOpacity={0.0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="yearMonth"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => `${Number(val) / 1000}k`}
                    width={50}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area
                    type="monotone"
                    dataKey="incomeIdr"
                    stroke="#10b981"
                    fillOpacity={1}
                    fill="url(#incomeGrad)"
                  />
                  <Area
                    type="monotone"
                    dataKey="expenseIdr"
                    stroke="#f43f5e"
                    fillOpacity={1}
                    fill="url(#expenseGrad)"
                  />
                </AreaChart>
              </ChartContainer>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
                {t("emptyTransactions")}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Category Breakdown Chart */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>{t("categoryDistributionTitle")}</CardTitle>
            <CardDescription>
              {t("categoryDistributionDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {summary.categoryDistribution.length > 0 ? (
              <ChartContainer
                config={categoryChartConfig}
                className="h-[300px] w-full"
              >
                <BarChart
                  data={summary.categoryDistribution}
                  layout="vertical"
                  margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis
                    type="number"
                    tickFormatter={(val) => `${Number(val) / 1000}k`}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="categoryName"
                    axisLine={false}
                    tickLine={false}
                    width={100}
                    tickMargin={6}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="totalAmountIdr" radius={[0, 4, 4, 0]}>
                    {summary.categoryDistribution.map((entry, index) => (
                      <Cell
                        key={`cell-${entry.categoryId}`}
                        fill={
                          entry.categoryColor ||
                          defaultCategoryColors[
                            index % defaultCategoryColors.length
                          ]
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
                {t("emptyTransactions")}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <FinancialTransactionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        categories={categories}
        onSuccess={() => router.refresh()}
      />
    </div>
  );
}
