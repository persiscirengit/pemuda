"use client";

import {
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  MapPin,
  QrCode,
  Sparkles,
} from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export interface CheckInActivityItem {
  id: string;
  title: string;
  topic?: string | null;
  description?: string | null;
  location?: string | null;
  activityDate: string;
  startTime?: string | null;
  endTime?: string | null;
  attendanceCloseAt?: string | Date | null;
  attendanceRadius?: number;
  alreadyCheckedIn?: boolean;
  userAttendanceStatus?: string | null;
}

export interface UpcomingActivityItem {
  id: string;
  title: string;
  topic?: string | null;
  activityDate: string;
  startTime?: string | null;
  endTime?: string | null;
  location?: string | null;
}

export interface CheckInHubProps {
  openActivities: CheckInActivityItem[];
  upcomingActivities: UpcomingActivityItem[];
}

function formatTimeRange(start?: string | null, end?: string | null): string {
  if (start && end) return `${start} - ${end}`;
  if (start) return start;
  return "--:--";
}

export function CheckInHub({
  openActivities,
  upcomingActivities,
}: CheckInHubProps) {
  const t = useTranslations("portal");
  const [excuseDialogOpen, setExcuseDialogOpen] = React.useState(false);
  const [_selectedActivityId, setSelectedActivityId] = React.useState<
    string | null
  >(null);
  const [excuseReason, setExcuseReason] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  // Time remaining counter helper
  const calculateRemainingSeconds = React.useCallback(
    (closeAt?: string | Date | null) => {
      if (!closeAt) return 0;
      const diff = new Date(closeAt).getTime() - Date.now();
      return Math.max(0, Math.floor(diff / 1000));
    },
    [],
  );

  const [countdowns, setCountdowns] = React.useState<Record<string, number>>(
    () => {
      const initial: Record<string, number> = {};
      for (const act of openActivities) {
        initial[act.id] = calculateRemainingSeconds(act.attendanceCloseAt);
      }
      return initial;
    },
  );

  React.useEffect(() => {
    const timer = setInterval(() => {
      setCountdowns((_prev) => {
        const next: Record<string, number> = {};
        for (const act of openActivities) {
          next[act.id] = calculateRemainingSeconds(act.attendanceCloseAt);
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [openActivities, calculateRemainingSeconds]);

  const formatCountdown = (seconds: number) => {
    if (seconds <= 0) return t("closingSoon");
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) {
      return `${h}h ${m}m ${s}s`;
    }
    return `${m}m ${s}s`;
  };

  const handleSimulateCheckIn = (_activityId: string) => {
    toast.success(t("checkInSuccess"));
  };

  const handleOpenExcuseDialog = (activityId: string) => {
    setSelectedActivityId(activityId);
    setExcuseReason("");
    setExcuseDialogOpen(true);
  };

  const handleSubmitExcuse = async () => {
    if (!excuseReason.trim()) {
      toast.error(t("excuseReasonRequired"));
      return;
    }
    setSubmitting(true);
    try {
      toast.success(t("excuseSubmitted"));
      setExcuseDialogOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Open Activities Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight">
              {t("fieldCheckInTitle")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("fieldCheckInSubtitle")}
            </p>
          </div>
        </div>

        {openActivities.length === 0 ? (
          <Card className="border-dashed shadow-sm">
            <CardHeader className="text-center py-10">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted">
                <QrCode className="size-6 text-muted-foreground" />
              </div>
              <CardTitle className="mt-3 text-lg">
                {t("noOpenActivities")}
              </CardTitle>
              <CardDescription>{t("noOpenActivitiesDesc")}</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="grid gap-4">
            {openActivities.map((activity) => {
              const remaining = countdowns[activity.id] ?? 0;
              const isCheckedIn = activity.alreadyCheckedIn;

              return (
                <Card
                  key={activity.id}
                  className="overflow-hidden border-2 border-primary/20 shadow-md"
                >
                  <div className="bg-primary/10 px-4 py-2 border-b flex items-center justify-between">
                    <span className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
                      <span className="relative flex size-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                        <span className="relative inline-flex rounded-full size-2 bg-primary" />
                      </span>
                      {t("liveAttendanceOpen")}
                    </span>
                    <Badge
                      variant="secondary"
                      className="flex items-center gap-1 font-mono text-xs"
                    >
                      <Clock className="size-3" />
                      <span>{formatCountdown(remaining)}</span>
                    </Badge>
                  </div>

                  <CardHeader>
                    <div className="space-y-1">
                      <CardTitle className="text-xl font-bold">
                        {activity.title}
                      </CardTitle>
                      {activity.topic && (
                        <p className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                          <Sparkles className="size-3.5 text-primary" />
                          <span>{activity.topic}</span>
                        </p>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3">
                    {activity.location && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="size-4 shrink-0 text-muted-foreground" />
                        <span>{activity.location}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="size-4 shrink-0 text-muted-foreground" />
                      <span>
                        {formatTimeRange(activity.startTime, activity.endTime)}
                      </span>
                    </div>

                    {isCheckedIn ? (
                      <div className="rounded-lg bg-emerald-500/10 p-3 border border-emerald-500/20 flex items-center gap-3">
                        <CheckCircle2 className="size-5 text-emerald-600 shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-400">
                            {t("alreadyCheckedIn")}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {t("checkInRecordedNotice")}
                          </p>
                        </div>
                      </div>
                    ) : null}
                  </CardContent>

                  {!isCheckedIn && (
                    <CardFooter className="flex flex-col sm:flex-row gap-3 pt-2 bg-muted/20 border-t">
                      <Button
                        size="lg"
                        className="w-full sm:w-auto font-semibold gap-2 shadow-sm text-base h-11 px-8"
                        onClick={() => handleSimulateCheckIn(activity.id)}
                      >
                        <QrCode className="size-5 shrink-0" />
                        <span>{t("checkInNow")}</span>
                      </Button>

                      <Button
                        variant="outline"
                        size="lg"
                        className="w-full sm:w-auto gap-2 h-11"
                        onClick={() => handleOpenExcuseDialog(activity.id)}
                      >
                        <FileText className="size-4 shrink-0" />
                        <span>{t("excuseAbsence")}</span>
                      </Button>
                    </CardFooter>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Upcoming Activities (Next 14 Days) */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Calendar className="size-4 text-primary" />
            <span>{t("upcomingActivitiesTitle")}</span>
          </CardTitle>
          <CardDescription>{t("upcomingActivitiesSubtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          {upcomingActivities.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              {t("noUpcomingActivities")}
            </p>
          ) : (
            <div className="divide-y">
              {upcomingActivities.map((act) => (
                <div
                  key={act.id}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">{act.title}</p>
                    {act.location && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="size-3" />
                        <span>{act.location}</span>
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs font-mono">
                      {act.activityDate}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {act.startTime ?? "--:--"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Excuse Absence Dialog */}
      <Dialog open={excuseDialogOpen} onOpenChange={setExcuseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("excuseAbsenceDialogTitle")}</DialogTitle>
            <DialogDescription>
              {t("excuseAbsenceDialogDesc")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="excuse-reason">{t("excuseReasonLabel")}</Label>
              <Textarea
                id="excuse-reason"
                placeholder={t("excuseReasonPlaceholder")}
                value={excuseReason}
                onChange={(e) => setExcuseReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setExcuseDialogOpen(false)}
              disabled={submitting}
            >
              {t("cancel")}
            </Button>
            <Button onClick={handleSubmitExcuse} disabled={submitting}>
              {submitting ? t("submitting") : t("submitExcuse")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
