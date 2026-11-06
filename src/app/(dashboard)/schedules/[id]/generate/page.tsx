import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { MonthlyGeneratorWizard } from "@/features/activities/generator/components/monthly-generator-wizard";
import { auth } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { calculateMonthlyOccurrences } from "@/server/dal/activities/generator";
import { getAgendaScheduleById } from "@/server/dal/activities/schedules";
import { getUserPermissions } from "@/server/dal/auth";

export interface ScheduleGeneratePageProps {
  params: Promise<{ id: string }>;
}

export default async function ScheduleGeneratePage({
  params,
}: ScheduleGeneratePageProps) {
  const { id } = await params;
  const reqHeaders = await headers();
  const session = await auth.api.getSession({
    headers: reqHeaders,
  });

  if (!session?.user) {
    redirect("/login");
  }

  const permissions = await getUserPermissions(session.user.id);
  if (!permissions.includes(PERMISSIONS.ACTIVITIES_SCHEDULES_GENERATE)) {
    redirect(`/schedules/${id}`);
  }

  const schedule = await getAgendaScheduleById(id);
  if (!schedule) {
    notFound();
  }

  if (schedule.scheduleType !== "weekly" || schedule.dayOfWeek === null) {
    redirect(`/schedules/${id}`);
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const occurrences = await calculateMonthlyOccurrences(id, year, month);

  const t = await getTranslations("activities.generator");
  const tCommon = await getTranslations("common");

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href={`/schedules/${id}`}>{tCommon("actions.back")}</Link>
          </Button>
        }
      />

      <MonthlyGeneratorWizard
        schedule={schedule}
        initialYear={year}
        initialMonth={month}
        initialOccurrences={occurrences}
      />
    </div>
  );
}
