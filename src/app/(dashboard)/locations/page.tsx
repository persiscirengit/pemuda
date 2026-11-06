import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shared/page-header";
import { LocationsTable } from "@/features/activities/locations/components/locations-table";
import { auth } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { getActivityLocations } from "@/server/dal/activities/locations";
import { getUserPermissions } from "@/server/dal/auth";

export default async function LocationsPage() {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({
    headers: reqHeaders,
  });

  if (!session?.user) {
    redirect("/login");
  }

  const permissions = await getUserPermissions(session.user.id);
  if (!permissions.includes(PERMISSIONS.ACTIVITIES_LOCATIONS_READ)) {
    redirect("/");
  }

  const canManage = permissions.includes(
    PERMISSIONS.ACTIVITIES_LOCATIONS_MANAGE,
  );

  const locations = await getActivityLocations();
  const t = await getTranslations("activities.locations");

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <LocationsTable initialData={locations} canManage={canManage} />
    </div>
  );
}
