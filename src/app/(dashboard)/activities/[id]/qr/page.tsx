import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { LiveClock } from "@/features/activities/qr/components/live-clock";
import { QrDisplayCard } from "@/features/activities/qr/components/qr-display-card";
import { auth } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { getActivityById } from "@/server/dal/activities/events";
import { getUserPermissions } from "@/server/dal/auth";

export interface ActivityQrPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("attendance.qr");
  return {
    title: t("title"),
    description: t("subtitle"),
  };
}

export default async function ActivityQrPage({ params }: ActivityQrPageProps) {
  const { id } = await params;
  const reqHeaders = await headers();
  const session = await auth.api.getSession({
    headers: reqHeaders,
  });

  if (!session?.user) {
    redirect("/login");
  }

  const permissions = await getUserPermissions(session.user.id);
  if (!permissions.includes(PERMISSIONS.ACTIVITIES_EVENTS_READ)) {
    redirect("/");
  }

  const canManage = permissions.includes(PERMISSIONS.ACTIVITIES_EVENTS_UPDATE);

  const activity = await getActivityById(id);
  if (!activity) {
    notFound();
  }

  const t = await getTranslations("attendance.qr");
  const tCommon = await getTranslations("common");

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <PageHeader
          title={t("title")}
          description={t("subtitle")}
          actions={
            <div className="flex items-center gap-2">
              <LiveClock />
              <Button asChild variant="outline" size="sm">
                <Link href={`/activities/${activity.id}`}>
                  <ArrowLeft className="mr-2 size-4" />
                  <span>{tCommon("actions.back")}</span>
                </Link>
              </Button>
            </div>
          }
        />
      </div>

      <div className="py-2">
        <QrDisplayCard activity={activity} canManage={canManage} />
      </div>
    </div>
  );
}
