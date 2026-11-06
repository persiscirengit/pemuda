import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shared/page-header";
import { TreasurerOverview } from "@/features/finance/dashboard/components/treasurer-overview";
import { getFinanceSummary } from "@/server/dal/finance/analytics";
import { getFinancialCategories } from "@/server/dal/finance/categories";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("finance");
  return {
    title: t("overviewTitle"),
  };
}

export default async function FinanceDashboardPage() {
  const t = await getTranslations("finance");
  const [summary, categories] = await Promise.all([
    getFinanceSummary(),
    getFinancialCategories(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("overviewTitle")}
        description={t("overviewDescription")}
      />
      <TreasurerOverview summary={summary} categories={categories} />
    </div>
  );
}
