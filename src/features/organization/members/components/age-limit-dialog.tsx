"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { transitionAgeLimitAction } from "@/features/organization/members/actions";

export interface AgeLimitDialogProps {
  memberId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function AgeLimitDialog({
  memberId,
  open,
  onOpenChange,
  onSuccess,
}: AgeLimitDialogProps) {
  const t = useTranslations("members");

  const handleConfirm = async () => {
    if (!memberId) return;
    try {
      const res = await transitionAgeLimitAction({ id: memberId });
      if (res?.serverError) {
        toast.error(res.serverError);
        return;
      }
      toast.success(t("successAgeLimit"));
      onOpenChange(false);
      onSuccess?.();
    } catch {
      toast.error(t("errorGeneric"));
    }
  };

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("ageLimitDialogTitle")}
      description={t("ageLimitDialogDescription")}
      confirmLabel={t("confirmAgeLimit")}
      cancelLabel={t("cancel")}
      variant="destructive"
      onConfirm={handleConfirm}
    />
  );
}
