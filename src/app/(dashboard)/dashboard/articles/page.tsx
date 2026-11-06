import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shared/page-header";
import { ArticlesTable } from "@/features/content/articles/components/articles-table";
import { auth } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { getUserPermissions } from "@/server/dal/auth";
import { getArticles } from "@/server/dal/content/articles";
import { getArticleCategories } from "@/server/dal/content/categories";

export default async function ArticlesPage() {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({
    headers: reqHeaders,
  });

  if (!session?.user) {
    redirect("/login");
  }

  const permissions = await getUserPermissions(session.user.id);
  if (!permissions.includes(PERMISSIONS.CONTENT_ARTICLES_READ)) {
    redirect("/");
  }

  const canManage = permissions.includes(PERMISSIONS.CONTENT_ARTICLES_CREATE);

  const [articlesList, categories] = await Promise.all([
    getArticles(),
    getArticleCategories(),
  ]);

  const t = await getTranslations("articles");

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("subtitle")} />

      <ArticlesTable
        initialData={articlesList}
        categories={categories}
        canManage={canManage}
      />
    </div>
  );
}
