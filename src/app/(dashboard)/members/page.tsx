import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shared/page-header";
import { MembersTable } from "@/features/organization/members/components/members-table";
import { getDepartments } from "@/server/dal/organization/departments";
import { getMembers } from "@/server/dal/organization/members";
import { getPositions } from "@/server/dal/organization/positions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("members");
  return {
    title: t("title"),
  };
}

export default async function MembersPage() {
  const t = await getTranslations("members");

  const [membersList, departmentsList, positionsList] = await Promise.all([
    getMembers(),
    getDepartments().catch(() => []),
    getPositions().catch(() => []),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")} />
      <MembersTable
        members={membersList}
        departments={departmentsList}
        positions={positionsList}
      />
    </div>
  );
}
