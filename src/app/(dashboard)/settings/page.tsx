import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shared/page-header";
import { SettingsForm } from "@/features/organization/components/settings-form";
import { auth } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { getUserPermissions } from "@/server/dal/auth";
import { getSystemSettings } from "@/server/dal/organization/settings";

export default async function SettingsPage() {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({
    headers: reqHeaders,
  });

  if (!session?.user) {
    redirect("/login");
  }

  const permissions = await getUserPermissions(session.user.id);
  if (!permissions.includes(PERMISSIONS.ORGANIZATION_SETTINGS_READ)) {
    redirect("/");
  }

  const canManage = permissions.includes(
    PERMISSIONS.ORGANIZATION_SETTINGS_MANAGE,
  );

  const settings = await getSystemSettings();
  const t = await getTranslations("organization.settings");

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <SettingsForm initialSettings={settings} canManage={canManage} />
    </div>
  );
}
