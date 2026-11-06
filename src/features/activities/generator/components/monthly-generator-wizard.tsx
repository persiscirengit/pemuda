"use client";

import { AlertCircle, Calendar, Check, Loader2 } from "lucide-react";
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
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AgendaSchedule } from "@/db/schema/activities";
import type { CalculatedOccurrence } from "@/server/dal/activities/generator";
import {
  generateMonthlyActivitiesAction,
  getScheduleOccurrencesPreviewAction,
} from "../actions";

export interface MonthlyGeneratorWizardProps {
  schedule: AgendaSchedule;
  initialYear: number;
  initialMonth: number;
  initialOccurrences: CalculatedOccurrence[];
}

export function MonthlyGeneratorWizard({
  schedule,
  initialYear,
  initialMonth,
  initialOccurrences,
}: MonthlyGeneratorWizardProps) {
  const t = useTranslations("activities.generator");
  const tSchedules = useTranslations("activities.schedules");
  const tCommon = useTranslations("common");
  const router = useRouter();

  const [year, setYear] = React.useState<number>(initialYear);
  const [month, setMonth] = React.useState<number>(initialMonth);
  const [occurrences, setOccurrences] =
    React.useState<CalculatedOccurrence[]>(initialOccurrences);
  const [isCalculating, setIsCalculating] = React.useState(false);
  const [isGenerating, setIsGenerating] = React.useState(false);

  const handleRecalculate = React.useCallback(
    async (targetYear: number, targetMonth: number) => {
      setIsCalculating(true);
      try {
        const res = await getScheduleOccurrencesPreviewAction({
          scheduleId: schedule.id,
          year: targetYear,
          month: targetMonth,
        });

        if (res?.data?.occurrences) {
          setOccurrences(res.data.occurrences);
        } else if (res?.serverError) {
          toast.error(res.serverError);
        }
      } catch {
        toast.error(tCommon("errors.unexpected"));
      } finally {
        setIsCalculating(false);
      }
    },
    [schedule.id, tCommon],
  );

  const handleToggleActive = (index: number) => {
    setOccurrences((prev) =>
      prev.map((occ, i) =>
        i === index ? { ...occ, isActive: !occ.isActive } : occ,
      ),
    );
  };

  const handleTopicChange = (index: number, newTopic: string) => {
    setOccurrences((prev) =>
      prev.map((occ, i) => (i === index ? { ...occ, topic: newTopic } : occ)),
    );
  };

  // Summary counts
  const totalCount = occurrences.length;
  const duplicateCount = occurrences.filter((o) => o.isDuplicate).length;
  const inactiveCount = occurrences.filter(
    (o) => !o.isActive && !o.isDuplicate,
  ).length;
  const toCreateCount = occurrences.filter(
    (o) => o.isActive && !o.isDuplicate,
  ).length;

  const handleGenerate = async () => {
    if (toCreateCount === 0) {
      toast.error(tCommon("errors.noData"));
      return;
    }

    setIsGenerating(true);
    try {
      const res = await generateMonthlyActivitiesAction({
        scheduleId: schedule.id,
        year,
        month,
        occurrences: occurrences.map((o) => ({
          weekNumber: o.weekNumber,
          date: o.date,
          topic: o.topic,
          isActive: o.isActive && !o.isDuplicate,
        })),
      });

      if (res?.data) {
        toast.success(
          t("generatedSuccess", {
            created: res.data.created,
            synced: res.data.participantsSynced,
          }),
        );
        router.push("/activities");
      } else if (res?.serverError) {
        toast.error(res.serverError);
      }
    } catch {
      toast.error(tCommon("errors.unexpected"));
    } finally {
      setIsGenerating(false);
    }
  };

  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear, currentYear + 1, currentYear + 2];
  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1);
  const scheduleDescription = `${t("targetSchedule")}: ${schedule.title}`;

  return (
    <div className="space-y-6">
      {/* Configuration Card */}
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{scheduleDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field>
              <FieldLabel>{t("monthLabel")}</FieldLabel>
              <Select
                value={String(month)}
                onValueChange={(val) => {
                  const m = Number(val);
                  setMonth(m);
                  handleRecalculate(year, m);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      {t(`months.${m}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel>{t("yearLabel")}</FieldLabel>
              <Select
                value={String(year)}
                onValueChange={(val) => {
                  const y = Number(val);
                  setYear(y);
                  handleRecalculate(y, month);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <div className="flex items-end">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => handleRecalculate(year, month)}
                disabled={isCalculating}
              >
                {isCalculating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Calendar className="mr-2 h-4 w-4" />
                )}
                <span>{t("calculateButton")}</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Occurrences Table Card */}
      <Card>
        <CardHeader>
          <CardTitle>{t("occurrencesTitle")}</CardTitle>
          <CardDescription>{t("occurrencesSubtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">{t("weekColumn")}</TableHead>
                  <TableHead className="w-40">{t("dateColumn")}</TableHead>
                  <TableHead>{t("topicColumn")}</TableHead>
                  <TableHead className="w-24 text-center">
                    {t("activeColumn")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {occurrences.map((occ, idx) => (
                  <TableRow key={occ.weekNumber}>
                    <TableCell className="font-semibold">
                      {occ.weekNumber}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="font-mono text-sm">{occ.date}</span>
                        {occ.isDuplicate && (
                          <Badge variant="secondary" className="w-fit text-xs">
                            <AlertCircle className="mr-1 h-3 w-3" />
                            {t("duplicateNotice")}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Input
                        value={occ.topic || ""}
                        onChange={(e) => handleTopicChange(idx, e.target.value)}
                        placeholder={tSchedules("topicPlaceholder")}
                        disabled={occ.isDuplicate || !occ.isActive}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        type="button"
                        variant={occ.isActive ? "default" : "outline"}
                        size="sm"
                        disabled={occ.isDuplicate}
                        onClick={() => handleToggleActive(idx)}
                        className="h-8 px-2"
                      >
                        {occ.isActive ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <span className="text-xs">
                            {tCommon("status.inactive")}
                          </span>
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle>{t("summaryTitle")}</CardTitle>
          <CardDescription>{t("activeMembersNotice")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-lg border p-3 text-center">
              <span className="text-xs text-muted-foreground">
                {t("totalOccurrences")}
              </span>
              <p className="text-2xl font-bold">{totalCount}</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <span className="text-xs text-muted-foreground">
                {t("toCreate")}
              </span>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {toCreateCount}
              </p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <span className="text-xs text-muted-foreground">
                {t("toSkipDuplicate")}
              </span>
              <p className="text-2xl font-bold text-muted-foreground">
                {duplicateCount}
              </p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <span className="text-xs text-muted-foreground">
                {t("toSkipInactive")}
              </span>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {inactiveCount}
              </p>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end gap-3 border-t pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isGenerating}
          >
            {tCommon("actions.back")}
          </Button>
          <Button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating || toCreateCount === 0}
          >
            {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <span>{isGenerating ? t("generating") : t("generateButton")}</span>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
