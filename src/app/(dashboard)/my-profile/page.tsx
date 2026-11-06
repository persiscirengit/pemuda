import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shared/page-header";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MyProfileForm } from "@/features/portal/components/my-profile-form";
import { auth } from "@/lib/auth";
import {
  getMyDashboardSummary,
  MemberNotLinkedError,
} from "@/server/dal/members/portal";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("portal");
  return {
    title: t("contactInfoTitle"),
  };
}

export default async function MyProfilePage() {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({
    headers: reqHeaders,
  });

  if (!session?.user) {
    redirect("/login");
  }

  const t = await getTranslations("portal");

  try {
    const summary = await getMyDashboardSummary();
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <PageHeader
          title={t("contactInfoTitle")}
          description={t("contactInfoSubtitle")}
        />
        <MyProfileForm member={summary.member} />
      </div>
    );
  } catch (error) {
    if (error instanceof MemberNotLinkedError) {
      return (
        <div className="space-y-6 max-w-4xl mx-auto">
          <PageHeader
            title={t("contactInfoTitle")}
            description={t("contactInfoSubtitle")}
          />
          <Card className="border-amber-500/30 bg-amber-500/10">
            <CardHeader>
              <CardTitle className="text-amber-700 dark:text-amber-400">
                {t("unlinkedTitle")}
              </CardTitle>
              <CardDescription>{t("unlinkedDescription")}</CardDescription>
            </CardHeader>
          </Card>
        </div>
      );
    }
    throw error;
  }
}
