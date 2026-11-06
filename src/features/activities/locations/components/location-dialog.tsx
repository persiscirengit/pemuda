"use client";

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
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ActivityLocation } from "@/db/schema/activities";
import {
  createActivityLocationAction,
  updateActivityLocationAction,
} from "../actions";

export interface LocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  location?: ActivityLocation | null;
  onSuccess?: () => void;
}

export function LocationDialog({
  open,
  onOpenChange,
  location,
  onSuccess,
}: LocationDialogProps) {
  const t = useTranslations("activities.locations");
  const tCommon = useTranslations("common");

  const [name, setName] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [latitude, setLatitude] = React.useState("");
  const [longitude, setLongitude] = React.useState("");
  const [radiusMeters, setRadiusMeters] = React.useState("100");
  const [isActive, setIsActive] = React.useState<"active" | "inactive">(
    "active",
  );
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (location) {
      setName(location.name);
      setAddress(location.address ?? "");
      setLatitude(location.latitude ?? "");
      setLongitude(location.longitude ?? "");
      setRadiusMeters(String(location.radiusMeters ?? 100));
      setIsActive(location.isActive ? "active" : "inactive");
    } else {
      setName("");
      setAddress("");
      setLatitude("");
      setLongitude("");
      setRadiusMeters("100");
      setIsActive("active");
    }
    setError(null);
  }, [location]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError(t("nameLabel"));
      return;
    }

    const latNum = latitude.trim() !== "" ? Number(latitude) : null;
    const lngNum = longitude.trim() !== "" ? Number(longitude) : null;
    const radiusNum = Number(radiusMeters) || 100;

    if (
      latNum !== null &&
      (Number.isNaN(latNum) || latNum < -90 || latNum > 90)
    ) {
      setError(t("latitudeLabel"));
      return;
    }

    if (
      lngNum !== null &&
      (Number.isNaN(lngNum) || lngNum < -180 || lngNum > 180)
    ) {
      setError(t("longitudeLabel"));
      return;
    }

    if (radiusNum <= 0) {
      setError(t("radiusLabel"));
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (location) {
        const res = await updateActivityLocationAction({
          id: location.id,
          name: name.trim(),
          address: address.trim() || null,
          latitude: latNum !== null ? String(latNum) : null,
          longitude: lngNum !== null ? String(lngNum) : null,
          radiusMeters: radiusNum,
          isActive: isActive === "active",
        });

        if (res?.serverError) {
          setError(res.serverError);
          toast.error(res.serverError);
          return;
        }

        toast.success(t("updatedSuccess"));
      } else {
        const res = await createActivityLocationAction({
          name: name.trim(),
          address: address.trim() || null,
          latitude: latNum !== null ? String(latNum) : null,
          longitude: lngNum !== null ? String(lngNum) : null,
          radiusMeters: radiusNum,
          isActive: isActive === "active",
        });

        if (res?.serverError) {
          setError(res.serverError);
          toast.error(res.serverError);
          return;
        }

        toast.success(t("createdSuccess"));
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {location ? t("editLocation") : t("createLocation")}
            </DialogTitle>
            <DialogDescription>{t("subtitle")}</DialogDescription>
          </DialogHeader>

          <FieldGroup className="py-4">
            <Field>
              <FieldLabel>{t("nameLabel")}</FieldLabel>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("namePlaceholder")}
                disabled={isSubmitting}
                autoFocus
              />
              {error && <FieldError>{error}</FieldError>}
            </Field>

            <Field>
              <FieldLabel>{t("addressLabel")}</FieldLabel>
              <Textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder={t("addressPlaceholder")}
                disabled={isSubmitting}
                rows={2}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel>{t("latitudeLabel")}</FieldLabel>
                <Input
                  type="number"
                  step="any"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  placeholder={t("latitudePlaceholder")}
                  disabled={isSubmitting}
                />
              </Field>

              <Field>
                <FieldLabel>{t("longitudeLabel")}</FieldLabel>
                <Input
                  type="number"
                  step="any"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  placeholder={t("longitudePlaceholder")}
                  disabled={isSubmitting}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel>{t("radiusLabel")}</FieldLabel>
                <Input
                  type="number"
                  value={radiusMeters}
                  onChange={(e) => setRadiusMeters(e.target.value)}
                  placeholder={t("radiusPlaceholder")}
                  disabled={isSubmitting}
                />
              </Field>

              <Field>
                <FieldLabel>{t("statusLabel")}</FieldLabel>
                <Select
                  value={isActive}
                  onValueChange={(val: "active" | "inactive") =>
                    setIsActive(val)
                  }
                  disabled={isSubmitting}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">
                      {tCommon("status.active")}
                    </SelectItem>
                    <SelectItem value="inactive">
                      {tCommon("status.inactive")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </FieldGroup>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              {tCommon("actions.cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? tCommon("actions.saving")
                : tCommon("actions.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
