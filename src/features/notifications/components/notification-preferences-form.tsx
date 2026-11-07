"use client";

import { ArrowLeft, Bell, Check, Loader2, Smartphone } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { updateNotificationPreferencesAction } from "@/features/notifications/actions";
import type { NotificationPreferenceEntry } from "@/server/dal/notifications/preferences";

export interface NotificationPreferencesFormProps {
  initialPreferences: NotificationPreferenceEntry[];
}

export function NotificationPreferencesForm({
  initialPreferences,
}: NotificationPreferencesFormProps) {
  const t = useTranslations("notifications");
  const [preferences, setPreferences] =
    useState<NotificationPreferenceEntry[]>(initialPreferences);
  const [isPending, startTransition] = useTransition();

  const handleToggle = (
    category: NotificationPreferenceEntry["category"],
    channel: "inAppEnabled" | "pushEnabled",
    value: boolean,
  ) => {
    setPreferences((prev) =>
      prev.map((item) =>
        item.category === category ? { ...item, [channel]: value } : item,
      ),
    );
  };

  const handleSave = () => {
    startTransition(async () => {
      const res = await updateNotificationPreferencesAction({
        preferences,
      });

      if (res?.data?.success) {
        toast.success(t("preferencesSaved"));
      } else {
        toast.error(t("preferencesError"));
      }
    });
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild className="-ml-3">
          <Link href="/dashboard/notifications">
            <ArrowLeft className="mr-2 h-4 w-4" />
            <span>{t("title")}</span>
          </Link>
        </Button>

        <Button onClick={handleSave} disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              <span>{t("saving")}</span>
            </>
          ) : (
            <>
              <Check className="mr-2 h-4 w-4" />
              <span>{t("savePreferences")}</span>
            </>
          )}
        </Button>
      </div>

      <div className="space-y-4">
        {preferences.map((pref) => {
          return (
            <Card key={pref.category} className="border-border/80">
              <CardHeader className="p-4 sm:p-5 pb-3">
                <CardTitle className="text-base font-semibold text-foreground">
                  {t(`categories.${pref.category}.title`)}
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  {t(`categories.${pref.category}.description`)}
                </CardDescription>
              </CardHeader>

              <CardContent className="px-4 pb-4 sm:px-5 sm:pb-5 pt-0">
                <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-6 pt-3 border-t border-border/40">
                  <div className="flex items-center justify-between sm:justify-start gap-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                      <Bell className="h-3.5 w-3.5" />
                      <span>{t("inAppChannel")}</span>
                    </div>
                    <Switch
                      checked={pref.inAppEnabled}
                      onCheckedChange={(checked) =>
                        handleToggle(pref.category, "inAppEnabled", checked)
                      }
                      disabled={isPending}
                      aria-label={t("inAppChannel")}
                    />
                  </div>

                  <div className="flex items-center justify-between sm:justify-start gap-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                      <Smartphone className="h-3.5 w-3.5" />
                      <span>{t("pushChannel")}</span>
                    </div>
                    <Switch
                      checked={pref.pushEnabled}
                      onCheckedChange={(checked) =>
                        handleToggle(pref.category, "pushEnabled", checked)
                      }
                      disabled={isPending}
                      aria-label={t("pushChannel")}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex justify-end pt-2">
        <Button onClick={handleSave} disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              <span>{t("saving")}</span>
            </>
          ) : (
            <>
              <Check className="mr-2 h-4 w-4" />
              <span>{t("savePreferences")}</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
