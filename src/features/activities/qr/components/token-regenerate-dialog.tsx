"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
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
import { regenerateAttendanceTokenAction } from "@/features/activities/qr/actions";

export interface TokenRegenerateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activityId: string;
}

export function TokenRegenerateDialog({
  open,
  onOpenChange,
  activityId,
}: TokenRegenerateDialogProps) {
  const t = useTranslations("attendance.qr");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [submitting, setSubmitting] = React.useState(false);

  const handleRegenerate = async () => {
    setSubmitting(true);
    try {
      const result = await regenerateAttendanceTokenAction({ activityId });
      if (result?.data?.success) {
        toast.success(t("regeneratedSuccess"));
        onOpenChange(false);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-amber-600" />
            <DialogTitle>{t("regenerateConfirmTitle")}</DialogTitle>
          </div>
          <DialogDescription>{t("regenerateConfirmDesc")}</DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            {tCommon("actions.cancel")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleRegenerate}
            disabled={submitting}
          >
            <RefreshCw
              className={`mr-2 size-4 ${submitting ? "animate-spin" : ""}`}
            />
            <span>
              {submitting ? t("regenerating") : t("regenerateButton")}
            </span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
