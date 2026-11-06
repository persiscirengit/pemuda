"use client";

import type { ColumnDef, TableFeatures } from "@tanstack/react-table";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Edit2,
  MoreHorizontal,
  Plus,
  Trash2,
} from "lucide-react";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { FinancialCategory } from "@/db/schema/finance";
import { deleteTransactionAction } from "@/features/finance/transactions/actions";
import type { TransactionWithDetails } from "@/server/dal/finance/transactions";
import { FinancialTransactionDialog } from "./financial-transaction-dialog";

export interface FinancialTransactionsTableProps {
  initialTransactions: TransactionWithDetails[];
  categories: FinancialCategory[];
  initialType?: "all" | "income" | "expense";
}

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function FinancialTransactionsTable({
  initialTransactions,
  categories,
  initialType = "all",
}: FinancialTransactionsTableProps) {
  const t = useTranslations("finance");
  const router = useRouter();

  const [activeType, setActiveType] = React.useState<
    "all" | "income" | "expense"
  >(initialType);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingTransaction, setEditingTransaction] =
    React.useState<TransactionWithDetails | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const filteredTransactions = React.useMemo(() => {
    return initialTransactions.filter((tx) => {
      if (activeType !== "all" && tx.type !== activeType) {
        return false;
      }

      if (searchQuery.trim().length > 0) {
        const query = searchQuery.toLowerCase();
        const titleMatch = tx.title.toLowerCase().includes(query);
        const descMatch =
          tx.description?.toLowerCase().includes(query) ?? false;
        const refMatch = tx.referenceNo?.toLowerCase().includes(query) ?? false;
        if (!titleMatch && !descMatch && !refMatch) {
          return false;
        }
      }

      const txDateStr =
        typeof tx.transactionDate === "string"
          ? tx.transactionDate
          : new Date(tx.transactionDate).toISOString().slice(0, 10);

      if (startDate && txDateStr < startDate) {
        return false;
      }

      if (endDate && txDateStr > endDate) {
        return false;
      }

      return true;
    });
  }, [initialTransactions, activeType, searchQuery, startDate, endDate]);

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      const res = await deleteTransactionAction({ id: deletingId });
      if (res?.serverError) {
        toast.error(res.serverError);
        return;
      }
      toast.success(t("successTransactionDeleted"));
      setDeletingId(null);
      router.refresh();
    } catch {
      toast.error(t("errorTransactionSave"));
    }
  };

  const columns: ColumnDef<TableFeatures, TransactionWithDetails>[] =
    React.useMemo(
      () => [
        {
          accessorKey: "transactionDate",
          header: t("transactionDate"),
          cell: ({ row }) => {
            const dateStr =
              typeof row.original.transactionDate === "string"
                ? row.original.transactionDate
                : new Date(row.original.transactionDate)
                    .toISOString()
                    .slice(0, 10);
            return (
              <span className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                {dateStr}
              </span>
            );
          },
        },
        {
          accessorKey: "title",
          header: t("title"),
          cell: ({ row }) => (
            <div>
              <div className="font-medium text-foreground">
                {row.original.title}
              </div>
              {row.original.description && (
                <div className="text-xs text-muted-foreground line-clamp-1">
                  {row.original.description}
                </div>
              )}
            </div>
          ),
        },
        {
          accessorKey: "type",
          header: t("type"),
          cell: ({ row }) => {
            const isIncome = row.original.type === "income";
            return (
              <Badge
                variant={isIncome ? "default" : "destructive"}
                className="gap-1 capitalize"
              >
                {isIncome ? (
                  <ArrowDownLeft className="h-3 w-3" />
                ) : (
                  <ArrowUpRight className="h-3 w-3" />
                )}
                {isIncome ? t("income") : t("expense")}
              </Badge>
            );
          },
        },
        {
          accessorKey: "category",
          header: t("category"),
          cell: ({ row }) => (
            <Badge variant="secondary" className="gap-1.5 font-normal">
              {row.original.category?.color && (
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: row.original.category.color }}
                />
              )}
              {row.original.category?.name ?? t("selectCategory")}
            </Badge>
          ),
        },
        {
          accessorKey: "amountIdr",
          header: t("amount"),
          cell: ({ row }) => {
            const isIncome = row.original.type === "income";
            const prefix = isIncome ? "+" : "-";
            const val = formatRupiah(Number(row.original.amountIdr));
            const display = `${prefix}${val}`;
            return (
              <span
                className={`font-semibold font-mono text-sm whitespace-nowrap ${
                  isIncome
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"
                }`}
              >
                {display}
              </span>
            );
          },
        },
        {
          accessorKey: "paymentMethod",
          header: t("paymentMethod"),
          cell: ({ row }) => {
            const method = row.original.paymentMethod;
            const label = method ? t(method) : t("cash");
            return (
              <span className="text-xs text-muted-foreground capitalize">
                {label}
              </span>
            );
          },
        },
        {
          accessorKey: "referenceNo",
          header: t("referenceNo"),
          cell: ({ row }) => {
            const ref = row.original.referenceNo;
            if (!ref) return null;
            return (
              <Badge
                variant="outline"
                className="font-mono text-xs max-w-36 truncate"
              >
                {ref}
              </Badge>
            );
          },
        },
        {
          id: "actions",
          cell: ({ row }) => (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => {
                    setEditingTransaction(row.original);
                    setDialogOpen(true);
                  }}
                >
                  <Edit2 className="mr-2 h-4 w-4" />
                  {t("editTransaction")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => setDeletingId(row.original.id)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t("deleteTransaction")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ),
        },
      ],
      [t],
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={activeType}
          onValueChange={(val) =>
            setActiveType(val as "all" | "income" | "expense")
          }
        >
          <TabsList>
            <TabsTrigger value="all">{t("allTypes")}</TabsTrigger>
            <TabsTrigger value="income">{t("income")}</TabsTrigger>
            <TabsTrigger value="expense">{t("expense")}</TabsTrigger>
          </TabsList>
        </Tabs>

        <Button
          onClick={() => {
            setEditingTransaction(null);
            setDialogOpen(true);
          }}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          {t("addTransaction")}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="relative">
          <Input
            placeholder={t("searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filteredTransactions}
        emptyMessage={t("emptyTransactions")}
      />

      <FinancialTransactionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        transaction={editingTransaction}
        categories={categories}
        defaultType={activeType === "all" ? "income" : activeType}
        onSuccess={() => router.refresh()}
      />

      <ConfirmDialog
        open={!!deletingId}
        onOpenChange={(open) => !open && setDeletingId(null)}
        title={t("deleteTransaction")}
        description={t("deleteTransactionConfirm")}
        onConfirm={handleDelete}
      />
    </div>
  );
}
