"use client";

import { ImageIcon, Save, Upload } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  updateSettingsAction,
  uploadSettingAssetAction,
} from "../actions/settings";

export interface SettingsFormProps {
  initialSettings: Record<string, string>;
  canManage?: boolean;
}

export function SettingsForm({
  initialSettings,
  canManage = true,
}: SettingsFormProps) {
  const t = useTranslations("organization.settings");
  const tCommon = useTranslations("common");
  const router = useRouter();

  const [settings, setSettings] =
    React.useState<Record<string, string>>(initialSettings);
  const [isSaving, setIsSaving] = React.useState(false);
  const [uploadingLogo, setUploadingLogo] = React.useState(false);
  const [uploadingFavicon, setUploadingFavicon] = React.useState(false);

  const logoInputRef = React.useRef<HTMLInputElement | null>(null);
  const faviconInputRef = React.useRef<HTMLInputElement | null>(null);

  const handleChange = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleFileUpload = async (key: "app_logo" | "favicon", file: File) => {
    const isLogo = key === "app_logo";
    if (isLogo) setUploadingLogo(true);
    else setUploadingFavicon(true);

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
      });
      reader.readAsDataURL(file);
      const base64Data = await base64Promise;

      const res = await uploadSettingAssetAction({
        key,
        fileData: base64Data,
      });

      if (res?.serverError) {
        toast.error(res.serverError);
        return;
      }

      if (res?.data?.key) {
        handleChange(key, res.data.key);
      }

      toast.success(t("uploadSuccess"));
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      if (isLogo) setUploadingLogo(false);
      else setUploadingFavicon(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await updateSettingsAction(settings);
      if (res?.serverError) {
        toast.error(res.serverError);
        return;
      }

      toast.success(t("savedSuccess"));
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSaving(false);
    }
  };

  const renderAssetPreview = (key: "app_logo" | "favicon") => {
    const assetPath = settings[key];
    if (!assetPath) {
      return (
        <div className="flex size-16 items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 text-muted-foreground">
          <ImageIcon className="size-6" />
        </div>
      );
    }

    const src = assetPath.startsWith("http") ? assetPath : `/${assetPath}`;
    return (
      <div className="relative size-16 overflow-hidden rounded-lg border border-border bg-muted/20">
        <Image
          src={src}
          alt={key}
          fill
          unoptimized
          className="object-contain p-1"
        />
      </div>
    );
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <Tabs defaultValue="general" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="general">{t("tabs.general")}</TabsTrigger>
          <TabsTrigger value="attendance">{t("tabs.attendance")}</TabsTrigger>
          <TabsTrigger value="notifications">
            {t("tabs.notifications")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>{t("tabs.general")}</CardTitle>
              <CardDescription>{t("subtitle")}</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel>{t("fields.appName")}</FieldLabel>
                  <Input
                    value={settings.app_name || ""}
                    onChange={(e) => handleChange("app_name", e.target.value)}
                    placeholder={t("fields.appNamePlaceholder")}
                    disabled={!canManage || isSaving}
                  />
                </Field>

                <Field>
                  <FieldLabel>{t("fields.organizationName")}</FieldLabel>
                  <Input
                    value={settings.organization_name || ""}
                    onChange={(e) =>
                      handleChange("organization_name", e.target.value)
                    }
                    placeholder={t("fields.organizationNamePlaceholder")}
                    disabled={!canManage || isSaving}
                  />
                </Field>

                <Field>
                  <FieldLabel>{t("fields.themeMode")}</FieldLabel>
                  <Select
                    value={settings.theme_mode || "light"}
                    onValueChange={(val) => handleChange("theme_mode", val)}
                    disabled={!canManage || isSaving}
                  >
                    <SelectTrigger className="w-full max-w-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">
                        {tCommon("themes.light")}
                      </SelectItem>
                      <SelectItem value="dark">
                        {tCommon("themes.dark")}
                      </SelectItem>
                      <SelectItem value="system">
                        {tCommon("themes.system")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </Field>

                <div className="grid grid-cols-1 gap-6 pt-2 sm:grid-cols-2">
                  <Field>
                    <FieldLabel>{t("fields.appLogo")}</FieldLabel>
                    <div className="flex items-center gap-4">
                      {renderAssetPreview("app_logo")}
                      {canManage && (
                        <div>
                          <Input
                            ref={logoInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleFileUpload("app_logo", file);
                            }}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={uploadingLogo || isSaving}
                            onClick={() => logoInputRef.current?.click()}
                            className="gap-1.5"
                          >
                            <Upload className="size-4" />
                            {uploadingLogo
                              ? t("fields.uploading")
                              : t("fields.uploadLogo")}
                          </Button>
                        </div>
                      )}
                    </div>
                  </Field>

                  <Field>
                    <FieldLabel>{t("fields.favicon")}</FieldLabel>
                    <div className="flex items-center gap-4">
                      {renderAssetPreview("favicon")}
                      {canManage && (
                        <div>
                          <Input
                            ref={faviconInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleFileUpload("favicon", file);
                            }}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={uploadingFavicon || isSaving}
                            onClick={() => faviconInputRef.current?.click()}
                            className="gap-1.5"
                          >
                            <Upload className="size-4" />
                            {uploadingFavicon
                              ? t("fields.uploading")
                              : t("fields.uploadFavicon")}
                          </Button>
                        </div>
                      )}
                    </div>
                  </Field>
                </div>
              </FieldGroup>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attendance">
          <Card>
            <CardHeader>
              <CardTitle>{t("tabs.attendance")}</CardTitle>
              <CardDescription>{t("subtitle")}</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel>{t("fields.defaultRadius")}</FieldLabel>
                  <Input
                    type="number"
                    value={settings.default_attendance_radius || "100"}
                    onChange={(e) =>
                      handleChange("default_attendance_radius", e.target.value)
                    }
                    disabled={!canManage || isSaving}
                  />
                </Field>

                <Field>
                  <FieldLabel>{t("fields.openMinutesBefore")}</FieldLabel>
                  <Input
                    type="number"
                    value={
                      settings.default_attendance_open_minutes_before || "30"
                    }
                    onChange={(e) =>
                      handleChange(
                        "default_attendance_open_minutes_before",
                        e.target.value,
                      )
                    }
                    disabled={!canManage || isSaving}
                  />
                </Field>

                <Field>
                  <FieldLabel>{t("fields.closeMinutesAfter")}</FieldLabel>
                  <Input
                    type="number"
                    value={
                      settings.default_attendance_close_minutes_after || "30"
                    }
                    onChange={(e) =>
                      handleChange(
                        "default_attendance_close_minutes_after",
                        e.target.value,
                      )
                    }
                    disabled={!canManage || isSaving}
                  />
                </Field>

                <Field>
                  <FieldLabel>{t("fields.accuracyTolerance")}</FieldLabel>
                  <Input
                    type="number"
                    value={settings.default_location_accuracy_tolerance || "50"}
                    onChange={(e) =>
                      handleChange(
                        "default_location_accuracy_tolerance",
                        e.target.value,
                      )
                    }
                    disabled={!canManage || isSaving}
                  />
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>{t("tabs.notifications")}</CardTitle>
              <CardDescription>{t("subtitle")}</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel>{t("fields.whatsappTemplate")}</FieldLabel>
                  <Textarea
                    rows={8}
                    value={settings.whatsapp_group_reminder_template || ""}
                    onChange={(e) =>
                      handleChange(
                        "whatsapp_group_reminder_template",
                        e.target.value,
                      )
                    }
                    disabled={!canManage || isSaving}
                    className="font-mono text-sm leading-relaxed"
                  />
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {canManage && (
        <div className="flex justify-end">
          <Button type="submit" disabled={isSaving} className="gap-2">
            <Save className="size-4" />
            {isSaving ? tCommon("actions.saving") : t("saveButton")}
          </Button>
        </div>
      )}
    </form>
  );
}
