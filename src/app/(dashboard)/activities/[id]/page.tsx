import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ActivityDetailHeaderActions } from "@/features/activities/events/components/activity-detail-header-actions";
import { ActivityTokenDisplay } from "@/features/activities/events/components/activity-token-display";
import { auth } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import {
  type ActivityLifecycleStatus,
  getActivityById,
} from "@/server/dal/activities/events";
import { getUserPermissions } from "@/server/dal/auth";

export interface ActivityDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ActivityDetailPage({
  params,
}: ActivityDetailPageProps) {
  const { id } = await params;
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

  const canChangeStatus = permissions.includes(
    PERMISSIONS.ACTIVITIES_EVENTS_STATUS,
  );

  const activity = await getActivityById(id);
  if (!activity) {
    notFound();
  }

  const t = await getTranslations("activities.events");

  const status = activity.status as ActivityLifecycleStatus;
  const statusVariantMap: Record<
    ActivityLifecycleStatus,
    "default" | "secondary" | "outline" | "destructive"
  > = {
    scheduled: "outline",
    completed: "default",
    holiday: "secondary",
    postponed: "secondary",
    relocated: "outline",
    cancelled: "destructive",
  };

  const now = new Date();
  let attendancePillState: "open" | "notOpen" | "closed" | "disabled" =
    "disabled";
  if (activity.attendanceEnabled) {
    if (
      activity.attendanceOpenAt &&
      now < new Date(activity.attendanceOpenAt)
    ) {
      attendancePillState = "notOpen";
    } else if (
      activity.attendanceCloseAt &&
      now > new Date(activity.attendanceCloseAt)
    ) {
      attendancePillState = "closed";
    } else {
      attendancePillState = "open";
    }
  }

  const timeRangeDisplay =
    activity.startTime && activity.endTime
      ? `${activity.startTime.slice(0, 5)} - ${activity.endTime.slice(0, 5)}`
      : null;

  const summary = activity.attendanceSummary || {
    total: 0,
    present: 0,
    absent: 0,
    permission: 0,
    needVerification: 0,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={activity.title}
        description={activity.topic || t("detailsSubtitle")}
        actions={
          <ActivityDetailHeaderActions
            activity={activity}
            canChangeStatus={canChangeStatus}
          />
        }
      />

      <div className="grid gap-6 md:grid-cols-2">
        {/* Activity Details Card */}
        <Card>
          <CardHeader>
            <CardTitle>{t("detailsTitle")}</CardTitle>
            <CardDescription>{t("detailsSubtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">{t("statusLabel")}</span>
              <div className="flex flex-col items-end gap-1">
                <Badge variant={statusVariantMap[status] || "outline"}>
                  {t(`statuses.${status}`)}
                </Badge>
                {activity.changeReason && (
                  <span className="text-xs italic text-muted-foreground">
                    {activity.changeReason}
                  </span>
                )}
              </div>
            </div>

            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">{t("dateLabel")}</span>
              <span className="font-mono font-medium">
                {activity.activityDate}
              </span>
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
                {activity.department?.name || t("noDepartment")}
              </span>
            </div>

            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">{t("picLabel")}</span>
              <span className="font-medium">
                {activity.pic?.fullName || t("noPic")}
              </span>
            </div>

            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">
                {t("locationLabel")}
              </span>
              <span className="font-medium">
                {activity.location || t("noLocation")}
              </span>
            </div>

            <div className="flex justify-between pt-1">
              <span className="text-muted-foreground">
                {t("scheduleLabel")}
              </span>
              {activity.agendaSchedule ? (
                <Link
                  href={`/schedules/${activity.agendaSchedule.id}`}
                  className="font-medium text-foreground hover:underline"
                >
                  {activity.agendaSchedule.title}
                </Link>
              ) : (
                <span className="text-muted-foreground">{t("noSchedule")}</span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Attendance Summary & Token Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{t("summary.title")}</CardTitle>
              <Badge
                variant={
                  attendancePillState === "open"
                    ? "default"
                    : attendancePillState === "notOpen"
                      ? "outline"
                      : "secondary"
                }
              >
                {t(`attendanceStatus.${attendancePillState}`)}
              </Badge>
            </div>
            <CardDescription>{t("attendanceWindowLabel")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {activity.attendanceEnabled && activity.attendanceToken && (
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  {t("attendanceTokenLabel")}
                </span>
                <ActivityTokenDisplay token={activity.attendanceToken} />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-4">
              <div className="rounded-lg border p-3 text-center">
                <span className="text-xs text-muted-foreground">
                  {t("summary.present")}
                </span>
                <p className="text-2xl font-bold text-foreground">
                  {summary.present}
                </p>
              </div>

              <div className="rounded-lg border p-3 text-center">
                <span className="text-xs text-muted-foreground">
                  {t("summary.absent")}
                </span>
                <p className="text-2xl font-bold text-foreground">
                  {summary.absent}
                </p>
              </div>

              <div className="rounded-lg border p-3 text-center">
                <span className="text-xs text-muted-foreground">
                  {t("summary.permission")}
                </span>
                <p className="text-2xl font-bold text-foreground">
                  {summary.permission}
                </p>
              </div>

              <div className="rounded-lg border p-3 text-center">
                <span className="text-xs text-muted-foreground">
                  {t("summary.total")}
                </span>
                <p className="text-2xl font-bold text-foreground">
                  {summary.total}
                </p>
              </div>
            </div>

            {activity.description && (
              <div className="border-t pt-3">
                <span className="text-xs font-medium text-muted-foreground">
                  {t("descriptionLabel")}
                </span>
                <p className="mt-1 text-sm text-foreground">
                  {activity.description}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
