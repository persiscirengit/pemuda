"use client";

import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { AgendaWeeklyTopic } from "@/db/schema/activities";
import { updateWeeklyTopicsAction } from "../actions";

export interface CurriculumTopicEditorProps {
  scheduleId: string;
  initialTopics?: AgendaWeeklyTopic[];
  canManage?: boolean;
}

export function CurriculumTopicEditor({
  scheduleId,
  initialTopics = [],
  canManage = true,
}: CurriculumTopicEditorProps) {
  const t = useTranslations("activities.schedules");
  const tCommon = useTranslations("common");
  const router = useRouter();

  const [topics, setTopics] = React.useState<
    { weekNumber: number; topic: string }[]
  >(() => {
    return [1, 2, 3, 4, 5].map((w) => {
      const existing = initialTopics.find((t) => t.weekNumber === w);
      return {
        weekNumber: w,
        topic: existing?.topic ?? "",
      };
    });
  });

  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    setTopics(
      [1, 2, 3, 4, 5].map((w) => {
        const existing = initialTopics.find((t) => t.weekNumber === w);
        return {
          weekNumber: w,
          topic: existing?.topic ?? "",
        };
      }),
    );
  }, [initialTopics]);

  const handleTopicChange = (weekNumber: number, value: string) => {
    setTopics((prev) =>
      prev.map((item) =>
        item.weekNumber === weekNumber ? { ...item, topic: value } : item,
      ),
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const res = await updateWeeklyTopicsAction({
        scheduleId,
        topics: topics.map((t) => ({
          weekNumber: t.weekNumber,
          topic: t.topic.trim() || null,
          isActive: true,
        })),
      });

      if (res?.serverError) {
        toast.error(res.serverError);
        return;
      }

      toast.success(t("topicsSavedSuccess"));
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("weeklyCurriculumTitle")}</CardTitle>
        <CardDescription>{t("weeklyCurriculumSubtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-4">
          <FieldGroup>
            {topics.map((item) => (
              <Field key={item.weekNumber}>
                <FieldLabel>
                  {t("week", { number: item.weekNumber })}
                </FieldLabel>
                <Input
                  value={item.topic}
                  onChange={(e) =>
                    handleTopicChange(item.weekNumber, e.target.value)
                  }
                  placeholder={t("topicPlaceholder")}
                  disabled={!canManage || isSaving}
                />
              </Field>
            ))}
          </FieldGroup>

          {canManage && (
            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={isSaving} className="gap-2">
                <Save className="size-4" />
                {isSaving ? tCommon("actions.saving") : t("saveTopicsButton")}
              </Button>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
