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
import { provisionAccountAction } from "@/features/organization/members/actions";

const formSchema = z.object({
  email: z.string().email("Valid email is required"),
  username: z.string().max(50).optional(),
  password: z.string().min(8, "Minimum 8 characters"),
});

type FormValues = z.infer<typeof formSchema>;

export interface AccountProvisionDialogProps {
  memberId: string | null;
  defaultEmail?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function AccountProvisionDialog({
  memberId,
  defaultEmail,
  open,
  onOpenChange,
  onSuccess,
}: AccountProvisionDialogProps) {
  const t = useTranslations("members");

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: defaultEmail || "",
      username: "",
      password: "",
    },
  });

  React.useEffect(() => {
    reset({
      email: defaultEmail || "",
      username: "",
      password: "",
    });
  }, [defaultEmail, reset]);

  const onSubmit = async (values: FormValues) => {
    if (!memberId) return;
    try {
      const res = await provisionAccountAction({
        memberId,
        email: values.email,
        username: values.username || null,
        password: values.password,
      });

      if (res?.serverError) {
        toast.error(res.serverError);
        return;
      }

      toast.success(t("successAccountProvisioned"));
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
          <DialogTitle>{t("provisionAccountTitle")}</DialogTitle>
          <DialogDescription>
            {t("provisionAccountDescription")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FieldGroup>
            <Controller
              name="email"
              control={control}
              render={({ field }) => (
                <Field data-invalid={!!errors.email}>
                  <FieldLabel>{t("email")}</FieldLabel>
                  <Input {...field} placeholder={t("emailPlaceholder")} />
                  {errors.email && (
                    <FieldError>{errors.email.message}</FieldError>
                  )}
                </Field>
              )}
            />

            <Controller
              name="username"
              control={control}
              render={({ field }) => (
                <Field data-invalid={!!errors.username}>
                  <FieldLabel>{t("username")}</FieldLabel>
                  <Input {...field} placeholder={t("usernamePlaceholder")} />
                  {errors.username && (
                    <FieldError>{errors.username.message}</FieldError>
                  )}
                </Field>
              )}
            />

            <Controller
              name="password"
              control={control}
              render={({ field }) => (
                <Field data-invalid={!!errors.password}>
                  <FieldLabel>{t("password")}</FieldLabel>
                  <Input
                    type="password"
                    {...field}
                    placeholder={t("passwordPlaceholder")}
                  />
                  {errors.password && (
                    <FieldError>{errors.password.message}</FieldError>
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
