import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CurriculumTopicEditor } from "@/features/activities/schedules/components/curriculum-topic-editor";
import { auth } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { getAgendaScheduleById } from "@/server/dal/activities/schedules";
import { getUserPermissions } from "@/server/dal/auth";

export interface ScheduleDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ScheduleDetailPage({
  params,
}: ScheduleDetailPageProps) {
  const { id } = await params;
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

  const schedule = await getAgendaScheduleById(id);
  if (!schedule) {
    notFound();
  }

  const t = await getTranslations("activities.schedules");
  const tCommon = await getTranslations("common");

  const timeRangeDisplay =
    schedule.startTime && schedule.endTime
      ? `${schedule.startTime.slice(0, 5)} - ${schedule.endTime.slice(0, 5)}`
      : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={schedule.title}
        description={schedule.description || t("detailsSubtitle")}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/schedules">{tCommon("actions.back")}</Link>
          </Button>
        }
      />

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("detailsTitle")}</CardTitle>
            <CardDescription>{t("subtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">{t("columns.type")}</span>
              <Badge variant="outline" className="capitalize">
                {t(`types.${schedule.scheduleType}`)}
              </Badge>
            </div>

            {timeRangeDisplay && (
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">{t("timeRange")}</span>
                <span className="font-mono">{timeRangeDisplay}</span>
              </div>
            )}

            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">
                {t("departmentLabel")}
              </span>
              <span className="font-medium">
                {schedule.department?.name || t("noDepartment")}
              </span>
            </div>

            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">
                {t("locationLabel")}
              </span>
              <span className="font-medium">
                {schedule.activityLocation?.name ||
                  schedule.defaultLocation ||
                  t("noLocation")}
              </span>
            </div>

            <div className="flex justify-between pt-1">
              <span className="text-muted-foreground">
                {t("columns.status")}
              </span>
              <Badge variant={schedule.isActive ? "default" : "secondary"}>
                {schedule.isActive
                  ? tCommon("status.active")
                  : tCommon("status.inactive")}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <CurriculumTopicEditor
          scheduleId={schedule.id}
          initialTopics={schedule.weeklyTopics}
          canManage={canManage}
        />
      </div>
    </div>
  );
}
