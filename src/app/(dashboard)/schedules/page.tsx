import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shared/page-header";
import { db } from "@/db";
import { departments } from "@/db/schema/organization";
import { SchedulesTable } from "@/features/activities/schedules/components/schedules-table";
import { auth } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { getActivityLocations } from "@/server/dal/activities/locations";
import { getAgendaSchedules } from "@/server/dal/activities/schedules";
import { getUserPermissions } from "@/server/dal/auth";

export default async function SchedulesPage() {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({
    headers: reqHeaders,
  });

  if (!session?.user) {
    redirect("/login");
  }

  const permissions = await getUserPermissions(session.user.id);
  if (!permissions.includes(PERMISSIONS.ACTIVITIES_SCHEDULES_READ)) {
    redirect("/");
  }

  const canManage = permissions.includes(
    PERMISSIONS.ACTIVITIES_SCHEDULES_MANAGE,
  );

  const schedules = await getAgendaSchedules();

  let locations: { id: string; name: string }[] = [];
  if (permissions.includes(PERMISSIONS.ACTIVITIES_LOCATIONS_READ)) {
    const locs = await getActivityLocations({ isActive: true });
    locations = locs.map((l) => ({ id: l.id, name: l.name }));
  }

  const depts = await db
    .select({
      id: departments.id,
      name: departments.name,
    })
    .from(departments);

  const t = await getTranslations("activities.schedules");

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <SchedulesTable
        initialData={schedules}
        locations={locations}
        departments={depts}
        canManage={canManage}
      />
    </div>
  );
}
