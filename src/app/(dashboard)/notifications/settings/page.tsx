import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shared/page-header";
import { NotificationPreferencesForm } from "@/features/notifications/components/notification-preferences-form";
import { auth } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { getUserPermissions } from "@/server/dal/auth";
import { getMyNotificationPreferences } from "@/server/dal/notifications/preferences";

export default async function NotificationSettingsPage() {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({
    headers: reqHeaders,
  });

  if (!session?.user) {
    redirect("/login");
  }

  const permissions = await getUserPermissions(session.user.id);
  if (!permissions.includes(PERMISSIONS.NOTIFICATIONS_PREFERENCES_SELF)) {
    redirect("/dashboard");
  }

  const preferences = await getMyNotificationPreferences();
  const t = await getTranslations("notifications");

  return (
    <div className="space-y-6">
      <PageHeader title={t("settings")} description={t("settingsSubtitle")} />
      <NotificationPreferencesForm initialPreferences={preferences} />
    </div>
  );
}
