import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { MemberCsvImportWizard } from "@/features/organization/members/import/member-csv-import-wizard";
import { auth } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { getUserPermissions } from "@/server/dal/auth";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("members");
  return {
    title: `${t("importTitle")} - ${t("title")}`,
  };
}

export default async function MemberImportPage() {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({
    headers: reqHeaders,
  });

  if (!session?.user) {
    redirect("/login");
  }

  const permissions = await getUserPermissions(session.user.id);
  if (!permissions.includes(PERMISSIONS.ORGANIZATION_MEMBERS_IMPORT)) {
    redirect("/members");
  }

  const t = await getTranslations("members");

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("importTitle")}
        description={t("importDescription")}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/members">{t("backToDirectory")}</Link>
          </Button>
        }
      />
      <MemberCsvImportWizard />
    </div>
  );
}
