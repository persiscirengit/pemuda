import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shared/page-header";
import { db } from "@/db";
import { departments, members } from "@/db/schema/organization";
import { ActivitiesTable } from "@/features/activities/events/components/activities-table";
import { auth } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { getActivities } from "@/server/dal/activities/events";
import { getUserPermissions } from "@/server/dal/auth";

export default async function ActivitiesPage() {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({
    headers: reqHeaders,
  });

  if (!session?.user) {
    redirect("/login");
  }

  const permissions = await getUserPermissions(session.user.id);
  if (!permissions.includes(PERMISSIONS.ACTIVITIES_EVENTS_READ)) {
    redirect("/");
  }

  const canManage = permissions.includes(PERMISSIONS.ACTIVITIES_EVENTS_CREATE);

  const activities = await getActivities();

  const allDepts = await db
    .select({ id: departments.id, name: departments.name })
    .from(departments);

  const allMembers = await db
    .select({
      id: members.id,
      fullName: members.fullName,
      memberNumber: members.memberNumber,
    })
    .from(members);

  const t = await getTranslations("activities.events");

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("subtitle")} />

      <ActivitiesTable
        initialData={activities}
        departments={allDepts}
        members={allMembers}
        canManage={canManage}
      />
    </div>
  );
}
