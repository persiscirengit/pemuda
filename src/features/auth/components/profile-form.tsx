"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, Shield, User as UserIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { updatePasswordAction } from "@/features/auth/actions/update-password";

export interface ProfileFormProps {
  user: {
    name: string;
    email: string;
    username?: string | null;
    memberId?: string | null;
  };
  permissions: readonly string[] | string[];
}

export function ProfileForm({ user, permissions }: ProfileFormProps) {
  const t = useTranslations("auth");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const passwordSchema = React.useMemo(
    () =>
      z
        .object({
          currentPassword: z
            .string()
            .min(1, { message: t("currentPasswordRequired") }),
          newPassword: z.string().min(8, { message: t("passwordMinLength") }),
          confirmPassword: z
            .string()
            .min(8, { message: t("passwordMinLength") }),
        })
        .refine((data) => data.newPassword === data.confirmPassword, {
          message: t("passwordMismatch"),
          path: ["confirmPassword"],
        }),
    [t],
  );

  type PasswordFormValues = z.infer<typeof passwordSchema>;

  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const onUpdatePassword = async (data: PasswordFormValues) => {
    setIsSubmitting(true);
    try {
      const res = await updatePasswordAction(data);

      if (res?.serverError) {
        if (res.serverError === "currentPasswordIncorrect") {
          setError("currentPassword", {
            message: t("currentPasswordIncorrect"),
          });
          toast.error(t("currentPasswordIncorrect"));
        } else {
          toast.error(res.serverError);
        }
        return;
      }

      toast.success(t("passwordUpdatedSuccess"));
      reset();
    } catch {
      toast.error(t("currentPasswordIncorrect"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const permissionsHeader = `${t("permissionsLabel")} (${permissions.length})`;

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Account Profile Details */}
      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <UserIcon className="size-5 text-primary" />
            <CardTitle>{t("profileTitle")}</CardTitle>
          </div>
          <CardDescription>{t("profileSubtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <span className="text-xs font-medium text-muted-foreground">
              {t("nameLabel")}
            </span>
            <p className="text-base font-semibold">{user.name}</p>
          </div>

          <div>
            <span className="text-xs font-medium text-muted-foreground">
              {t("emailLabel")}
            </span>
            <p className="text-base font-semibold">{user.email}</p>
          </div>

          <div>
            <span className="text-xs font-medium text-muted-foreground">
              {t("npaLabel")}
            </span>
            <p className="text-base font-semibold">
              {user.username ?? t("notLinked")}
            </p>
          </div>

          <div className="pt-2 border-t">
            <div className="flex items-center gap-1.5 mb-2">
              <Shield className="size-4 text-primary" />
              <span className="text-xs font-medium text-muted-foreground">
                {permissionsHeader}
              </span>
            </div>
            {permissions.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                {t("noPermissions")}
              </p>
            ) : (
              <div className="flex flex-wrap gap-1 max-h-48 overflow-y-auto pt-1">
                {permissions.map((perm) => (
                  <Badge
                    key={perm}
                    variant="secondary"
                    className="text-[10px] font-mono"
                  >
                    {perm}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Password Change Form */}
      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <KeyRound className="size-5 text-primary" />
            <CardTitle>{t("securityTitle")}</CardTitle>
          </div>
          <CardDescription>{t("securitySubtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onUpdatePassword)} className="space-y-4">
            <FieldGroup className="space-y-4">
              <Controller
                name="currentPassword"
                control={control}
                render={({ field }) => (
                  <Field data-invalid={!!errors.currentPassword}>
                    <FieldLabel htmlFor="currentPassword">
                      {t("currentPasswordLabel")}
                    </FieldLabel>
                    <Input
                      {...field}
                      id="currentPassword"
                      type="password"
                      autoComplete="current-password"
                      placeholder={t("currentPasswordPlaceholder")}
                      aria-label={t("currentPasswordLabel")}
                      disabled={isSubmitting}
                    />
                    {errors.currentPassword?.message && (
                      <FieldError>{errors.currentPassword.message}</FieldError>
                    )}
                  </Field>
                )}
              />

              <Controller
                name="newPassword"
                control={control}
                render={({ field }) => (
                  <Field data-invalid={!!errors.newPassword}>
                    <FieldLabel htmlFor="newPassword">
                      {t("newPasswordLabel")}
                    </FieldLabel>
                    <Input
                      {...field}
                      id="newPassword"
                      type="password"
                      autoComplete="new-password"
                      placeholder={t("newPasswordPlaceholder")}
                      aria-label={t("newPasswordLabel")}
                      disabled={isSubmitting}
                    />
                    {errors.newPassword?.message && (
                      <FieldError>{errors.newPassword.message}</FieldError>
                    )}
                  </Field>
                )}
              />

              <Controller
                name="confirmPassword"
                control={control}
                render={({ field }) => (
                  <Field data-invalid={!!errors.confirmPassword}>
                    <FieldLabel htmlFor="confirmPassword">
                      {t("confirmPasswordLabel")}
                    </FieldLabel>
                    <Input
                      {...field}
                      id="confirmPassword"
                      type="password"
                      autoComplete="new-password"
                      placeholder={t("confirmPasswordPlaceholder")}
                      aria-label={t("confirmPasswordLabel")}
                      disabled={isSubmitting}
                    />
                    {errors.confirmPassword?.message && (
                      <FieldError>{errors.confirmPassword.message}</FieldError>
                    )}
                  </Field>
                )}
              />
            </FieldGroup>

            <Button
              type="submit"
              className="w-full mt-2 font-medium"
              disabled={isSubmitting}
            >
              {isSubmitting ? t("updatingPassword") : t("updatePasswordButton")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
