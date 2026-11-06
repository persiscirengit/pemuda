import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shared/page-header";
import { db } from "@/db";
import { departments } from "@/db/schema/organization";
import { ArticleForm } from "@/features/content/articles/components/article-form";
import { auth } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { getUserPermissions } from "@/server/dal/auth";
import { getArticleById } from "@/server/dal/content/articles";
import { getArticleCategories } from "@/server/dal/content/categories";

export interface EditArticlePageProps {
  params: Promise<{ id: string }>;
}

export default async function EditArticlePage({
  params,
}: EditArticlePageProps) {
  const { id } = await params;

  const reqHeaders = await headers();
  const session = await auth.api.getSession({
    headers: reqHeaders,
  });

  if (!session?.user) {
    redirect("/login");
  }

  const permissions = await getUserPermissions(session.user.id);
  if (!permissions.includes(PERMISSIONS.CONTENT_ARTICLES_UPDATE)) {
    redirect("/dashboard/articles");
  }

  const [article, categories, allDepartments] = await Promise.all([
    getArticleById(id),
    getArticleCategories(),
    db.select({ id: departments.id, name: departments.name }).from(departments),
  ]);

  if (!article) {
    notFound();
  }

  const t = await getTranslations("articles");

  return (
    <div className="space-y-6">
      <PageHeader title={t("editArticle")} description={t("subtitle")} />

      <ArticleForm
        initialData={article}
        categories={categories}
        departments={allDepartments}
      />
    </div>
  );
}
