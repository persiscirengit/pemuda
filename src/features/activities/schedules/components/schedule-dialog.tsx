"use client";

import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { AgendaSchedule } from "@/db/schema/activities";
import type { ScheduleType } from "@/server/dal/activities/schedules";
import {
  createAgendaScheduleAction,
  updateAgendaScheduleAction,
} from "../actions";

export interface ScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedule?: AgendaSchedule | null;
  locations?: { id: string; name: string }[];
  departments?: { id: string; name: string }[];
  onSuccess?: () => void;
}

export function ScheduleDialog({
  open,
  onOpenChange,
  schedule,
  locations = [],
  departments = [],
  onSuccess,
}: ScheduleDialogProps) {
  const t = useTranslations("activities.schedules");
  const tCommon = useTranslations("common");

  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [scheduleType, setScheduleType] =
    React.useState<ScheduleType>("weekly");
  const [dayOfWeek, setDayOfWeek] = React.useState("0");
  const [dayOfMonth, setDayOfMonth] = React.useState("1");
  const [specificDate, setSpecificDate] = React.useState("");
  const [startTime, setStartTime] = React.useState("18:30");
  const [endTime, setEndTime] = React.useState("20:00");
  const [departmentId, setDepartmentId] = React.useState("none");
  const [activityLocationId, setActivityLocationId] = React.useState("none");
  const [isActive, setIsActive] = React.useState<"active" | "inactive">(
    "active",
  );
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (schedule) {
      setTitle(schedule.title);
      setDescription(schedule.description ?? "");
      setScheduleType(schedule.scheduleType);
      setDayOfWeek(
        schedule.dayOfWeek !== null && schedule.dayOfWeek !== undefined
          ? String(schedule.dayOfWeek)
          : "0",
      );
      setDayOfMonth(
        schedule.dayOfMonth !== null && schedule.dayOfMonth !== undefined
          ? String(schedule.dayOfMonth)
          : "1",
      );
      setSpecificDate(schedule.specificDate ?? "");
      setStartTime(schedule.startTime ?? "");
      setEndTime(schedule.endTime ?? "");
      setDepartmentId(schedule.departmentId ?? "none");
      setActivityLocationId(schedule.activityLocationId ?? "none");
      setIsActive(schedule.isActive ? "active" : "inactive");
    } else {
      setTitle("");
      setDescription("");
      setScheduleType("weekly");
      setDayOfWeek("0");
      setDayOfMonth("1");
      setSpecificDate("");
      setStartTime("18:30");
      setEndTime("20:00");
      setDepartmentId("none");
      setActivityLocationId("none");
      setIsActive("active");
    }
    setError(null);
  }, [schedule]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError(t("titleLabel"));
      return;
    }

    if (startTime && endTime && endTime <= startTime) {
      setError(tCommon("status.error"));
      toast.error(tCommon("status.error"));
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      scheduleType,
      dayOfWeek: scheduleType === "weekly" ? Number(dayOfWeek) : null,
      dayOfMonth: scheduleType === "monthly" ? Number(dayOfMonth) : null,
      specificDate: scheduleType === "incidental" ? specificDate : null,
      startTime: startTime || null,
      endTime: endTime || null,
      departmentId: departmentId === "none" ? null : departmentId,
      activityLocationId:
        activityLocationId === "none" ? null : activityLocationId,
      isActive: isActive === "active",
    };

    try {
      if (schedule) {
        const res = await updateAgendaScheduleAction({
          id: schedule.id,
          ...payload,
        });

        if (res?.serverError) {
          setError(res.serverError);
          toast.error(res.serverError);
          return;
        }

        toast.success(t("updatedSuccess"));
      } else {
        const res = await createAgendaScheduleAction(payload);

        if (res?.serverError) {
          setError(res.serverError);
          toast.error(res.serverError);
          return;
        }

        toast.success(t("createdSuccess"));
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[90vh] overflow-y-auto"
      >
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {schedule ? t("editSchedule") : t("createSchedule")}
            </DialogTitle>
            <DialogDescription>{t("subtitle")}</DialogDescription>
          </DialogHeader>

          <FieldGroup className="py-4">
            <Field>
              <FieldLabel>{t("titleLabel")}</FieldLabel>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("titlePlaceholder")}
                disabled={isSubmitting}
                autoFocus
              />
              {error && <FieldError>{error}</FieldError>}
            </Field>

            <Field>
              <FieldLabel>{t("descriptionLabel")}</FieldLabel>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("descriptionPlaceholder")}
                disabled={isSubmitting}
                rows={2}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel>{t("scheduleTypeLabel")}</FieldLabel>
                <Select
                  value={scheduleType}
                  onValueChange={(val: ScheduleType) => setScheduleType(val)}
                  disabled={isSubmitting}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">{t("types.weekly")}</SelectItem>
                    <SelectItem value="monthly">
                      {t("types.monthly")}
                    </SelectItem>
                    <SelectItem value="incidental">
                      {t("types.incidental")}
                    </SelectItem>
                    <SelectItem value="yearly">{t("types.yearly")}</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              {scheduleType === "weekly" && (
                <Field>
                  <FieldLabel>{t("dayOfWeekLabel")}</FieldLabel>
                  <Select
                    value={dayOfWeek}
                    onValueChange={(val) => setDayOfWeek(val)}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">{t("days.sun")}</SelectItem>
                      <SelectItem value="1">{t("days.mon")}</SelectItem>
                      <SelectItem value="2">{t("days.tue")}</SelectItem>
                      <SelectItem value="3">{t("days.wed")}</SelectItem>
                      <SelectItem value="4">{t("days.thu")}</SelectItem>
                      <SelectItem value="5">{t("days.fri")}</SelectItem>
                      <SelectItem value="6">{t("days.sat")}</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              )}

              {scheduleType === "monthly" && (
                <Field>
                  <FieldLabel>{t("dayOfMonthLabel")}</FieldLabel>
                  <Input
                    type="number"
                    min={1}
                    max={31}
                    value={dayOfMonth}
                    onChange={(e) => setDayOfMonth(e.target.value)}
                    disabled={isSubmitting}
                  />
                </Field>
              )}

              {scheduleType === "incidental" && (
                <Field>
                  <FieldLabel>{t("specificDateLabel")}</FieldLabel>
                  <Input
                    type="date"
                    value={specificDate}
                    onChange={(e) => setSpecificDate(e.target.value)}
                    disabled={isSubmitting}
                  />
                </Field>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel>{t("startTimeLabel")}</FieldLabel>
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  disabled={isSubmitting}
                />
              </Field>

              <Field>
                <FieldLabel>{t("endTimeLabel")}</FieldLabel>
                <Input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  disabled={isSubmitting}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel>{t("departmentLabel")}</FieldLabel>
                <Select
                  value={departmentId}
                  onValueChange={(val) => setDepartmentId(val)}
                  disabled={isSubmitting}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("noDepartment")}</SelectItem>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field>
                <FieldLabel>{t("locationLabel")}</FieldLabel>
                <Select
                  value={activityLocationId}
                  onValueChange={(val) => setActivityLocationId(val)}
                  disabled={isSubmitting}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("noLocation")}</SelectItem>
                    {locations.map((loc) => (
                      <SelectItem key={loc.id} value={loc.id}>
                        {loc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <Field>
              <FieldLabel>{t("statusLabel")}</FieldLabel>
              <Select
                value={isActive}
                onValueChange={(val: "active" | "inactive") => setIsActive(val)}
                disabled={isSubmitting}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">
                    {tCommon("status.active")}
                  </SelectItem>
                  <SelectItem value="inactive">
                    {tCommon("status.inactive")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </Field>
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
              {isSubmitting
                ? tCommon("actions.saving")
                : tCommon("actions.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
