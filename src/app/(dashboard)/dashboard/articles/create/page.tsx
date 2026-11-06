import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shared/page-header";
import { db } from "@/db";
import { departments } from "@/db/schema/organization";
import { ArticleForm } from "@/features/content/articles/components/article-form";
import { auth } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { getUserPermissions } from "@/server/dal/auth";
import { getArticleCategories } from "@/server/dal/content/categories";

export default async function CreateArticlePage() {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({
    headers: reqHeaders,
  });

  if (!session?.user) {
    redirect("/login");
  }

  const permissions = await getUserPermissions(session.user.id);
  if (!permissions.includes(PERMISSIONS.CONTENT_ARTICLES_CREATE)) {
    redirect("/dashboard/articles");
  }

  const [categories, allDepartments] = await Promise.all([
    getArticleCategories(),
    db.select({ id: departments.id, name: departments.name }).from(departments),
  ]);

  const t = await getTranslations("articles");

  return (
    <div className="space-y-6">
      <PageHeader title={t("createArticle")} description={t("subtitle")} />

      <ArticleForm categories={categories} departments={allDepartments} />
    </div>
  );
}
