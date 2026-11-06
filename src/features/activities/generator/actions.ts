"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PERMISSIONS } from "@/lib/permissions";
import { createPermissionActionClient } from "@/lib/safe-action";
import {
  calculateMonthlyOccurrences,
  generateMonthlyActivities,
} from "@/server/dal/activities/generator";

const occurrenceItemSchema = z.object({
  weekNumber: z.number().int().min(1).max(5),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  topic: z.string().trim().max(255).optional().nullable(),
  isActive: z.boolean(),
});

const previewOccurrencesSchema = z.object({
  scheduleId: z.string().uuid(),
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
});

const generateMonthlyActivitiesSchema = z.object({
  scheduleId: z.string().uuid(),
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  occurrences: z.array(occurrenceItemSchema).optional(),
});

const generateClient = createPermissionActionClient(
  PERMISSIONS.ACTIVITIES_SCHEDULES_GENERATE,
);

export const getScheduleOccurrencesPreviewAction = generateClient
  .inputSchema(previewOccurrencesSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { scheduleId, year, month } = parsedInput;
    const occurrences = await calculateMonthlyOccurrences(
      scheduleId,
      year,
      month,
      {
        session: ctx.session,
        user: ctx.user,
      },
    );
    return { occurrences };
  });

export const generateMonthlyActivitiesAction = generateClient
  .inputSchema(generateMonthlyActivitiesSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { scheduleId, year, month, occurrences } = parsedInput;
    const result = await generateMonthlyActivities(
      scheduleId,
      { year, month, occurrences },
      {
        session: ctx.session,
        user: ctx.user,
      },
    );
    revalidatePath("/activities");
    revalidatePath(`/schedules/${scheduleId}`);
    return result;
  });
