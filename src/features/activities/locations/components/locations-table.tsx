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
import type { ActivityLocation } from "@/db/schema/activities";
import {
  deleteActivityLocationAction,
  toggleLocationStatusAction,
} from "../actions";
import { LocationDialog } from "./location-dialog";

export interface LocationsTableProps {
  initialData: ActivityLocation[];
  canManage?: boolean;
}

export function LocationsTable({
  initialData,
  canManage = true,
}: LocationsTableProps) {
  const t = useTranslations("activities.locations");
  const tCommon = useTranslations("common");
  const router = useRouter();

  const [data, setData] = React.useState<ActivityLocation[]>(initialData);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [selectedLoc, setSelectedLoc] = React.useState<ActivityLocation | null>(
    null,
  );

  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [locToDelete, setLocToDelete] = React.useState<ActivityLocation | null>(
    null,
  );

  React.useEffect(() => {
    setData(initialData);
  }, [initialData]);

  const filteredData = React.useMemo(() => {
    return data.filter((item) => {
      const matchesSearch =
        search.trim() === "" ||
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        (item.address?.toLowerCase().includes(search.toLowerCase()) ?? false);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && item.isActive) ||
        (statusFilter === "inactive" && !item.isActive);

      return matchesSearch && matchesStatus;
    });
  }, [data, search, statusFilter]);

  const handleEdit = React.useCallback((location: ActivityLocation) => {
    setSelectedLoc(location);
    setDialogOpen(true);
  }, []);

  const handleCreate = () => {
    setSelectedLoc(null);
    setDialogOpen(true);
  };

  const handleToggleStatus = React.useCallback(
    async (location: ActivityLocation) => {
      const nextStatus = !location.isActive;
      try {
        const res = await toggleLocationStatusAction({
          id: location.id,
          isActive: nextStatus,
        });

        if (res?.serverError) {
          toast.error(res.serverError);
          return;
        }

        toast.success(t("statusUpdatedSuccess"));
        setData((prev) =>
          prev.map((l) =>
            l.id === location.id ? { ...l, isActive: nextStatus } : l,
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
    if (!locToDelete) return;
    try {
      const res = await deleteActivityLocationAction({ id: locToDelete.id });
      if (res?.serverError) {
        toast.error(res.serverError);
        return;
      }

      toast.success(t("deletedSuccess"));
      setData((prev) => prev.filter((l) => l.id !== locToDelete.id));
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  const columns = React.useMemo<ColumnDef<TableFeatures, ActivityLocation>[]>(
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
        accessorKey: "address",
        header: t("columns.address"),
        cell: ({ row }) => (
          <span className="text-muted-foreground line-clamp-1">
            {row.original.address || ""}
          </span>
        ),
      },
      {
        id: "coordinates",
        header: t("columns.coordinates"),
        cell: ({ row }) => {
          const { latitude, longitude } = row.original;
          if (!latitude || !longitude) {
            return (
              <span className="text-muted-foreground text-xs">
                {row.original.address ? "" : ""}
              </span>
            );
          }
          const coordText = `${Number(latitude).toFixed(4)}, ${Number(longitude).toFixed(4)}`;
          return (
            <span className="font-mono text-xs text-muted-foreground">
              {coordText}
            </span>
          );
        },
      },
      {
        accessorKey: "radiusMeters",
        header: t("columns.radius"),
        cell: ({ row }) => {
          const radiusText = `${row.original.radiusMeters}m`;
          return (
            <Badge variant="outline" className="font-mono text-xs">
              {radiusText}
            </Badge>
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
          if (!canManage) return null;
          const loc = row.original;
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
                  <DropdownMenuItem onClick={() => handleEdit(loc)}>
                    {tCommon("actions.edit")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleToggleStatus(loc)}>
                    {loc.isActive
                      ? tCommon("status.inactive")
                      : tCommon("status.active")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => {
                      setLocToDelete(loc);
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
    [t, tCommon, canManage, handleEdit, handleToggleStatus],
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

      <LocationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        location={selectedLoc}
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
