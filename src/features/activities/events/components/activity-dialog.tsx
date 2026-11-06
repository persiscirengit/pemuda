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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Activity } from "@/db/schema/activities";
import { createActivityAction, updateActivityAction } from "../actions";

export interface ActivityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activity?: Activity | null;
  departments?: { id: string; name: string }[];
  members?: { id: string; fullName: string; memberNumber?: string | null }[];
  onSuccess?: () => void;
}

export function ActivityDialog({
  open,
  onOpenChange,
  activity,
  departments = [],
  members = [],
  onSuccess,
}: ActivityDialogProps) {
  const t = useTranslations("activities.events");
  const tCommon = useTranslations("common");

  const [title, setTitle] = React.useState("");
  const [topic, setTopic] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [activityDate, setActivityDate] = React.useState("");
  const [startTime, setStartTime] = React.useState("");
  const [endTime, setEndTime] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [departmentId, setDepartmentId] = React.useState<string>("none");
  const [picId, setPicId] = React.useState<string>("none");
  const [attendanceEnabled, setAttendanceEnabled] =
    React.useState<string>("true");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (activity) {
      setTitle(activity.title);
      setTopic(activity.topic || "");
      setDescription(activity.description || "");
      setActivityDate(activity.activityDate);
      setStartTime(activity.startTime?.slice(0, 5) || "");
      setEndTime(activity.endTime?.slice(0, 5) || "");
      setLocation(activity.location || "");
      setDepartmentId(activity.departmentId || "none");
      setPicId(activity.picId || "none");
      setAttendanceEnabled(activity.attendanceEnabled ? "true" : "false");
    } else {
      setTitle("");
      setTopic("");
      setDescription("");
      setActivityDate(new Date().toISOString().slice(0, 10));
      setStartTime("08:00");
      setEndTime("10:00");
      setLocation("");
      setDepartmentId("none");
      setPicId("none");
      setAttendanceEnabled("true");
    }
  }, [activity]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast.error(tCommon("errors.required"));
      return;
    }

    if (!activityDate) {
      toast.error(tCommon("errors.required"));
      return;
    }

    if (startTime && endTime && endTime <= startTime) {
      toast.error(tCommon("errors.timeOrder"));
      return;
    }

    setIsSubmitting(true);
    try {
      if (activity) {
        const res = await updateActivityAction({
          id: activity.id,
          title: title.trim(),
          topic: topic.trim() ? topic.trim() : null,
          description: description.trim() ? description.trim() : null,
          activityDate,
          startTime: startTime || null,
          endTime: endTime || null,
          location: location.trim() ? location.trim() : null,
          departmentId: departmentId === "none" ? null : departmentId,
          picId: picId === "none" ? null : picId,
          attendanceEnabled: attendanceEnabled === "true",
        });

        if (res?.data?.activity) {
          toast.success(t("updatedSuccess"));
          onOpenChange(false);
          onSuccess?.();
        } else if (res?.serverError) {
          toast.error(res.serverError);
        }
      } else {
        const res = await createActivityAction({
          title: title.trim(),
          topic: topic.trim() ? topic.trim() : null,
          description: description.trim() ? description.trim() : null,
          activityDate,
          startTime: startTime || null,
          endTime: endTime || null,
          location: location.trim() ? location.trim() : null,
          departmentId: departmentId === "none" ? null : departmentId,
          picId: picId === "none" ? null : picId,
          attendanceEnabled: attendanceEnabled === "true",
        });

        if (res?.data?.activity) {
          toast.success(t("createdSuccess"));
          onOpenChange(false);
          onSuccess?.();
        } else if (res?.serverError) {
          toast.error(res.serverError);
        }
      }
    } catch {
      toast.error(tCommon("errors.unexpected"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {activity ? t("editActivity") : t("createActivity")}
          </DialogTitle>
          <DialogDescription>{t("subtitle")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <FieldGroup className="space-y-4">
            <Field>
              <FieldLabel>{t("titleLabel")}</FieldLabel>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("titlePlaceholder")}
                required
              />
            </Field>

            <Field>
              <FieldLabel>{t("topicLabel")}</FieldLabel>
              <Input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder={t("topicPlaceholder")}
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field>
                <FieldLabel>{t("dateLabel")}</FieldLabel>
                <Input
                  type="date"
                  value={activityDate}
                  onChange={(e) => setActivityDate(e.target.value)}
                  required
                />
              </Field>

              <Field>
                <FieldLabel>{t("startTimeLabel")}</FieldLabel>
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </Field>

              <Field>
                <FieldLabel>{t("endTimeLabel")}</FieldLabel>
                <Input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </Field>
            </div>

            <Field>
              <FieldLabel>{t("locationLabel")}</FieldLabel>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder={t("locationLabel")}
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel>{t("departmentLabel")}</FieldLabel>
                <Select value={departmentId} onValueChange={setDepartmentId}>
                  <SelectTrigger>
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
                <FieldLabel>{t("picLabel")}</FieldLabel>
                <Select value={picId} onValueChange={setPicId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("noPic")}</SelectItem>
                    {members.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <Field>
              <FieldLabel>{t("attendanceEnabledLabel")}</FieldLabel>
              <Select
                value={attendanceEnabled}
                onValueChange={setAttendanceEnabled}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">
                    {tCommon("status.active")}
                  </SelectItem>
                  <SelectItem value="false">
                    {tCommon("status.inactive")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel>{t("descriptionLabel")}</FieldLabel>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("descriptionPlaceholder")}
                rows={2}
              />
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
              {activity ? tCommon("actions.save") : t("createButton")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
