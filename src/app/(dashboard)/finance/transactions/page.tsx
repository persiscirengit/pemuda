import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shared/page-header";
import { FinancialTransactionsTable } from "@/features/finance/transactions/components/financial-transactions-table";
import { getFinancialCategories } from "@/server/dal/finance/categories";
import { getTransactions } from "@/server/dal/finance/transactions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("finance");
  return {
    title: t("transactionsTitle"),
  };
}

export default async function FinancialTransactionsPage() {
  const t = await getTranslations("finance");
  const [transactions, categories] = await Promise.all([
    getTransactions(),
    getFinancialCategories(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("transactionsTitle")}
        description={t("transactionsDescription")}
      />
      <FinancialTransactionsTable
        initialTransactions={transactions}
        categories={categories}
      />
    </div>
  );
}
