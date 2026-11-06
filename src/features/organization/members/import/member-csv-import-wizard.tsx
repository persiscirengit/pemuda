"use client";

import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileUp,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getMemberCsvTemplateAction,
  importMembersCsvAction,
} from "@/features/organization/members/actions";
import type { MemberCsvImportResult } from "@/server/dal/organization/member-csv";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export function MemberCsvImportWizard() {
  const t = useTranslations("members");
  const router = useRouter();

  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [csvContent, setCsvContent] = React.useState<string>("");
  const [isDownloadingTemplate, setIsDownloadingTemplate] =
    React.useState(false);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [isDryRun, setIsDryRun] = React.useState(false);
  const [progress, setProgress] = React.useState<number>(0);
  const [result, setResult] = React.useState<MemberCsvImportResult | null>(
    null,
  );
  const [isDragging, setIsDragging] = React.useState(false);

  const handleDownloadTemplate = async () => {
    setIsDownloadingTemplate(true);
    try {
      const res = await getMemberCsvTemplateAction();
      if (res?.data) {
        const blob = new Blob([res.data], {
          type: "text/csv;charset=utf-8;",
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", "members-template.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } catch {
      toast.error(t("importErrorGeneric"));
    } finally {
      setIsDownloadingTemplate(false);
    }
  };

  const handleProcessFile = (file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      toast.error(t("fileSizeExceeded"));
      return;
    }

    setSelectedFile(file);
    setResult(null);
    setProgress(20);

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setCsvContent(content);
      setProgress(100);
    };
    reader.onerror = () => {
      toast.error(t("importErrorGeneric"));
    };
    reader.readAsText(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleProcessFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleProcessFile(file);
    }
  };

  const handleRunImport = async (dryRun: boolean) => {
    if (!csvContent) {
      toast.error(t("noFileSelected"));
      return;
    }

    setIsProcessing(true);
    setIsDryRun(dryRun);
    setProgress(40);

    try {
      const res = await importMembersCsvAction({
        csvContent,
        dryRun,
      });

      setProgress(80);

      if (res?.serverError) {
        toast.error(res.serverError);
        return;
      }

      if (res?.data) {
        setResult(res.data);
        setProgress(100);

        if (dryRun) {
          if (res.data.failed === 0) {
            toast.success(t("dryRunPassed"));
          } else {
            toast.error(t("importSummaryFailed", { count: res.data.failed }));
          }
        } else {
          toast.success(t("importSuccess"));
          router.refresh();
        }
      }
    } catch {
      toast.error(t("importErrorGeneric"));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Download Template Card */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              <span>{t("downloadTemplate")}</span>
            </CardTitle>
            <CardDescription>{t("importDescription")}</CardDescription>
          </div>
          <Button
            variant="outline"
            onClick={handleDownloadTemplate}
            disabled={isDownloadingTemplate}
          >
            {isDownloadingTemplate ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            <span>{t("downloadTemplate")}</span>
          </Button>
        </CardHeader>
      </Card>

      {/* Upload & Dropzone Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileUp className="h-5 w-5 text-primary" />
            <span>{t("importTitle")}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <section
            aria-label={t("dragDropCsv")}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-primary/50"
            }`}
          >
            <div className="flex flex-col items-center justify-center gap-3">
              <FileSpreadsheet className="h-10 w-10 text-muted-foreground" />
              <div className="space-y-1">
                <p className="text-sm font-medium">{t("dragDropCsv")}</p>
                {selectedFile && (
                  <p className="text-xs text-muted-foreground">
                    {t("selectedFile", { filename: selectedFile.name })}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 mt-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <FileUp className="mr-2 h-4 w-4" />
                  <span>{t("importCsv")}</span>
                </Button>
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileInputChange}
                  className="hidden"
                />
              </div>
            </div>
          </section>

          {isProcessing && (
            <div className="space-y-2 pt-2">
              <Progress value={progress} />
              <p className="text-xs text-muted-foreground text-center">
                {isDryRun ? t("previewing") : t("importing")}
              </p>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => handleRunImport(true)}
              disabled={!csvContent || isProcessing}
            >
              {isProcessing && isDryRun ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              <span>{t("dryRunPreview")}</span>
            </Button>

            <Button
              onClick={() => handleRunImport(false)}
              disabled={!csvContent || isProcessing}
            >
              {isProcessing && !isDryRun ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              <span>{t("executeImport")}</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results & Errors Summary */}
      {result && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-lg">
                {isDryRun ? t("dryRunPreview") : t("importSuccess")}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="default">
                  {t("importSummaryCreated", { count: result.created })}
                </Badge>
                <Badge variant="secondary">
                  {t("importSummaryUpdated", { count: result.updated })}
                </Badge>
                {result.failed > 0 && (
                  <Badge variant="destructive">
                    {t("importSummaryFailed", { count: result.failed })}
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          {result.errors.length > 0 && (
            <CardContent className="space-y-4">
              <h4 className="text-sm font-semibold flex items-center gap-2 text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span>
                  {t("importErrorsTitle", { count: result.errors.length })}
                </span>
              </h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">{t("rowNumber")}</TableHead>
                    <TableHead className="w-36">{t("columnName")}</TableHead>
                    <TableHead>{t("errorMessage")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.errors.map((err) => (
                    <TableRow
                      key={`err-${err.row}-${err.column || "all"}-${err.message.slice(0, 20)}`}
                    >
                      <TableCell className="font-mono text-xs">
                        {err.row}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {err.column || "-"}
                      </TableCell>
                      <TableCell className="text-sm text-destructive">
                        {err.message}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}
