import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shared/page-header";
import { PositionsTable } from "@/features/organization/components/positions-table";
import { auth } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { getUserPermissions } from "@/server/dal/auth";
import { getPositions } from "@/server/dal/organization/positions";

export default async function PositionsPage() {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({
    headers: reqHeaders,
  });

  if (!session?.user) {
    redirect("/login");
  }

  const permissions = await getUserPermissions(session.user.id);
  if (!permissions.includes(PERMISSIONS.ORGANIZATION_POSITIONS_READ)) {
    redirect("/");
  }

  const canManage = permissions.includes(
    PERMISSIONS.ORGANIZATION_POSITIONS_MANAGE,
  );

  const positions = await getPositions();
  const t = await getTranslations("organization.positions");

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <PositionsTable initialData={positions} canManage={canManage} />
    </div>
  );
}
