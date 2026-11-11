"use client";

import { ArrowLeft, QrCode, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";
import { Button } from "@/components/ui/button";
import type { ActivityWithDetails } from "@/server/dal/activities/events";
import { ActivityStatusDialog } from "./activity-status-dialog";

export interface ActivityDetailHeaderActionsProps {
  activity: ActivityWithDetails;
  canChangeStatus: boolean;
}

export function ActivityDetailHeaderActions({
  activity,
  canChangeStatus,
}: ActivityDetailHeaderActionsProps) {
  const t = useTranslations("activities.events");
  const tCommon = useTranslations("common");
  const router = useRouter();

  const [statusDialogOpen, setStatusDialogOpen] = React.useState(false);

  return (
    <div className="flex items-center gap-2">
      <Button asChild variant="outline" size="sm">
        <Link href="/activities">
          <ArrowLeft className="mr-2 h-4 w-4" />
          <span>{tCommon("actions.back")}</span>
        </Link>
      </Button>

      {activity.attendanceEnabled && activity.attendanceToken && (
        <Button asChild variant="outline" size="sm">
          <Link href={`/activities/${activity.id}/qr`}>
            <QrCode className="mr-2 h-4 w-4" />
            <span>{t("viewQrButton")}</span>
          </Link>
        </Button>
      )}

      {canChangeStatus && (
        <>
          <Button size="sm" onClick={() => setStatusDialogOpen(true)}>
            <RefreshCw className="mr-2 h-4 w-4" />
            <span>{t("changeStatusButton")}</span>
          </Button>

          <ActivityStatusDialog
            open={statusDialogOpen}
            onOpenChange={setStatusDialogOpen}
            activity={activity}
            onSuccess={() => router.refresh()}
          />
        </>
      )}
    </div>
  );
}
