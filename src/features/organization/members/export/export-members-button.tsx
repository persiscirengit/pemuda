"use client";

import { Download, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { exportMembersCsvAction } from "@/features/organization/members/actions";
import type { GetMembersParams } from "@/server/dal/organization/members";

export interface ExportMembersButtonProps {
  filters?: GetMembersParams;
  variant?: "default" | "outline" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
}

export function ExportMembersButton({
  filters,
  variant = "outline",
  size = "sm",
}: ExportMembersButtonProps) {
  const t = useTranslations("members");
  const [isExporting, setIsExporting] = React.useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const res = await exportMembersCsvAction({
        search: filters?.search,
        departmentId: filters?.departmentId,
        positionId: filters?.positionId,
        memberStatus: filters?.memberStatus,
        ageLimitDue: filters?.ageLimitDue,
      });

      if (res?.serverError) {
        toast.error(res.serverError);
        return;
      }

      if (res?.data?.csv) {
        const blob = new Blob([res.data.csv], {
          type: "text/csv;charset=utf-8;",
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", res.data.filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } catch {
      toast.error(t("errorGeneric"));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleExport}
      disabled={isExporting}
    >
      {isExporting ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Download className="mr-2 h-4 w-4" />
      )}
      <span>{isExporting ? t("exporting") : t("exportCsv")}</span>
    </Button>
  );
}
