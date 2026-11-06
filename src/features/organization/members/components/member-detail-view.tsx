"use client";

import {
  AlertTriangle,
  Briefcase,
  Building,
  Calendar,
  Edit,
  KeyRound,
  Mail,
  MapPin,
  Phone,
  Shield,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Member } from "@/db/schema/organization";
import type { MemberWithDetails } from "@/server/dal/organization/members";
import { AccountProvisionDialog } from "./account-provision-dialog";
import { AgeLimitDialog } from "./age-limit-dialog";
import { MemberDialog } from "./member-dialog";
import { ResetPasswordDialog } from "./reset-password-dialog";

export interface MemberDetailViewProps {
  member: MemberWithDetails & {
    user?: {
      id: string;
      email: string;
      username: string | null;
      isActive: boolean;
      banned?: boolean;
      createdAt?: Date;
      roles?: Array<{ id: string; name: string; description: string | null }>;
    } | null;
  };
  departments: Array<{ id: string; name: string }>;
  positions: Array<{ id: string; name: string }>;
  canUpdate: boolean;
  canManageAccounts: boolean;
}

export function MemberDetailView({
  member,
  departments,
  positions,
  canUpdate,
  canManageAccounts,
}: MemberDetailViewProps) {
  const t = useTranslations("members");
  const router = useRouter();

  const [editOpen, setEditOpen] = React.useState(false);
  const [ageLimitOpen, setAgeLimitOpen] = React.useState(false);
  const [provisionOpen, setProvisionOpen] = React.useState(false);
  const [resetPasswordOpen, setResetPasswordOpen] = React.useState(false);

  const initials = member.fullName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  const handleRefresh = () => {
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={member.fullName}
        description={member.memberNumber || t("description")}
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/members">{t("backToDirectory")}</Link>
            </Button>
            {canUpdate && (
              <Button size="sm" onClick={() => setEditOpen(true)}>
                <Edit className="mr-2 h-4 w-4" />
                {t("editMember")}
              </Button>
            )}
          </div>
        }
      />

      {member.isAgeLimitDue && (
        <Card className="border-amber-300 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20">
          <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-semibold text-amber-900 dark:text-amber-200">
                  {t("ageLimitAlertTitle")}
                </h4>
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  {t("ageLimitAlertDescription")}
                </p>
              </div>
            </div>
            {canUpdate && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setAgeLimitOpen(true)}
              >
                {t("processAgeLimit")}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Biographical & Contact Information */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <Avatar className="h-14 w-14">
                {member.profilePhoto && (
                  <AvatarImage src={`/api/uploads/${member.profilePhoto}`} />
                )}
                <AvatarFallback className="text-lg">{initials}</AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <CardTitle className="text-xl">{member.fullName}</CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant={
                      member.memberStatus === "active" ? "default" : "secondary"
                    }
                  >
                    {t(member.memberStatus)}
                  </Badge>
                  {member.isAgeLimitDue && (
                    <Badge variant="destructive">{t("ageLimitBadge")}</Badge>
                  )}
                  {member.memberNumber && (
                    <span className="font-mono text-xs text-muted-foreground">
                      {member.memberNumber}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between border-b pb-2">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4" />
                {t("email")}
              </span>
              <span>{member.email || t("notSet")}</span>
            </div>

            <div className="flex items-center justify-between border-b pb-2">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-4 w-4" />
                {t("phone")}
              </span>
              <span>{member.phone || t("notSet")}</span>
            </div>

            <div className="flex items-center justify-between border-b pb-2">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                {t("birthDate")}
              </span>
              <div className="text-right">
                <span>{member.birthDate || t("notSet")}</span>
                {member.age !== null && (
                  <span className="ml-2 font-medium text-xs text-muted-foreground">
                    {t("ageYears", { age: member.age })}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between border-b pb-2">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                {t("joinedAt")}
              </span>
              <span>{member.joinedAt || t("notSet")}</span>
            </div>

            <div className="flex items-start justify-between pt-1">
              <span className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4" />
                {t("address")}
              </span>
              <span className="text-right max-w-[220px]">
                {member.address || t("notSet")}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Organizational Assignment */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Building className="h-5 w-5" />
                {t("affiliationInfo")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between border-b pb-2">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Building className="h-4 w-4" />
                  {t("department")}
                </span>
                <span className="font-medium">
                  {member.department?.name || t("noDepartment")}
                </span>
              </div>

              <div className="flex items-center justify-between border-b pb-2">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Briefcase className="h-4 w-4" />
                  {t("position")}
                </span>
                <span className="font-medium">
                  {member.position?.name || t("noPosition")}
                </span>
              </div>

              {member.statusNotes && (
                <div className="border-b pb-2">
                  <span className="text-muted-foreground block mb-1">
                    {t("notes")}
                  </span>
                  <p className="text-xs bg-muted/50 p-2 rounded">
                    {member.statusNotes}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* User Account & Authentication */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Shield className="h-5 w-5" />
                  {t("accountManagement")}
                </CardTitle>
                <Badge variant={member.user ? "default" : "outline"}>
                  {member.user ? t("accountLinked") : t("noAccount")}
                </Badge>
              </div>
              <CardDescription>
                {member.user
                  ? member.user.email
                  : t("provisionAccountDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {member.user ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="text-muted-foreground">
                      {t("username")}
                    </span>
                    <span className="font-mono">
                      {member.user.username || t("notSet")}
                    </span>
                  </div>

                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="text-muted-foreground">{t("roles")}</span>
                    <div className="flex flex-wrap gap-1 justify-end">
                      {member.user.roles && member.user.roles.length > 0 ? (
                        member.user.roles.map((r) => (
                          <Badge
                            key={r.id}
                            variant="secondary"
                            className="text-xs"
                          >
                            {r.name}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-muted-foreground">
                          {t("noRoles")}
                        </span>
                      )}
                    </div>
                  </div>

                  {canManageAccounts && (
                    <div className="pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setResetPasswordOpen(true)}
                      >
                        <KeyRound className="mr-2 h-4 w-4" />
                        {t("resetPassword")}
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                canManageAccounts && (
                  <div>
                    <Button size="sm" onClick={() => setProvisionOpen(true)}>
                      <KeyRound className="mr-2 h-4 w-4" />
                      {t("provisionAccount")}
                    </Button>
                  </div>
                )
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialogs */}
      {canUpdate && (
        <MemberDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          member={member as Member}
          departments={departments}
          positions={positions}
          onSuccess={handleRefresh}
        />
      )}

      {canUpdate && (
        <AgeLimitDialog
          open={ageLimitOpen}
          onOpenChange={setAgeLimitOpen}
          memberId={member.id}
          onSuccess={handleRefresh}
        />
      )}

      {canManageAccounts && (
        <AccountProvisionDialog
          open={provisionOpen}
          onOpenChange={setProvisionOpen}
          memberId={member.id}
          defaultEmail={member.email}
          onSuccess={handleRefresh}
        />
      )}

      {canManageAccounts && (
        <ResetPasswordDialog
          open={resetPasswordOpen}
          onOpenChange={setResetPasswordOpen}
          memberId={member.id}
          onSuccess={handleRefresh}
        />
      )}
    </div>
  );
}
