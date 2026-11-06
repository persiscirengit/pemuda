import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shared/page-header";
import { ArticleCategoriesTable } from "@/features/content/categories/components/article-categories-table";
import { getArticleCategories } from "@/server/dal/content/categories";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("articles");
  return {
    title: t("categoriesTitle"),
  };
}

export default async function ArticleCategoriesPage() {
  const t = await getTranslations("articles");
  const categories = await getArticleCategories();

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("categoriesTitle")}
        description={t("categoriesDescription")}
      />
      <ArticleCategoriesTable categories={categories} />
    </div>
  );
}
