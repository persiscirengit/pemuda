"use client";

import { Check, Copy, MapPin, Printer, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ActivityWithDetails } from "@/server/dal/activities/events";
import { TokenRegenerateDialog } from "./token-regenerate-dialog";

export interface QrDisplayCardProps {
  activity: ActivityWithDetails;
  canManage: boolean;
}

export function QrDisplayCard({ activity, canManage }: QrDisplayCardProps) {
  const t = useTranslations("attendance.qr");
  const [copied, setCopied] = React.useState(false);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [origin, setOrigin] = React.useState("");

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  const checkInUrl = activity.attendanceToken
    ? `${origin || ""}/attendance/check-in/${activity.attendanceToken}`
    : "";

  const timeDisplay =
    activity.startTime && activity.endTime
      ? `${activity.startTime.slice(0, 5)} - ${activity.endTime.slice(0, 5)}`
      : activity.startTime?.slice(0, 5) ?? null;

  const handleCopy = async () => {
    if (!checkInUrl) return;
    try {
      await navigator.clipboard.writeText(checkInUrl);
      setCopied(true);
      toast.success(t("targetUrlLabel") + " copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  const now = new Date();
  let statusVariant: "default" | "outline" | "secondary" = "secondary";
  let statusText = t("closedStatus");

  if (activity.attendanceEnabled) {
    if (
      activity.attendanceOpenAt &&
      now < new Date(activity.attendanceOpenAt)
    ) {
      statusVariant = "outline";
      statusText = t("notOpenStatus");
    } else if (
      activity.attendanceCloseAt &&
      now > new Date(activity.attendanceCloseAt)
    ) {
      statusVariant = "secondary";
      statusText = t("closedStatus");
    } else {
      statusVariant = "default";
      statusText = t("openStatus");
    }
  }

  return (
    <>
      <Card className="mx-auto max-w-2xl border-2 shadow-lg print:border-none print:shadow-none">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center pb-2">
            <Badge variant={statusVariant} className="px-3 py-0.5 text-xs">
              {statusText}
            </Badge>
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight sm:text-3xl">
            {activity.title}
          </CardTitle>
          {activity.topic && (
            <CardDescription className="text-base font-medium">
              {activity.topic}
            </CardDescription>
          )}
        </CardHeader>

        <CardContent className="flex flex-col items-center space-y-6 pt-4">
          {/* Printable QR Code Container */}
          <div className="rounded-2xl border-4 border-foreground/10 bg-white p-6 shadow-md transition-all sm:p-8 print:p-2 print:border-none print:shadow-none">
            {checkInUrl ? (
              <QRCodeSVG
                value={checkInUrl}
                size={280}
                level="H"
                includeMargin={false}
                className="size-56 sm:size-72"
              />
            ) : (
              <div className="flex size-64 items-center justify-center text-muted-foreground">
                <span>{t("noToken")}</span>
              </div>
            )}
          </div>

          {/* Activity Metadata Display */}
          <div className="w-full space-y-2 rounded-xl border bg-muted/20 p-4 text-sm print:bg-transparent">
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">{t("dateLabel")}</span>
              <span className="font-semibold">{activity.activityDate}</span>
            </div>

            {timeDisplay && (
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">{t("timeLabel")}</span>
                <span className="font-mono">{timeDisplay}</span>
              </div>
            )}

            {activity.location && (
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">{t("venueLabel")}</span>
                <span className="flex items-center gap-1 font-medium text-right">
                  <MapPin className="size-3.5 text-primary shrink-0" />
                  <span>{activity.location}</span>
                </span>
              </div>
            )}

            {activity.attendanceCloseAt && (
              <div className="flex justify-between pt-1">
                <span className="text-muted-foreground">{t("windowLabel")}</span>
                <span className="font-mono text-xs">
                  {new Date(activity.attendanceCloseAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            )}
          </div>

          {/* Direct Link Copy */}
          {checkInUrl && (
            <div className="flex w-full items-center justify-between rounded-lg border bg-muted/40 p-2 font-mono text-xs print:hidden">
              <span className="truncate pr-2 text-muted-foreground">
                {checkInUrl}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 shrink-0 px-2 text-xs"
                onClick={handleCopy}
              >
                {copied ? (
                  <Check className="mr-1 size-3.5 text-green-600" />
                ) : (
                  <Copy className="mr-1 size-3.5" />
                )}
                <span>{copied ? t("copiedUrl") : t("copyUrl")}</span>
              </Button>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex flex-col sm:flex-row justify-between gap-3 border-t bg-muted/10 p-4 print:hidden">
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={handlePrint}
          >
            <Printer className="mr-2 size-4" />
            <span>{t("printQr")}</span>
          </Button>

          {canManage && (
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setDialogOpen(true)}
            >
              <RefreshCw className="mr-2 size-4" />
              <span>{t("regenerate")}</span>
            </Button>
          )}
        </CardFooter>
      </Card>

      {canManage && (
        <TokenRegenerateDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          activityId={activity.id}
        />
      )}
    </>
  );
}
