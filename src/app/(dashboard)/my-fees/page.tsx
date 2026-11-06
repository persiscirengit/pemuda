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
import { MyFeesLedger } from "@/features/portal/components/my-fees-ledger";
import { auth } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { getUserPermissions } from "@/server/dal/auth";
import {
  getMyFeeRecords,
  MemberNotLinkedError,
} from "@/server/dal/members/portal";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("portal");
  return {
    title: t("duesHistoryTitle"),
  };
}

export default async function MyFeesPage() {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({
    headers: reqHeaders,
  });

  if (!session?.user) {
    redirect("/login");
  }

  const permissions = await getUserPermissions(session.user.id);
  if (!permissions.includes(PERMISSIONS.FINANCE_FEES_SELF)) {
    redirect("/");
  }

  const t = await getTranslations("portal");

  try {
    const result = await getMyFeeRecords();
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <PageHeader
          title={t("duesHistoryTitle")}
          description={t("duesHistorySubtitle")}
        />
        <MyFeesLedger
          records={result.records}
          totalOutstanding={result.totalOutstanding}
          hasOverdue={result.hasOverdue}
        />
      </div>
    );
  } catch (error) {
    if (error instanceof MemberNotLinkedError) {
      return (
        <div className="space-y-6 max-w-4xl mx-auto">
          <PageHeader
            title={t("duesHistoryTitle")}
            description={t("duesHistorySubtitle")}
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
