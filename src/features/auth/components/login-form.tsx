"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
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
import { authClient } from "@/lib/auth-client";

export interface LoginFormProps {
  onSignInEmail?: (args: {
    email: string;
    password: string;
  }) => Promise<{ data?: unknown; error?: unknown }>;
  onSignInUsername?: (args: {
    username: string;
    password: string;
  }) => Promise<{ data?: unknown; error?: unknown }>;
}

export function LoginForm({ onSignInEmail, onSignInUsername }: LoginFormProps) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const loginSchema = React.useMemo(
    () =>
      z.object({
        identifier: z.string().min(1, { message: t("identifierRequired") }),
        password: z.string().min(8, { message: t("passwordMinLength") }),
      }),
    [t],
  );

  type LoginFormValues = z.infer<typeof loginSchema>;

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      identifier: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginFormValues) => {
    setIsSubmitting(true);
    const isEmail = data.identifier.includes("@");

    try {
      if (isEmail) {
        const result = onSignInEmail
          ? await onSignInEmail({
              email: data.identifier,
              password: data.password,
            })
          : await authClient.signIn.email({
              email: data.identifier,
              password: data.password,
            });

        if (result.error) {
          toast.error(t("invalidCredentials"));
          setError("identifier", { message: t("invalidCredentials") });
          setIsSubmitting(false);
          return;
        }
      } else {
        const result = onSignInUsername
          ? await onSignInUsername({
              username: data.identifier,
              password: data.password,
            })
          : await authClient.signIn.username({
              username: data.identifier,
              password: data.password,
            });

        if (result.error) {
          toast.error(t("invalidCredentials"));
          setError("identifier", { message: t("invalidCredentials") });
          setIsSubmitting(false);
          return;
        }
      }

      toast.success(t("loginSuccess"));
      router.push("/dashboard");
      router.refresh();
    } catch {
      toast.error(t("invalidCredentials"));
      setError("identifier", { message: t("invalidCredentials") });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-md shadow-md">
      <CardHeader className="text-center space-y-1">
        <CardTitle className="text-2xl font-bold tracking-tight">
          {t("loginTitle")}
        </CardTitle>
        <CardDescription>{t("loginSubtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FieldGroup className="space-y-4">
            <Controller
              name="identifier"
              control={control}
              render={({ field }) => (
                <Field data-invalid={!!errors.identifier}>
                  <FieldLabel htmlFor="identifier">
                    {t("emailOrNpaLabel")}
                  </FieldLabel>
                  <Input
                    {...field}
                    id="identifier"
                    autoComplete="username"
                    placeholder={t("emailOrNpaPlaceholder")}
                    aria-label={t("emailOrNpaLabel")}
                    disabled={isSubmitting}
                  />
                  {errors.identifier?.message && (
                    <FieldError>{errors.identifier.message}</FieldError>
                  )}
                </Field>
              )}
            />

            <Controller
              name="password"
              control={control}
              render={({ field }) => (
                <Field data-invalid={!!errors.password}>
                  <FieldLabel htmlFor="password">
                    {t("passwordLabel")}
                  </FieldLabel>
                  <Input
                    {...field}
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder={t("passwordPlaceholder")}
                    aria-label={t("passwordLabel")}
                    disabled={isSubmitting}
                  />
                  {errors.password?.message && (
                    <FieldError>{errors.password.message}</FieldError>
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
            {isSubmitting ? t("signingIn") : t("signInButton")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
