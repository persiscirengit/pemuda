"use client";

import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ActivityLifecycleStatus } from "@/server/dal/activities/events";
import { updateActivityStatusAction } from "../actions";

const STATUSES_REQUIRING_REASON: ActivityLifecycleStatus[] = [
  "holiday",
  "postponed",
  "relocated",
  "cancelled",
];

const STATUSES_DISABLING_ATTENDANCE: ActivityLifecycleStatus[] = [
  "holiday",
  "postponed",
  "cancelled",
];

export interface ActivityStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activity: {
    id: string;
    title: string;
    status: ActivityLifecycleStatus;
    changeReason?: string | null;
    attendanceEnabled?: boolean;
  } | null;
  onSuccess?: () => void;
}

const ALL_STATUSES: ActivityLifecycleStatus[] = [
  "scheduled",
  "completed",
  "holiday",
  "postponed",
  "relocated",
  "cancelled",
];

export function ActivityStatusDialog({
  open,
  onOpenChange,
  activity,
  onSuccess,
}: ActivityStatusDialogProps) {
  const t = useTranslations("activities.statusDialog");
  const tEvents = useTranslations("activities.events");
  const tCommon = useTranslations("common");

  const [status, setStatus] =
    React.useState<ActivityLifecycleStatus>("scheduled");
  const [changeReason, setChangeReason] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (activity) {
      setStatus(activity.status);
      setChangeReason(activity.changeReason || "");
    }
  }, [activity]);

  const isReasonRequired = STATUSES_REQUIRING_REASON.includes(status);
  const willDisableAttendance = STATUSES_DISABLING_ATTENDANCE.includes(status);
  const dialogDescription = activity
    ? `${activity.title} - ${t("description")}`
    : t("description");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activity) return;

    if (isReasonRequired && !changeReason.trim()) {
      toast.error(t("reasonRequiredHelp"));
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await updateActivityStatusAction({
        id: activity.id,
        status,
        changeReason: changeReason.trim() ? changeReason.trim() : null,
      });

      if (res?.data?.activity) {
        toast.success(t("updatedSuccess"));
        onOpenChange(false);
        onSuccess?.();
      } else if (res?.serverError) {
        toast.error(res.serverError);
      }
    } catch {
      toast.error(tCommon("errors.unexpected"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <FieldGroup className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-3 text-sm">
              <span className="text-muted-foreground">
                {t("currentStatus")}
              </span>
              {activity && (
                <Badge variant="outline">
                  {tEvents(`statuses.${activity.status}`)}
                </Badge>
              )}
            </div>

            <Field>
              <FieldLabel>{t("newStatus")}</FieldLabel>
              <Select
                value={status}
                onValueChange={(val) =>
                  setStatus(val as ActivityLifecycleStatus)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALL_STATUSES.map((st) => (
                    <SelectItem key={st} value={st}>
                      {tEvents(`statuses.${st}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {willDisableAttendance && (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
                {t("attendanceWarning")}
              </div>
            )}

            {isReasonRequired && (
              <Field>
                <FieldLabel>{t("reasonLabel")}</FieldLabel>
                <Textarea
                  value={changeReason}
                  onChange={(e) => setChangeReason(e.target.value)}
                  placeholder={t("reasonPlaceholder")}
                  rows={3}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  {t("reasonRequiredHelp")}
                </p>
              </Field>
            )}
          </FieldGroup>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              {tCommon("actions.cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {t("submitButton")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
