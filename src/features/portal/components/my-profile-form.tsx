"use client";

import {
  Building2,
  Calendar,
  IdCard,
  Loader2,
  Phone,
  Save,
  Shield,
  Upload,
} from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateMyProfileAction } from "@/features/portal/actions";

export interface MyProfileData {
  id: string;
  fullName: string;
  memberNumber?: string | null;
  departmentName?: string | null;
  positionName?: string | null;
  phone?: string | null;
  address?: string | null;
  birthDate?: string | null;
  profilePhoto?: string | null;
}

export interface MyProfileFormProps {
  member: MyProfileData;
}

export function MyProfileForm({ member }: MyProfileFormProps) {
  const t = useTranslations("portal");
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const [phone, setPhone] = React.useState(member.phone ?? "");
  const [address, setAddress] = React.useState(member.address ?? "");
  const [birthDate, setBirthDate] = React.useState(member.birthDate ?? "");
  const [photoPreview, setPhotoPreview] = React.useState<string | null>(
    member.profilePhoto ? `/${member.profilePhoto}` : null,
  );
  const [photoBase64, setPhotoBase64] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error(t("photoSizeError"));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setPhotoPreview(result);
      setPhotoBase64(result);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await updateMyProfileAction({
        phone: phone.trim() || null,
        address: address.trim() || null,
        birthDate: birthDate.trim() || null,
        profilePhotoBase64: photoBase64,
      });

      if (res?.data?.success) {
        toast.success(t("profileUpdateSuccess"));
      } else {
        toast.error(res?.serverError ?? t("profileUpdateError"));
      }
    } catch {
      toast.error(t("profileUpdateError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Non-Editable Affiliation Card */}
      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="relative">
              <Avatar className="size-20 border-2 border-primary/20 shadow-sm">
                <AvatarImage
                  src={photoPreview ?? undefined}
                  alt={member.fullName}
                />
                <AvatarFallback className="text-xl font-bold bg-primary/10 text-primary">
                  {member.fullName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="absolute -bottom-1 -right-1 size-7 rounded-full shadow-sm bg-background"
                onClick={() => fileInputRef.current?.click()}
                title={t("uploadPhoto")}
                aria-label={t("uploadPhoto")}
              >
                <Upload className="size-3.5" />
              </Button>
              <Input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoSelect}
                className="hidden"
                aria-label={t("uploadPhoto")}
              />
            </div>

            <div className="space-y-1">
              <CardTitle className="text-xl font-bold">
                {member.fullName}
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Badge variant="outline" className="flex items-center gap-1">
                  <IdCard className="size-3" />
                  <span>{member.memberNumber ?? t("noNpa")}</span>
                </Badge>
                {member.departmentName && (
                  <Badge
                    variant="secondary"
                    className="flex items-center gap-1"
                  >
                    <Building2 className="size-3" />
                    <span>{member.departmentName}</span>
                  </Badge>
                )}
                {member.positionName && (
                  <Badge
                    variant="secondary"
                    className="flex items-center gap-1"
                  >
                    <Shield className="size-3" />
                    <span>{member.positionName}</span>
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Editable Contact Information Form */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-bold">
            {t("contactInfoTitle")}
          </CardTitle>
          <CardDescription>{t("contactInfoSubtitle")}</CardDescription>
        </CardHeader>

        <form onSubmit={handleSave}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label
                htmlFor="profile-phone"
                className="flex items-center gap-1.5"
              >
                <Phone className="size-4 text-muted-foreground" />
                <span>{t("phoneLabel")}</span>
              </Label>
              <Input
                id="profile-phone"
                placeholder={t("phonePlaceholder")}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="profile-address"
                className="flex items-center gap-1.5"
              >
                <Building2 className="size-4 text-muted-foreground" />
                <span>{t("addressLabel")}</span>
              </Label>
              <Textarea
                id="profile-address"
                placeholder={t("addressPlaceholder")}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="profile-birthdate"
                className="flex items-center gap-1.5"
              >
                <Calendar className="size-4 text-muted-foreground" />
                <span>{t("birthDateLabel")}</span>
              </Label>
              <Input
                id="profile-birthdate"
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
              />
            </div>
          </CardContent>

          <div className="p-6 pt-2 flex justify-end">
            <Button type="submit" disabled={saving} className="gap-2">
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              <span>{saving ? t("saving") : t("saveChanges")}</span>
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
