"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
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
import { resetPasswordAction } from "@/features/organization/members/actions";

const formSchema = z.object({
  newPassword: z.string().min(8, "Minimum 8 characters"),
});

type FormValues = z.infer<typeof formSchema>;

export interface ResetPasswordDialogProps {
  memberId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function ResetPasswordDialog({
  memberId,
  open,
  onOpenChange,
  onSuccess,
}: ResetPasswordDialogProps) {
  const t = useTranslations("members");

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      newPassword: "",
    },
  });

  React.useEffect(() => {
    reset({ newPassword: "" });
  }, [reset]);

  const onSubmit = async (values: FormValues) => {
    if (!memberId) return;
    try {
      const res = await resetPasswordAction({
        memberId,
        newPassword: values.newPassword,
      });

      if (res?.serverError) {
        toast.error(res.serverError);
        return;
      }

      toast.success(t("successPasswordReset"));
      onOpenChange(false);
      onSuccess?.();
    } catch {
      toast.error(t("errorGeneric"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>{t("resetPasswordTitle")}</DialogTitle>
          <DialogDescription>{t("resetPasswordDescription")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FieldGroup>
            <Controller
              name="newPassword"
              control={control}
              render={({ field }) => (
                <Field data-invalid={!!errors.newPassword}>
                  <FieldLabel>{t("newPassword")}</FieldLabel>
                  <Input
                    type="password"
                    {...field}
                    placeholder={t("newPasswordPlaceholder")}
                  />
                  {errors.newPassword && (
                    <FieldError>{errors.newPassword.message}</FieldError>
                  )}
                </Field>
              )}
            />
          </FieldGroup>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t("saving") : t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
