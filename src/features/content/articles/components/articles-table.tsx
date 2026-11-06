"use client";

import type { ColumnDef, TableFeatures } from "@tanstack/react-table";
import {
  CheckCircle2,
  Clock,
  Edit2,
  FileText,
  MoreHorizontal,
  Plus,
  Trash2,
  XCircle,
} from "lucide-react";
import Image from "next/image";
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
import type { Article, ArticleCategory } from "@/db/schema/content";
import { calculateReadingTimeMinutes } from "@/lib/reading-time";
import { deleteArticleAction, publishArticleAction } from "../actions";

export interface ArticlesTableProps {
  initialData: Article[];
  categories: ArticleCategory[];
  canManage?: boolean;
}

export function ArticlesTable({
  initialData,
  categories,
  canManage = true,
}: ArticlesTableProps) {
  const t = useTranslations("articles");
  const tCommon = useTranslations("common");
  const router = useRouter();

  const [data, setData] = React.useState<Article[]>(initialData);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [categoryFilter, setCategoryFilter] = React.useState<string>("all");

  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [articleToDelete, setArticleToDelete] = React.useState<Article | null>(
    null,
  );

  React.useEffect(() => {
    setData(initialData);
  }, [initialData]);

  const categoryMap = React.useMemo(() => {
    return new Map(categories.map((c) => [c.id, c]));
  }, [categories]);

  const filteredData = React.useMemo(() => {
    return data.filter((item) => {
      const matchesSearch =
        search.trim() === "" ||
        item.title.toLowerCase().includes(search.toLowerCase()) ||
        (item.excerpt?.toLowerCase().includes(search.toLowerCase()) ?? false);

      const matchesStatus =
        statusFilter === "all" || item.status === statusFilter;

      const matchesCategory =
        categoryFilter === "all" || item.articleCategoryId === categoryFilter;

      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [data, search, statusFilter, categoryFilter]);

  const handleTogglePublish = React.useCallback(
    async (article: Article) => {
      try {
        const res = await publishArticleAction({ id: article.id });
        if (res?.data?.success) {
          toast.success(t("articlePublishedSuccess"));
          setData((prev) =>
            prev.map((item) =>
              item.id === article.id ? res.data?.article || item : item,
            ),
          );
          router.refresh();
        } else if (res?.serverError) {
          toast.error(res.serverError);
        }
      } catch {
        toast.error(tCommon("errors.unexpected"));
      }
    },
    [router, t, tCommon],
  );

  const handleDelete = React.useCallback(async () => {
    if (!articleToDelete) return;

    try {
      const res = await deleteArticleAction({ id: articleToDelete.id });
      if (res?.data?.success) {
        toast.success(t("articleDeletedSuccess"));
        setData((prev) =>
          prev.filter((item) => item.id !== articleToDelete.id),
        );
        setDeleteDialogOpen(false);
        setArticleToDelete(null);
        router.refresh();
      } else if (res?.serverError) {
        toast.error(res.serverError);
      }
    } catch {
      toast.error(tCommon("errors.unexpected"));
    }
  }, [articleToDelete, router, t, tCommon]);

  const columns = React.useMemo<ColumnDef<TableFeatures, Article>[]>(
    () => [
      {
        accessorKey: "title",
        header: t("columns.article"),
        cell: ({ row }) => {
          const art = row.original;
          const readingMinutes = calculateReadingTimeMinutes(art.content || "");
          return (
            <div className="flex items-center gap-3">
              {art.bannerImage ? (
                <div className="relative h-12 w-16 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                  <Image
                    src={
                      art.bannerImage.startsWith("http")
                        ? art.bannerImage
                        : `/${art.bannerImage}`
                    }
                    alt={art.title}
                    fill
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="flex h-12 w-16 shrink-0 items-center justify-center rounded-md border border-border bg-muted/40 text-muted-foreground">
                  <FileText className="h-5 w-5 opacity-40" />
                </div>
              )}
              <div className="flex flex-col">
                <span className="font-medium text-foreground line-clamp-1">
                  {art.title}
                </span>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-mono">{art.slug}</span>
                  <span className="inline-block h-1 w-1 rounded-full bg-muted-foreground/40" />
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>{t("readingTime", { minutes: readingMinutes })}</span>
                  </span>
                </div>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "articleCategoryId",
        header: t("columns.category"),
        cell: ({ row }) => {
          const catId = row.original.articleCategoryId;
          const cat = catId ? categoryMap.get(catId) : null;
          if (!cat) {
            return (
              <span className="text-xs text-muted-foreground">
                {t("noCategory")}
              </span>
            );
          }
          return (
            <Badge variant="outline" className="text-xs">
              {cat.name}
            </Badge>
          );
        },
      },
      {
        accessorKey: "status",
        header: t("columns.status"),
        cell: ({ row }) => {
          const status = row.original.status;
          let variant: "default" | "secondary" | "outline" = "secondary";
          if (status === "published") variant = "default";
          if (status === "archived") variant = "outline";

          return (
            <Badge variant={variant} className="capitalize text-xs">
              {t(`statuses.${status}`)}
            </Badge>
          );
        },
      },
      {
        accessorKey: "viewsCount",
        header: t("columns.views"),
        cell: ({ row }) => {
          return (
            <span className="text-xs text-muted-foreground font-mono">
              {row.original.viewsCount}
            </span>
          );
        },
      },
      {
        id: "actions",
        header: t("columns.actions"),
        cell: ({ row }) => {
          const art = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canManage && (
                  <>
                    <DropdownMenuItem asChild>
                      <Link href={`/dashboard/articles/${art.id}/edit`}>
                        <Edit2 className="mr-2 h-4 w-4" />
                        <span>{tCommon("actions.edit")}</span>
                      </Link>
                    </DropdownMenuItem>

                    {art.status !== "published" ? (
                      <DropdownMenuItem
                        onClick={() => handleTogglePublish(art)}
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-600" />
                        <span>{t("publishNow")}</span>
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        onClick={() => handleTogglePublish(art)}
                      >
                        <XCircle className="mr-2 h-4 w-4 text-amber-600" />
                        <span>{t("unpublish")}</span>
                      </DropdownMenuItem>
                    )}

                    <DropdownMenuItem
                      onClick={() => {
                        setArticleToDelete(art);
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
    [canManage, categoryMap, handleTogglePublish, t, tCommon],
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
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("filterAllStatuses")}</SelectItem>
              <SelectItem value="draft">{t("statuses.draft")}</SelectItem>
              <SelectItem value="published">
                {t("statuses.published")}
              </SelectItem>
              <SelectItem value="archived">{t("statuses.archived")}</SelectItem>
            </SelectContent>
          </Select>

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full sm:w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("filterAllCategories")}</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {canManage && (
          <Button asChild>
            <Link href="/dashboard/articles/create">
              <Plus className="mr-2 h-4 w-4" />
              <span>{t("createArticle")}</span>
            </Link>
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={filteredData}
        emptyMessage={t("emptyArticles")}
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
    </div>
  );
}
