"use client";

import type { ColumnDef, TableFeatures } from "@tanstack/react-table";
import { BookOpen, MoreHorizontal, Plus, Search } from "lucide-react";
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
import type { AgendaSchedule } from "@/db/schema/activities";
import {
  deleteAgendaScheduleAction,
  toggleScheduleStatusAction,
} from "../actions";
import { ScheduleDialog } from "./schedule-dialog";

export interface SchedulesTableProps {
  initialData: AgendaSchedule[];
  locations?: { id: string; name: string }[];
  departments?: { id: string; name: string }[];
  canManage?: boolean;
}

export function SchedulesTable({
  initialData,
  locations = [],
  departments = [],
  canManage = true,
}: SchedulesTableProps) {
  const t = useTranslations("activities.schedules");
  const tCommon = useTranslations("common");
  const router = useRouter();

  const [data, setData] = React.useState<AgendaSchedule[]>(initialData);
  const [search, setSearch] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState<string>("all");

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [selectedSchedule, setSelectedSchedule] =
    React.useState<AgendaSchedule | null>(null);

  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [schedToDelete, setSchedToDelete] =
    React.useState<AgendaSchedule | null>(null);

  React.useEffect(() => {
    setData(initialData);
  }, [initialData]);

  const filteredData = React.useMemo(() => {
    return data.filter((item) => {
      const matchesSearch =
        search.trim() === "" ||
        item.title.toLowerCase().includes(search.toLowerCase()) ||
        (item.description?.toLowerCase().includes(search.toLowerCase()) ??
          false);

      const matchesType =
        typeFilter === "all" || item.scheduleType === typeFilter;

      return matchesSearch && matchesType;
    });
  }, [data, search, typeFilter]);

  const handleEdit = React.useCallback((sched: AgendaSchedule) => {
    setSelectedSchedule(sched);
    setDialogOpen(true);
  }, []);

  const handleCreate = () => {
    setSelectedSchedule(null);
    setDialogOpen(true);
  };

  const handleToggleStatus = React.useCallback(
    async (sched: AgendaSchedule) => {
      const nextStatus = !sched.isActive;
      try {
        const res = await toggleScheduleStatusAction({
          id: sched.id,
          isActive: nextStatus,
        });

        if (res?.serverError) {
          toast.error(res.serverError);
          return;
        }

        toast.success(t("statusUpdatedSuccess"));
        setData((prev) =>
          prev.map((s) =>
            s.id === sched.id ? { ...s, isActive: nextStatus } : s,
          ),
        );
        router.refresh();
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : String(err));
      }
    },
    [router, t],
  );

  const handleDeleteConfirm = async () => {
    if (!schedToDelete) return;
    try {
      const res = await deleteAgendaScheduleAction({ id: schedToDelete.id });
      if (res?.serverError) {
        toast.error(res.serverError);
        return;
      }

      toast.success(t("deletedSuccess"));
      setData((prev) => prev.filter((s) => s.id !== schedToDelete.id));
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  const getDayName = React.useCallback(
    (dayNum?: number | null) => {
      if (dayNum === null || dayNum === undefined) return "";
      const map: Record<number, string> = {
        0: t("days.sun"),
        1: t("days.mon"),
        2: t("days.tue"),
        3: t("days.wed"),
        4: t("days.thu"),
        5: t("days.fri"),
        6: t("days.sat"),
      };
      return map[dayNum] ?? "";
    },
    [t],
  );

  const columns = React.useMemo<ColumnDef<TableFeatures, AgendaSchedule>[]>(
    () => [
      {
        accessorKey: "title",
        header: t("columns.title"),
        cell: ({ row }) => (
          <div className="flex flex-col gap-0.5">
            <Link
              href={`/schedules/${row.original.id}`}
              className="font-medium text-foreground hover:underline"
            >
              {row.original.title}
            </Link>
            {row.original.description && (
              <span className="text-muted-foreground line-clamp-1 text-xs">
                {row.original.description}
              </span>
            )}
          </div>
        ),
      },
      {
        accessorKey: "scheduleType",
        header: t("columns.type"),
        cell: ({ row }) => {
          const type = row.original.scheduleType;
          return (
            <Badge variant="outline" className="capitalize">
              {t(`types.${type}`)}
            </Badge>
          );
        },
      },
      {
        id: "timing",
        header: t("columns.timing"),
        cell: ({ row }) => {
          const s = row.original;
          let recurrence = "";
          if (s.scheduleType === "weekly") {
            recurrence = getDayName(s.dayOfWeek);
          } else if (s.scheduleType === "monthly") {
            recurrence = `${t("dayOfMonthLabel")}: ${s.dayOfMonth}`;
          } else if (s.scheduleType === "incidental") {
            recurrence = s.specificDate || "";
          }

          const time =
            s.startTime && s.endTime
              ? `${s.startTime.slice(0, 5)} - ${s.endTime.slice(0, 5)}`
              : "";

          return (
            <div className="flex flex-col text-xs text-muted-foreground">
              {recurrence && (
                <span className="font-medium text-foreground">
                  {recurrence}
                </span>
              )}
              {time && <span className="font-mono">{time}</span>}
            </div>
          );
        },
      },
      {
        accessorKey: "isActive",
        header: t("columns.status"),
        cell: ({ row }) => {
          const isActive = row.original.isActive;
          return (
            <Badge variant={isActive ? "default" : "secondary"}>
              {isActive ? tCommon("status.active") : tCommon("status.inactive")}
            </Badge>
          );
        },
      },
      {
        id: "actions",
        header: () => <span className="sr-only">{t("columns.actions")}</span>,
        cell: ({ row }) => {
          const sched = row.original;
          return (
            <div className="flex items-center justify-end gap-1">
              <Button asChild variant="ghost" size="sm" className="size-8 p-0">
                <Link href={`/schedules/${sched.id}`}>
                  <BookOpen className="size-4" />
                  <span className="sr-only">{t("weeklyCurriculumTitle")}</span>
                </Link>
              </Button>
              {canManage && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="size-8 p-0">
                      <MoreHorizontal className="size-4" />
                      <span className="sr-only">{t("columns.actions")}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleEdit(sched)}>
                      {tCommon("actions.edit")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleToggleStatus(sched)}>
                      {sched.isActive
                        ? tCommon("status.inactive")
                        : tCommon("status.active")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => {
                        setSchedToDelete(sched);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      {tCommon("actions.delete")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          );
        },
      },
    ],
    [t, tCommon, canManage, getDayName, handleEdit, handleToggleStatus],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative w-full max-w-sm">
            <Search className="text-muted-foreground absolute top-2.5 left-2.5 size-4" />
            <Input
              placeholder={tCommon("actions.search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select
            value={typeFilter}
            onValueChange={(val) => setTypeFilter(val)}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {tCommon("actions.filterAll")}
              </SelectItem>
              <SelectItem value="weekly">{t("types.weekly")}</SelectItem>
              <SelectItem value="monthly">{t("types.monthly")}</SelectItem>
              <SelectItem value="incidental">
                {t("types.incidental")}
              </SelectItem>
              <SelectItem value="yearly">{t("types.yearly")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {canManage && (
          <Button onClick={handleCreate} className="gap-1.5">
            <Plus className="size-4" />
            {t("createButton")}
          </Button>
        )}
      </div>

      <DataTable columns={columns} data={filteredData} />

      <ScheduleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        schedule={selectedSchedule}
        locations={locations}
        departments={departments}
        onSuccess={() => router.refresh()}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={t("deleteConfirmTitle")}
        description={t("deleteConfirmMessage")}
        variant="destructive"
        confirmLabel={tCommon("actions.delete")}
        cancelLabel={tCommon("actions.cancel")}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
