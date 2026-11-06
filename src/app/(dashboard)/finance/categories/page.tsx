import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shared/page-header";
import { FinancialCategoriesTable } from "@/features/finance/categories/components/financial-categories-table";
import { getFinancialCategories } from "@/server/dal/finance/categories";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("finance");
  return {
    title: t("categoriesTitle"),
  };
}

export default async function FinancialCategoriesPage() {
  const t = await getTranslations("finance");
  const categories = await getFinancialCategories();

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("categoriesTitle")}
        description={t("categoriesDescription")}
      />
      <FinancialCategoriesTable categories={categories} />
    </div>
  );
}
