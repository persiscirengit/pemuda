"use client";

import { CheckCircle2, Loader2, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitMemberPermissionAction } from "@/features/activities/checkin/actions";

export interface LeaveRequestFormProps {
  token: string;
}

export function LeaveRequestForm({ token }: LeaveRequestFormProps) {
  const t = useTranslations("attendance.checkin");
  const tCommon = useTranslations("common");
  const router = useRouter();

  const [reason, setReason] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = reason.trim();
    if (!trimmed) {
      toast.error(t("reasonRequired"));
      return;
    }
    if (trimmed.length > 500) {
      toast.error(t("reasonMaxLength"));
      return;
    }

    setSubmitting(true);
    try {
      const res = await submitMemberPermissionAction({
        token,
        reason: trimmed,
      });

      if (res?.data?.success) {
        toast.success(t("absenceSuccess"));
        setSubmitted(true);
        router.refresh();
      } else {
        toast.error(tCommon("status.error"));
      }
    } catch {
      toast.error(tCommon("status.error"));
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="space-y-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-6 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-600 text-white">
          <CheckCircle2 className="size-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-emerald-900 dark:text-emerald-300">
            {t("absenceSuccess")}
          </h3>
          <p className="text-xs text-muted-foreground">{reason}</p>
        </div>
      </div>
    );
  }

  const charsLeft = 500 - reason.length;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="absence-reason" className="text-sm font-semibold">
          {t("reasonLabel")}
        </Label>
        <Textarea
          id="absence-reason"
          placeholder={t("reasonPlaceholder")}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={4}
          maxLength={500}
          className="resize-none"
          disabled={submitting}
        />
        <div className="flex justify-end">
          <span className="font-mono text-xs text-muted-foreground">
            {charsLeft}
          </span>
        </div>
      </div>

      <Button
        type="submit"
        size="lg"
        disabled={submitting || !reason.trim()}
        className="h-12 w-full text-base font-bold shadow-md gap-2"
      >
        {submitting ? (
          <>
            <Loader2 className="size-5 animate-spin" />
            <span>{t("submittingAbsence")}</span>
          </>
        ) : (
          <>
            <Send className="size-5" />
            <span>{t("submitAbsenceButton")}</span>
          </>
        )}
      </Button>
    </form>
  );
}
