import { AlertCircle } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CheckInClient } from "@/features/activities/checkin/components/checkin-client";
import { auth } from "@/lib/auth";
import {
  getActivityByAttendanceToken,
  resolveCheckInMemberContext,
} from "@/server/dal/activities/checkin";
import type { UserSession } from "@/server/dal/auth";
import { MemberNotLinkedError } from "@/server/dal/members/portal";

export interface CheckInPageProps {
  params: Promise<{ token: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("attendance.checkin");
  return {
    title: t("pageTitle"),
    description: t("pageSubtitle"),
  };
}

export default async function CheckInPage({ params }: CheckInPageProps) {
  const { token } = await params;
  const reqHeaders = await headers();
  const session = await auth.api.getSession({
    headers: reqHeaders,
  });

  if (!session?.user) {
    redirect(
      `/login?callbackUrl=/attendance/check-in/${encodeURIComponent(token)}`,
    );
  }

  const userSession = session as unknown as UserSession;
  let isUnlinked = false;

  try {
    await resolveCheckInMemberContext(userSession);
  } catch (error) {
    if (error instanceof MemberNotLinkedError) {
      isUnlinked = true;
    }
  }

  const activity = await getActivityByAttendanceToken(token, userSession);
  if (!activity) {
    notFound();
  }

  const t = await getTranslations("attendance.checkin");

  return (
    <main className="min-h-screen bg-muted/20 px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-xl space-y-6">
        <header className="space-y-1 text-center">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {t("pageTitle")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("pageSubtitle")}</p>
        </header>

        {isUnlinked ? (
          <Card className="border-destructive/30 bg-destructive/10 shadow-sm">
            <CardHeader className="text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/20 text-destructive">
                <AlertCircle className="size-6" />
              </div>
              <CardTitle className="text-lg font-bold text-destructive">
                {t("unlinkedTitle")}
              </CardTitle>
              <CardDescription className="text-destructive/80">
                {t("unlinkedDesc")}
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <CheckInClient activity={activity} token={token} />
        )}
      </div>
    </main>
  );
}
