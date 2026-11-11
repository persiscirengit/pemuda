"use client";

import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  MapPin,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ActivityCheckInDetails } from "@/server/dal/activities/checkin";
import { CheckInForm } from "./checkin-form";
import { LeaveRequestForm } from "./leave-request-form";

export interface CheckInClientProps {
  activity: ActivityCheckInDetails;
  token: string;
}

export function CheckInClient({ activity, token }: CheckInClientProps) {
  const t = useTranslations("attendance.checkin");
  const tQr = useTranslations("attendance.qr");

  const attendance = activity.currentUserAttendance;
  const isAlreadyRecorded =
    attendance?.status === "present" ||
    (attendance?.status === "permission" &&
      attendance?.verificationStatus === "valid");

  const timeDisplay =
    activity.startTime && activity.endTime
      ? `${activity.startTime.slice(0, 5)} - ${activity.endTime.slice(0, 5)}`
      : (activity.startTime?.slice(0, 5) ?? null);

  return (
    <div className="mx-auto max-w-xl space-y-6">
      {/* Activity Overview Card */}
      <Card className="border-2 shadow-md">
        <CardHeader className="space-y-1 text-center sm:text-left">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Badge
              variant={activity.isOpen ? "default" : "secondary"}
              className="px-2.5 py-0.5 text-xs font-semibold"
            >
              {activity.isOpen
                ? tQr("openStatus")
                : activity.windowState === "notOpen"
                  ? tQr("notOpenStatus")
                  : tQr("closedStatus")}
            </Badge>

            <span className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
              <Calendar className="size-3.5" />
              <span>{activity.activityDate}</span>
            </span>
          </div>

          <CardTitle className="text-xl font-bold sm:text-2xl">
            {activity.title}
          </CardTitle>
          {activity.topic && (
            <CardDescription className="font-medium text-foreground/80">
              {activity.topic}
            </CardDescription>
          )}
        </CardHeader>

        <CardContent className="space-y-3 pt-0 text-sm">
          {activity.location && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="size-4 shrink-0 text-primary" />
              <span className="font-medium text-foreground">
                {activity.location}
              </span>
            </div>
          )}

          {timeDisplay && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="size-4 shrink-0 text-primary" />
              <span className="font-mono">{timeDisplay}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Already Recorded State */}
      {isAlreadyRecorded ? (
        <Card className="border-emerald-500/30 bg-emerald-500/10 shadow-sm">
          <CardHeader className="text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-600 text-white">
              <CheckCircle2 className="size-6" />
            </div>
            <CardTitle className="text-lg font-bold text-emerald-900 dark:text-emerald-300">
              {t("alreadyRecordedTitle")}
            </CardTitle>
            <CardDescription>{t("alreadyRecordedDesc")}</CardDescription>
          </CardHeader>
        </Card>
      ) : !activity.isOpen ? (
        <Card className="border-destructive/30 bg-destructive/10 shadow-sm">
          <CardHeader className="text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/20 text-destructive">
              <AlertCircle className="size-6" />
            </div>
            <CardTitle className="text-lg font-bold text-destructive">
              {activity.windowState === "notOpen"
                ? t("windowNotOpenTitle")
                : t("windowClosedTitle")}
            </CardTitle>
            <CardDescription className="text-destructive/80">
              {activity.windowState === "notOpen"
                ? t("windowNotOpenDesc")
                : t("windowClosedDesc")}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        /* Action Tabs: Check-In vs Leave Request */
        <Card className="shadow-md">
          <CardContent className="pt-6">
            <Tabs defaultValue="checkin" className="space-y-5">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="checkin" className="font-semibold">
                  {t("tabs.checkin")}
                </TabsTrigger>
                <TabsTrigger value="permission" className="font-semibold">
                  {t("tabs.permission")}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="checkin" className="pt-2">
                <CheckInForm activity={activity} token={token} />
              </TabsContent>

              <TabsContent value="permission" className="pt-2">
                <LeaveRequestForm token={token} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
