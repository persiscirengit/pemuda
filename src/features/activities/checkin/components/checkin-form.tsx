"use client";

import { getDistance } from "geolib";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  LocateFixed,
  RefreshCw,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { submitMemberCheckInAction } from "@/features/activities/checkin/actions";
import type { ActivityCheckInDetails } from "@/server/dal/activities/checkin";
import { DistanceBadge } from "./distance-badge";

export interface CheckInFormProps {
  activity: ActivityCheckInDetails;
  token: string;
}

interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  loading: boolean;
  error: string | null;
}

export function CheckInForm({ activity, token }: CheckInFormProps) {
  const t = useTranslations("attendance.checkin");
  const tCommon = useTranslations("common");
  const router = useRouter();

  const [geo, setGeo] = React.useState<GeolocationState>({
    latitude: null,
    longitude: null,
    accuracy: null,
    loading: false,
    error: null,
  });

  const [submitting, setSubmitting] = React.useState(false);
  const [successResult, setSuccessResult] = React.useState<{
    status: string;
    distance: number;
  } | null>(null);

  const acquireLocation = React.useCallback(() => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setGeo((prev) => ({
        ...prev,
        error: t("locationUnavailable"),
        loading: false,
      }));
      return;
    }

    setGeo((prev) => ({ ...prev, loading: true, error: null }));

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGeo({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          loading: false,
          error: null,
        });
      },
      (err) => {
        let errorMsg = t("locationUnavailable");
        if (err.code === err.PERMISSION_DENIED) {
          errorMsg = t("locationDenied");
        } else if (err.code === err.TIMEOUT) {
          errorMsg = t("locationTimeout");
        }
        setGeo((prev) => ({
          ...prev,
          loading: false,
          error: errorMsg,
        }));
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 10000,
      },
    );
  }, [t]);

  React.useEffect(() => {
    acquireLocation();
  }, [acquireLocation]);

  const venueLat = activity.latitude;
  const venueLon = activity.longitude;

  const calculatedDistance = React.useMemo(() => {
    if (
      geo.latitude != null &&
      geo.longitude != null &&
      venueLat != null &&
      venueLon != null
    ) {
      return getDistance(
        { latitude: geo.latitude, longitude: geo.longitude },
        { latitude: venueLat, longitude: venueLon },
      );
    }
    return null;
  }, [geo.latitude, geo.longitude, venueLat, venueLon]);

  const handleCheckIn = async () => {
    if (geo.latitude == null || geo.longitude == null) {
      acquireLocation();
      return;
    }

    setSubmitting(true);
    try {
      const res = await submitMemberCheckInAction({
        token,
        latitude: geo.latitude,
        longitude: geo.longitude,
        locationAccuracy: geo.accuracy ?? undefined,
        method: "link",
      });

      if (res?.data?.success && res.data.data) {
        const result = res.data.data;
        setSuccessResult({
          status: result.status,
          distance: result.distance,
        });

        if (result.status === "present") {
          toast.success(t("checkInSuccessValid"));
        } else {
          toast.warning(t("checkInSuccessNeedVerification"));
        }

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

  if (successResult) {
    const isPresent = successResult.status === "present";
    const distanceText = `${t("distanceLabel")}: ${Math.round(successResult.distance)}m`;
    return (
      <div className="space-y-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-6 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-600 text-white">
          <CheckCircle2 className="size-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-emerald-900 dark:text-emerald-300">
            {isPresent
              ? t("checkInSuccessValid")
              : t("checkInSuccessNeedVerification")}
          </h3>
          <p className="font-mono text-xs text-muted-foreground">
            {distanceText}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Geolocation Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h4 className="text-sm font-semibold">{t("gpsSectionTitle")}</h4>
            <p className="text-xs text-muted-foreground">
              {t("gpsSectionDesc")}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={acquireLocation}
            disabled={geo.loading || submitting}
            className="h-8 gap-1.5 text-xs"
          >
            <RefreshCw
              className={`size-3.5 ${geo.loading ? "animate-spin" : ""}`}
            />
            <span>{t("refreshLocation")}</span>
          </Button>
        </div>

        {geo.loading && (
          <div className="flex items-center justify-center gap-2 rounded-xl border bg-muted/20 p-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin text-primary" />
            <span>{t("requestingLocation")}</span>
          </div>
        )}

        {geo.error && (
          <Card className="border-destructive/30 bg-destructive/10 p-3 shadow-none">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="size-4 shrink-0 text-destructive mt-0.5" />
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-destructive">
                  {tCommon("status.error")}
                </p>
                <p className="text-xs text-destructive/90">{geo.error}</p>
              </div>
            </div>
          </Card>
        )}

        {calculatedDistance != null && (
          <DistanceBadge
            distanceMeters={calculatedDistance}
            radiusMeters={activity.attendanceRadius}
            accuracyMeters={geo.accuracy}
          />
        )}
      </div>

      {/* Primary Mobile Touch CTA (size="lg") */}
      <Button
        type="button"
        size="lg"
        onClick={handleCheckIn}
        disabled={
          geo.loading ||
          submitting ||
          geo.latitude == null ||
          geo.longitude == null
        }
        className="h-12 w-full text-base font-bold shadow-md gap-2"
      >
        {submitting ? (
          <>
            <Loader2 className="size-5 animate-spin" />
            <span>{t("checkingIn")}</span>
          </>
        ) : (
          <>
            <LocateFixed className="size-5" />
            <span>{t("submitCheckInButton")}</span>
          </>
        )}
      </Button>
    </div>
  );
}
