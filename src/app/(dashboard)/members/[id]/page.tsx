import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { MemberDetailView } from "@/features/organization/members/components/member-detail-view";
import { auth } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { getUserPermissions } from "@/server/dal/auth";
import { getDepartments } from "@/server/dal/organization/departments";
import { getMemberById } from "@/server/dal/organization/members";
import { getPositions } from "@/server/dal/organization/positions";

export interface MemberDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: MemberDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const t = await getTranslations("members");
  const member = await getMemberById(id).catch(() => null);

  return {
    title: member ? `${member.fullName} - ${t("title")}` : t("title"),
  };
}

export default async function MemberDetailPage({
  params,
}: MemberDetailPageProps) {
  const { id } = await params;
  const reqHeaders = await headers();
  const session = await auth.api.getSession({
    headers: reqHeaders,
  });

  if (!session?.user) {
    redirect("/login");
  }

  const permissions = await getUserPermissions(session.user.id);
  if (!permissions.includes(PERMISSIONS.ORGANIZATION_MEMBERS_READ)) {
    redirect("/");
  }

  const member = await getMemberById(id);
  if (!member) {
    notFound();
  }

  const [departmentsList, positionsList] = await Promise.all([
    getDepartments().catch(() => []),
    getPositions().catch(() => []),
  ]);

  const canUpdate = permissions.includes(
    PERMISSIONS.ORGANIZATION_MEMBERS_UPDATE,
  );
  const canManageAccounts = permissions.includes(
    PERMISSIONS.ORGANIZATION_MEMBERS_ACCOUNTS,
  );

  return (
    <MemberDetailView
      member={member}
      departments={departmentsList}
      positions={positionsList}
      canUpdate={canUpdate}
      canManageAccounts={canManageAccounts}
    />
  );
}
