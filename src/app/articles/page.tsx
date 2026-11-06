import { BookOpen } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ArticleCard } from "@/features/public/components/article-card";
import { ArticleFilters } from "@/features/public/components/article-filters";
import { PublicFooter } from "@/features/public/components/public-footer";
import { PublicHeader } from "@/features/public/components/public-header";
import {
  getPublicArticleCategories,
  getPublicArticles,
} from "@/server/dal/content/public-articles";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("publicArticles");
  return {
    title: `${t("title")} | Pemuda Persis Cirengit`,
    description: t("subtitle"),
  };
}

export default async function ArticlesPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; category?: string }>;
}) {
  const { search, category } = await searchParams;
  const t = await getTranslations("publicArticles");

  const [articles, categories] = await Promise.all([
    getPublicArticles({ search, categorySlug: category }),
    getPublicArticleCategories(),
  ]);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <PublicHeader />

      <main className="flex-1 py-12 sm:py-16">
        <div className="container mx-auto max-w-6xl px-4 sm:px-6 space-y-8">
          <div className="space-y-2 border-b border-border/40 pb-6">
            <h1 className="font-extrabold tracking-tight text-3xl sm:text-4xl text-foreground">
              {t("title")}
            </h1>
            <p className="text-base text-muted-foreground">{t("subtitle")}</p>
          </div>

          <ArticleFilters
            categories={categories}
            currentCategory={category}
            currentSearch={search}
          />

          {articles.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-16 text-center">
              <BookOpen className="mx-auto h-12 w-12 text-muted-foreground/40 mb-3" />
              <p className="text-base text-muted-foreground">
                {t("emptyMessage")}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
              {articles.map((article) => (
                <ArticleCard key={article.id} article={article} />
              ))}
            </div>
          )}
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
