"use client";

import type { ColumnDef, TableFeatures } from "@tanstack/react-table";
import { Edit2, MoreHorizontal, Plus, Power, Trash2 } from "lucide-react";
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
import type { ArticleCategory } from "@/db/schema/content";
import {
  deleteArticleCategoryAction,
  toggleArticleCategoryStatusAction,
} from "@/features/content/categories/actions";
import { ArticleCategoryDialog } from "./article-category-dialog";

export interface ArticleCategoriesTableProps {
  categories: ArticleCategory[];
}

export function ArticleCategoriesTable({
  categories,
}: ArticleCategoriesTableProps) {
  const t = useTranslations("articles");
  const router = useRouter();

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingCategory, setEditingCategory] =
    React.useState<ArticleCategory | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const handleToggleStatus = React.useCallback(
    async (id: string) => {
      try {
        const res = await toggleArticleCategoryStatusAction({ id });
        if (res?.serverError) {
          toast.error(res.serverError);
          return;
        }
        toast.success(t("successToggled"));
        router.refresh();
      } catch {
        toast.error(t("errorGeneric"));
      }
    },
    [router, t],
  );

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      const res = await deleteArticleCategoryAction({ id: deletingId });
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

  const columns: ColumnDef<TableFeatures, ArticleCategory>[] = React.useMemo(
    () => [
      {
        accessorKey: "sortOrder",
        header: t("sortOrder"),
        cell: ({ row }) => (
          <Badge variant="outline" className="font-mono text-xs">
            {row.original.sortOrder ?? 0}
          </Badge>
        ),
      },
      {
        accessorKey: "name",
        header: t("name"),
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <span
              className="h-3 w-3 shrink-0 rounded-full"
              style={{
                backgroundColor: row.original.color || "var(--primary)",
              }}
            />
            <div>
              <div className="font-medium">{row.original.name}</div>
              {row.original.description && (
                <div className="text-muted-foreground text-xs line-clamp-1">
                  {row.original.description}
                </div>
              )}
            </div>
          </div>
        ),
      },
      {
        accessorKey: "slug",
        header: t("slug"),
        cell: ({ row }) => (
          <Badge variant="secondary" className="font-mono text-xs">
            {row.original.slug}
          </Badge>
        ),
      },
      {
        accessorKey: "isActive",
        header: t("status"),
        cell: ({ row }) => {
          const isActive = row.original.isActive;
          return (
            <Badge variant={isActive ? "default" : "outline"}>
              {isActive ? t("active") : t("inactive")}
            </Badge>
          );
        },
      },
      {
        id: "actions",
        header: t("actions"),
        cell: ({ row }) => {
          const item = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => {
                    setEditingCategory(item);
                    setDialogOpen(true);
                  }}
                >
                  <Edit2 className="mr-2 h-4 w-4" />
                  <span>{t("editCategory")}</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleToggleStatus(item.id)}>
                  <Power className="mr-2 h-4 w-4" />
                  <span>{item.isActive ? t("inactive") : t("active")}</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setDeletingId(item.id)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  <span>{t("deleteCategory")}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [handleToggleStatus, t],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button
          onClick={() => {
            setEditingCategory(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          <span>{t("addCategory")}</span>
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={categories}
        emptyMessage={t("emptyCategories")}
      />

      <ArticleCategoryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        category={editingCategory}
        onSuccess={() => router.refresh()}
      />

      <ConfirmDialog
        open={!!deletingId}
        onOpenChange={(open) => !open && setDeletingId(null)}
        title={t("deleteCategory")}
        description={t("deleteConfirm")}
        confirmLabel={t("deleteCategory")}
        cancelLabel={t("cancel")}
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}
