import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shared/page-header";
import { NotificationsFeed } from "@/features/notifications/components/notifications-feed";
import { auth } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { getUserPermissions } from "@/server/dal/auth";
import { getMyNotifications } from "@/server/dal/notifications/inbox";

export default async function NotificationsPage() {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({
    headers: reqHeaders,
  });

  if (!session?.user) {
    redirect("/login");
  }

  const permissions = await getUserPermissions(session.user.id);
  if (!permissions.includes(PERMISSIONS.NOTIFICATIONS_INBOX_SELF)) {
    redirect("/dashboard");
  }

  const notifications = await getMyNotifications({ limit: 50 });
  const t = await getTranslations("notifications");

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <NotificationsFeed initialNotifications={notifications} />
    </div>
  );
}
