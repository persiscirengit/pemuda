"use client";

import type { ColumnDef, TableFeatures } from "@tanstack/react-table";
import { MoreHorizontal, Plus, Search } from "lucide-react";
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
import type { Position } from "@/db/schema/organization";
import {
  deletePositionAction,
  togglePositionStatusAction,
} from "../actions/positions";
import { PositionDialog } from "./position-dialog";

export interface PositionsTableProps {
  initialData: Position[];
  canManage?: boolean;
}

export function PositionsTable({
  initialData,
  canManage = true,
}: PositionsTableProps) {
  const t = useTranslations("organization.positions");
  const tCommon = useTranslations("common");
  const router = useRouter();

  const [data, setData] = React.useState<Position[]>(initialData);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [selectedPos, setSelectedPos] = React.useState<Position | null>(null);

  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [posToDelete, setPosToDelete] = React.useState<Position | null>(null);

  React.useEffect(() => {
    setData(initialData);
  }, [initialData]);

  const filteredData = React.useMemo(() => {
    return data.filter((item) => {
      const matchesSearch =
        search.trim() === "" ||
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        (item.description?.toLowerCase().includes(search.toLowerCase()) ??
          false);

      const matchesStatus =
        statusFilter === "all" || item.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [data, search, statusFilter]);

  const handleEdit = React.useCallback((position: Position) => {
    setSelectedPos(position);
    setDialogOpen(true);
  }, []);

  const handleCreate = () => {
    setSelectedPos(null);
    setDialogOpen(true);
  };

  const handleToggleStatus = React.useCallback(
    async (position: Position) => {
      const nextStatus = position.status === "active" ? "inactive" : "active";
      try {
        const res = await togglePositionStatusAction({
          id: position.id,
          status: nextStatus,
        });

        if (res?.serverError) {
          toast.error(res.serverError);
          return;
        }

        toast.success(t("statusUpdatedSuccess"));
        setData((prev) =>
          prev.map((p) =>
            p.id === position.id ? { ...p, status: nextStatus } : p,
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
    if (!posToDelete) return;
    try {
      const res = await deletePositionAction({ id: posToDelete.id });
      if (res?.serverError) {
        toast.error(res.serverError);
        return;
      }

      toast.success(t("deletedSuccess"));
      setData((prev) => prev.filter((p) => p.id !== posToDelete.id));
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  const columns = React.useMemo<ColumnDef<TableFeatures, Position>[]>(
    () => [
      {
        accessorKey: "name",
        header: t("columns.name"),
        cell: ({ row }) => (
          <span className="font-medium text-foreground">
            {row.original.name}
          </span>
        ),
      },
      {
        accessorKey: "description",
        header: t("columns.description"),
        cell: ({ row }) => (
          <span className="text-muted-foreground line-clamp-1">
            {row.original.description || "—"}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: t("columns.status"),
        cell: ({ row }) => {
          const isActive = row.original.status === "active";
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
          if (!canManage) return null;
          const pos = row.original;
          return (
            <div className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="size-8 p-0">
                    <MoreHorizontal className="size-4" />
                    <span className="sr-only">{t("columns.actions")}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleEdit(pos)}>
                    {tCommon("actions.edit")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleToggleStatus(pos)}>
                    {pos.status === "active"
                      ? tCommon("status.inactive")
                      : tCommon("status.active")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => {
                      setPosToDelete(pos);
                      setDeleteDialogOpen(true);
                    }}
                  >
                    {tCommon("actions.delete")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [t, tCommon, canManage, handleToggleStatus, handleEdit],
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
            value={statusFilter}
            onValueChange={(val) => setStatusFilter(val)}
          >
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {tCommon("actions.filterAll")}
              </SelectItem>
              <SelectItem value="active">{tCommon("status.active")}</SelectItem>
              <SelectItem value="inactive">
                {tCommon("status.inactive")}
              </SelectItem>
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

      <PositionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        position={selectedPos}
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
