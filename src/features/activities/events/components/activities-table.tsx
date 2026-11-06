"use client";

import type { ColumnDef, TableFeatures } from "@tanstack/react-table";
import {
  Edit2,
  Eye,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DataTable } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import type { Activity } from "@/db/schema/activities";
import type {
  ActivityLifecycleStatus,
  ActivityWithDetails,
} from "@/server/dal/activities/events";
import { deleteActivityAction } from "../actions";
import { ActivityDialog } from "./activity-dialog";
import { ActivityStatusDialog } from "./activity-status-dialog";

export interface ActivitiesTableProps {
  initialData: ActivityWithDetails[];
  departments?: { id: string; name: string }[];
  members?: { id: string; fullName: string; memberNumber?: string | null }[];
  canManage?: boolean;
}

export function ActivitiesTable({
  initialData,
  departments = [],
  members = [],
  canManage = true,
}: ActivitiesTableProps) {
  const t = useTranslations("activities.events");
  const tCommon = useTranslations("common");
  const router = useRouter();

  const [data, setData] = React.useState<ActivityWithDetails[]>(initialData);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [selectedActivity, setSelectedActivity] =
    React.useState<Activity | null>(null);

  const [statusDialogOpen, setStatusDialogOpen] = React.useState(false);
  const [statusActivity, setStatusActivity] =
    React.useState<ActivityWithDetails | null>(null);

  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [activityToDelete, setActivityToDelete] =
    React.useState<ActivityWithDetails | null>(null);

  React.useEffect(() => {
    setData(initialData);
  }, [initialData]);

  const filteredData = React.useMemo(() => {
    return data.filter((item) => {
      const matchesSearch =
        search.trim() === "" ||
        item.title.toLowerCase().includes(search.toLowerCase()) ||
        (item.topic?.toLowerCase().includes(search.toLowerCase()) ?? false);

      const matchesStatus =
        statusFilter === "all" || item.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [data, search, statusFilter]);

  const handleEdit = React.useCallback((act: ActivityWithDetails) => {
    setSelectedActivity(act);
    setDialogOpen(true);
  }, []);

  const handleChangeStatus = React.useCallback((act: ActivityWithDetails) => {
    setStatusActivity(act);
    setStatusDialogOpen(true);
  }, []);

  const handleDelete = React.useCallback(async () => {
    if (!activityToDelete) return;

    try {
      const res = await deleteActivityAction({ id: activityToDelete.id });
      if (res?.data?.success) {
        toast.success(t("deletedSuccess"));
        setData((prev) =>
          prev.filter((item) => item.id !== activityToDelete.id),
        );
        setDeleteDialogOpen(false);
        setActivityToDelete(null);
        router.refresh();
      } else if (res?.serverError) {
        toast.error(res.serverError);
      }
    } catch {
      toast.error(tCommon("errors.unexpected"));
    }
  }, [activityToDelete, router, t, tCommon]);

  const getAttendanceState = React.useCallback(
    (act: ActivityWithDetails): "open" | "notOpen" | "closed" | "disabled" => {
      if (!act.attendanceEnabled) return "disabled";

      const now = new Date();
      if (act.attendanceOpenAt && now < new Date(act.attendanceOpenAt)) {
        return "notOpen";
      }
      if (act.attendanceCloseAt && now > new Date(act.attendanceCloseAt)) {
        return "closed";
      }
      return "open";
    },
    [],
  );

  const columns = React.useMemo<
    ColumnDef<TableFeatures, ActivityWithDetails>[]
  >(
    () => [
      {
        accessorKey: "activityDate",
        header: t("columns.date"),
        cell: ({ row }) => {
          return (
            <Badge variant="outline" className="font-mono text-xs">
              {row.original.activityDate}
            </Badge>
          );
        },
      },
      {
        accessorKey: "title",
        header: t("columns.activity"),
        cell: ({ row }) => {
          const act = row.original;
          return (
            <div className="flex flex-col gap-0.5">
              <Link
                href={`/activities/${act.id}`}
                className="font-medium text-foreground hover:underline"
              >
                {act.title}
              </Link>
              {act.topic && (
                <span className="text-xs text-muted-foreground">
                  {act.topic}
                </span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "timing",
        header: t("columns.timing"),
        cell: ({ row }) => {
          const { startTime, endTime } = row.original;
          if (!startTime && !endTime) {
            return (
              <span className="text-xs text-muted-foreground">
                {tCommon("labels.notAvailable")}
              </span>
            );
          }
          const s = startTime ? startTime.slice(0, 5) : "--:--";
          const e = endTime ? endTime.slice(0, 5) : "--:--";
          const timingDisplay = `${s} - ${e}`;
          return <span className="font-mono text-xs">{timingDisplay}</span>;
        },
      },
      {
        accessorKey: "location",
        header: t("columns.location"),
        cell: ({ row }) => {
          return (
            <span className="text-sm">
              {row.original.location || t("noLocation")}
            </span>
          );
        },
      },
      {
        accessorKey: "status",
        header: t("columns.status"),
        cell: ({ row }) => {
          const status = row.original.status as ActivityLifecycleStatus;
          const variantMap: Record<
            ActivityLifecycleStatus,
            "default" | "secondary" | "outline" | "destructive"
          > = {
            scheduled: "outline",
            completed: "default",
            holiday: "secondary",
            postponed: "secondary",
            relocated: "outline",
            cancelled: "destructive",
          };

          return (
            <Badge variant={variantMap[status] || "outline"}>
              {t(`statuses.${status}`)}
            </Badge>
          );
        },
      },
      {
        accessorKey: "attendance",
        header: t("columns.attendance"),
        cell: ({ row }) => {
          const state = getAttendanceState(row.original);
          const variantMap = {
            open: "default" as const,
            notOpen: "outline" as const,
            closed: "secondary" as const,
            disabled: "secondary" as const,
          };
          return (
            <Badge variant={variantMap[state]}>
              {t(`attendanceStatus.${state}`)}
            </Badge>
          );
        },
      },
      {
        id: "actions",
        header: t("columns.actions"),
        cell: ({ row }) => {
          const act = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href={`/activities/${act.id}`}>
                    <Eye className="mr-2 h-4 w-4" />
                    <span>{tCommon("actions.view")}</span>
                  </Link>
                </DropdownMenuItem>

                {canManage && (
                  <>
                    <DropdownMenuItem onClick={() => handleChangeStatus(act)}>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      <span>{t("changeStatusButton")}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleEdit(act)}>
                      <Edit2 className="mr-2 h-4 w-4" />
                      <span>{tCommon("actions.edit")}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        setActivityToDelete(act);
                        setDeleteDialogOpen(true);
                      }}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      <span>{tCommon("actions.delete")}</span>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [canManage, getAttendanceState, handleChangeStatus, handleEdit, t, tCommon],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            placeholder={t("searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:max-w-xs"
          />

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("filterAllStatuses")}</SelectItem>
              <SelectItem value="scheduled">
                {t("statuses.scheduled")}
              </SelectItem>
              <SelectItem value="completed">
                {t("statuses.completed")}
              </SelectItem>
              <SelectItem value="holiday">{t("statuses.holiday")}</SelectItem>
              <SelectItem value="postponed">
                {t("statuses.postponed")}
              </SelectItem>
              <SelectItem value="relocated">
                {t("statuses.relocated")}
              </SelectItem>
              <SelectItem value="cancelled">
                {t("statuses.cancelled")}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {canManage && (
          <Button
            onClick={() => {
              setSelectedActivity(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            <span>{t("createButton")}</span>
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={filteredData}
        emptyMessage={t("emptyActivities")}
      />

      {canManage && (
        <>
          <ActivityDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            activity={selectedActivity}
            departments={departments}
            members={members}
            onSuccess={() => router.refresh()}
          />

          <ActivityStatusDialog
            open={statusDialogOpen}
            onOpenChange={setStatusDialogOpen}
            activity={statusActivity}
            onSuccess={() => router.refresh()}
          />

          <ConfirmDialog
            open={deleteDialogOpen}
            onOpenChange={setDeleteDialogOpen}
            title={t("deleteConfirmTitle")}
            description={t("deleteConfirmMessage")}
            onConfirm={handleDelete}
            confirmLabel={tCommon("actions.delete")}
            cancelLabel={tCommon("actions.cancel")}
            variant="destructive"
          />
        </>
      )}
    </div>
  );
}
