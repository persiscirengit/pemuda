"use client";

import { AlertCircle, CheckCircle2, Receipt, Wallet } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface MyFeeRecordItem {
  id: string;
  year: number;
  month: number;
  amountIdr: number;
  status: "unpaid" | "paid" | "overdue" | "waived";
  paidAt?: string | null;
  note?: string | null;
}

export interface MyFeesLedgerProps {
  records: MyFeeRecordItem[];
  totalOutstanding: number;
  hasOverdue: boolean;
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function MyFeesLedger({
  records,
  totalOutstanding,
  hasOverdue,
}: MyFeesLedgerProps) {
  const t = useTranslations("portal");

  const formatIdr = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusBadge = (status: MyFeeRecordItem["status"]) => {
    switch (status) {
      case "paid":
        return <Badge variant="default">{t("statusPaid")}</Badge>;
      case "overdue":
        return <Badge variant="destructive">{t("statusOverdue")}</Badge>;
      case "unpaid":
        return <Badge variant="outline">{t("statusUnpaid")}</Badge>;
      case "waived":
        return <Badge variant="secondary">{t("statusWaived")}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Outstanding Balance Banner */}
      {hasOverdue ? (
        <Card className="border-destructive/40 bg-destructive/10 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 text-destructive font-semibold">
              <AlertCircle className="size-5 shrink-0" />
              <CardTitle className="text-base text-destructive">
                {t("overdueWarningTitle")}
              </CardTitle>
            </div>
            <CardDescription className="text-destructive/90 text-sm">
              {t("overdueWarningDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
              <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                {t("totalOutstanding")}
              </span>
              <span className="text-2xl font-bold font-mono text-destructive">
                {formatIdr(totalOutstanding)}
              </span>
            </div>
          </CardContent>
        </Card>
      ) : totalOutstanding > 0 ? (
        <Card className="border-amber-500/40 bg-amber-500/10 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-semibold">
              <Wallet className="size-5 shrink-0" />
              <CardTitle className="text-base text-amber-700 dark:text-amber-400">
                {t("outstandingBalanceTitle")}
              </CardTitle>
            </div>
            <CardDescription className="text-muted-foreground text-sm">
              {t("outstandingBalanceDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
              <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                {t("totalOutstanding")}
              </span>
              <span className="text-2xl font-bold font-mono text-amber-700 dark:text-amber-400">
                {formatIdr(totalOutstanding)}
              </span>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-emerald-500/30 bg-emerald-500/10 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-semibold">
              <CheckCircle2 className="size-5 shrink-0" />
              <CardTitle className="text-base text-emerald-700 dark:text-emerald-400">
                {t("duesFullyPaidTitle")}
              </CardTitle>
            </div>
            <CardDescription className="text-muted-foreground text-sm">
              {t("duesFullyPaidDesc")}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Ledger Table */}
      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Receipt className="size-5 text-primary" />
            <CardTitle className="text-lg font-bold">
              {t("duesHistoryTitle")}
            </CardTitle>
          </div>
          <CardDescription>{t("duesHistorySubtitle")}</CardDescription>
        </CardHeader>

        <CardContent>
          {records.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              {t("noFeeRecords")}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("period")}</TableHead>
                  <TableHead>{t("amount")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead>{t("paymentDate")}</TableHead>
                  <TableHead>{t("notes")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((rec) => {
                  const periodLabel = `${MONTH_NAMES[rec.month - 1] ?? rec.month} ${rec.year}`;
                  return (
                    <TableRow key={rec.id}>
                      <TableCell className="font-medium text-sm">
                        {periodLabel}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {formatIdr(rec.amountIdr)}
                      </TableCell>
                      <TableCell>{getStatusBadge(rec.status)}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {rec.paidAt ?? "-"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                        {rec.note ?? "-"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
