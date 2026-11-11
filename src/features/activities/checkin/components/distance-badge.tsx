"use client";

import { CheckCircle2, Navigation, ShieldAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";

export interface DistanceBadgeProps {
  distanceMeters: number;
  radiusMeters: number;
  accuracyMeters?: number | null;
}

export function DistanceBadge({
  distanceMeters,
  radiusMeters,
  accuracyMeters,
}: DistanceBadgeProps) {
  const t = useTranslations("attendance.checkin");
  const isWithin = distanceMeters <= radiusMeters;

  const formattedDistance =
    distanceMeters >= 1000
      ? `${(distanceMeters / 1000).toFixed(2)} km`
      : `${Math.round(distanceMeters)} m`;

  const accuracyText =
    accuracyMeters != null ? `±${Math.round(accuracyMeters)}m` : null;

  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2">
        <div
          className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${
            isWithin
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
          }`}
        >
          {isWithin ? (
            <CheckCircle2 className="size-4" />
          ) : (
            <ShieldAlert className="size-4" />
          )}
        </div>
        <div>
          <span className="text-xs font-medium text-muted-foreground">
            {t("distanceLabel")}
          </span>
          <p className="font-mono text-base font-bold text-foreground">
            {formattedDistance}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant={isWithin ? "default" : "secondary"}
          className={
            isWithin
              ? "bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600"
              : "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300"
          }
        >
          {isWithin
            ? t("withinRadius", { radius: radiusMeters })
            : t("outsideRadius")}
        </Badge>

        {accuracyText && (
          <span className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
            <Navigation className="size-3 text-muted-foreground" />
            <span>{accuracyText}</span>
          </span>
        )}
      </div>
    </div>
  );
}
