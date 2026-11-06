"use client";

import type { ColumnDef, TableFeatures } from "@tanstack/react-table";
import {
  AlertTriangle,
  Edit2,
  Eye,
  FileUp,
  MoreHorizontal,
  Plus,
  Trash2,
  UserCheck,
  UserX,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DataTable } from "@/components/shared/data-table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Member } from "@/db/schema/organization";
import { deleteMemberAction } from "@/features/organization/members/actions";
import { ExportMembersButton } from "@/features/organization/members/export/export-members-button";
import type { MemberWithDetails } from "@/server/dal/organization/members";
import { AgeLimitDialog } from "./age-limit-dialog";
import { MemberDialog } from "./member-dialog";

export interface MembersTableProps {
  members: MemberWithDetails[];
  departments: Array<{ id: string; name: string }>;
  positions: Array<{ id: string; name: string }>;
}

type FilterTab = "all" | "active" | "inactive" | "ageLimitDue";

export function MembersTable({
  members,
  departments,
  positions,
}: MembersTableProps) {
  const t = useTranslations("members");
  const router = useRouter();

  const [filterTab, setFilterTab] = React.useState<FilterTab>("all");
  const [searchTerm, setSearchTerm] = React.useState("");
  const [selectedDept, setSelectedDept] = React.useState<string>("all");
  const [selectedPos, setSelectedPos] = React.useState<string>("all");

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingMember, setEditingMember] = React.useState<Member | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [ageLimitId, setAgeLimitId] = React.useState<string | null>(null);

  // Statistics
  const totalActive = React.useMemo(
    () => members.filter((m) => m.memberStatus === "active").length,
    [members],
  );

  const totalInactive = React.useMemo(
    () => members.filter((m) => m.memberStatus === "inactive").length,
    [members],
  );

  const totalAgeLimitDue = React.useMemo(
    () => members.filter((m) => m.isAgeLimitDue).length,
    [members],
  );

  // Filtered members
  const filteredMembers = React.useMemo(() => {
    return members.filter((m) => {
      // Tab filter
      if (filterTab === "active" && m.memberStatus !== "active") return false;
      if (filterTab === "inactive" && m.memberStatus !== "inactive")
        return false;
      if (filterTab === "ageLimitDue" && !m.isAgeLimitDue) return false;

      // Department filter
      if (selectedDept !== "all" && m.departmentId !== selectedDept)
        return false;

      // Position filter
      if (selectedPos !== "all" && m.positionId !== selectedPos) return false;

      // Search filter
      if (searchTerm.trim().length > 0) {
        const term = searchTerm.toLowerCase();
        const matchesName = m.fullName.toLowerCase().includes(term);
        const matchesNpa = m.memberNumber?.toLowerCase().includes(term);
        const matchesPhone = m.phone?.toLowerCase().includes(term);
        const matchesEmail = m.email?.toLowerCase().includes(term);
        if (!matchesName && !matchesNpa && !matchesPhone && !matchesEmail) {
          return false;
        }
      }

      return true;
    });
  }, [filterTab, members, searchTerm, selectedDept, selectedPos]);

  const activeFilters = React.useMemo(() => {
    const memberStatus =
      filterTab === "active" || filterTab === "inactive"
        ? (filterTab as "active" | "inactive")
        : undefined;

    return {
      search: searchTerm.trim() || undefined,
      departmentId: selectedDept !== "all" ? selectedDept : undefined,
      positionId: selectedPos !== "all" ? selectedPos : undefined,
      memberStatus,
      ageLimitDue: filterTab === "ageLimitDue" ? true : undefined,
    };
  }, [filterTab, searchTerm, selectedDept, selectedPos]);

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      const res = await deleteMemberAction({ id: deletingId });
      if (res?.serverError) {
        toast.error(res.serverError);
        return;
      }
      toast.success(t("successDeleted"));
      setDeletingId(null);
      router.refresh();
    } catch {
      toast.error(t("errorGeneric"));
    }
  };

  const columns: ColumnDef<TableFeatures, MemberWithDetails>[] = React.useMemo(
    () => [
      {
        accessorKey: "fullName",
        header: t("fullName"),
        cell: ({ row }) => {
          const m = row.original;
          const initials = m.fullName
            .split(" ")
            .slice(0, 2)
            .map((w) => w[0])
            .join("")
            .toUpperCase();

          return (
            <div className="flex items-center gap-3">
              <Avatar className="h-9 w-9">
                {m.profilePhoto && (
                  <AvatarImage src={`/api/uploads/${m.profilePhoto}`} />
                )}
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div>
                <Link
                  href={`/members/${m.id}`}
                  className="font-medium hover:underline text-foreground"
                >
                  {m.fullName}
                </Link>
                {m.memberNumber ? (
                  <div className="font-mono text-xs text-muted-foreground">
                    {m.memberNumber}
                  </div>
                ) : null}
              </div>
            </div>
          );
        },
      },
      {
        id: "affiliation",
        header: t("affiliationInfo"),
        cell: ({ row }) => {
          const dept = row.original.department?.name;
          const pos = row.original.position?.name;
          if (!dept && !pos) {
            return (
              <span className="text-muted-foreground text-xs italic">
                {t("noDepartment")}
              </span>
            );
          }
          return (
            <div className="text-sm">
              {pos && <div className="font-medium">{pos}</div>}
              {dept && (
                <div className="text-muted-foreground text-xs">{dept}</div>
              )}
            </div>
          );
        },
      },
      {
        id: "age",
        header: t("age"),
        cell: ({ row }) => {
          const m = row.original;
          const ageDisplay =
            m.age !== null ? t("ageYears", { age: m.age }) : "-";

          return (
            <div className="flex items-center gap-2">
              <span>{ageDisplay}</span>
              {m.isAgeLimitDue ? (
                <Badge variant="destructive" className="text-xs">
                  {t("ageLimitDue")}
                </Badge>
              ) : null}
            </div>
          );
        },
      },
      {
        accessorKey: "memberStatus",
        header: t("status"),
        cell: ({ row }) => {
          const status = row.original.memberStatus;
          const variantMap: Record<
            string,
            "default" | "secondary" | "outline" | "destructive"
          > = {
            active: "default",
            inactive: "secondary",
            alumni: "outline",
            moved: "outline",
          };

          const labelMap: Record<string, string> = {
            active: t("active"),
            inactive: t("inactive"),
            alumni: t("alumni"),
            moved: t("moved"),
          };

          return (
            <Badge variant={variantMap[status] || "outline"}>
              {labelMap[status] || status}
            </Badge>
          );
        },
      },
      {
        id: "account",
        header: t("accountStatus"),
        cell: ({ row }) => {
          const hasUser = !!row.original.user;
          return (
            <Badge variant={hasUser ? "outline" : "secondary"}>
              {hasUser ? t("accountLinked") : t("noAccount")}
            </Badge>
          );
        },
      },
      {
        id: "actions",
        header: t("actions"),
        cell: ({ row }) => {
          const m = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href={`/members/${m.id}`}>
                    <Eye className="mr-2 h-4 w-4" />
                    <span>{t("viewProfile")}</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setEditingMember(m);
                    setDialogOpen(true);
                  }}
                >
                  <Edit2 className="mr-2 h-4 w-4" />
                  <span>{t("editMember")}</span>
                </DropdownMenuItem>
                {m.isAgeLimitDue ? (
                  <DropdownMenuItem
                    className="text-amber-600 focus:text-amber-600"
                    onClick={() => setAgeLimitId(m.id)}
                  >
                    <AlertTriangle className="mr-2 h-4 w-4" />
                    <span>{t("processAgeLimit")}</span>
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setDeletingId(m.id)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  <span>{t("deleteMember")}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [t],
  );

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              {t("totalActive")}
            </CardTitle>
            <UserCheck className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalActive}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              {t("totalInactive")}
            </CardTitle>
            <UserX className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalInactive}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              {t("ageLimitPending")}
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAgeLimitDue}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={filterTab === "all" ? "default" : "outline"}
            onClick={() => setFilterTab("all")}
          >
            {t("all")}
          </Button>
          <Button
            size="sm"
            variant={filterTab === "active" ? "default" : "outline"}
            onClick={() => setFilterTab("active")}
          >
            {t("active")}
          </Button>
          <Button
            size="sm"
            variant={filterTab === "inactive" ? "default" : "outline"}
            onClick={() => setFilterTab("inactive")}
          >
            {t("inactive")}
          </Button>
          <Button
            size="sm"
            variant={filterTab === "ageLimitDue" ? "destructive" : "outline"}
            onClick={() => setFilterTab("ageLimitDue")}
          >
            <AlertTriangle className="mr-1 h-3.5 w-3.5" />
            <span>{t("ageLimitDue")}</span>
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="w-full sm:w-56"
          />

          <Select value={selectedDept} onValueChange={setSelectedDept}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder={t("department")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("all")}</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedPos} onValueChange={setSelectedPos}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder={t("position")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("all")}</SelectItem>
              {positions.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <ExportMembersButton filters={activeFilters} />

          <Button asChild variant="outline" size="sm">
            <Link href="/members/import">
              <FileUp className="mr-2 h-4 w-4" />
              <span>{t("importCsv")}</span>
            </Link>
          </Button>

          <Button
            size="sm"
            onClick={() => {
              setEditingMember(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            <span>{t("addMember")}</span>
          </Button>
        </div>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={filteredMembers}
        emptyMessage={t("emptyMembers")}
      />

      {/* Dialogs */}
      <MemberDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        member={editingMember}
        departments={departments}
        positions={positions}
        onSuccess={() => router.refresh()}
      />

      <AgeLimitDialog
        memberId={ageLimitId}
        open={!!ageLimitId}
        onOpenChange={(open) => !open && setAgeLimitId(null)}
        onSuccess={() => router.refresh()}
      />

      <ConfirmDialog
        open={!!deletingId}
        onOpenChange={(open) => !open && setDeletingId(null)}
        title={t("deleteMember")}
        description={t("deleteConfirm")}
        confirmLabel={t("deleteMember")}
        cancelLabel={t("cancel")}
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}
