import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shared/page-header";
import { DepartmentsTable } from "@/features/organization/components/departments-table";
import { auth } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { getUserPermissions } from "@/server/dal/auth";
import { getDepartments } from "@/server/dal/organization/departments";

export default async function DepartmentsPage() {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({
    headers: reqHeaders,
  });

  if (!session?.user) {
    redirect("/login");
  }

  const permissions = await getUserPermissions(session.user.id);
  if (!permissions.includes(PERMISSIONS.ORGANIZATION_DEPARTMENTS_READ)) {
    redirect("/");
  }

  const canManage = permissions.includes(
    PERMISSIONS.ORGANIZATION_DEPARTMENTS_MANAGE,
  );

  const departments = await getDepartments();
  const t = await getTranslations("organization.departments");

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <DepartmentsTable initialData={departments} canManage={canManage} />
    </div>
  );
}
