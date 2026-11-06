"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PERMISSIONS } from "@/lib/permissions";
import { createPermissionActionClient } from "@/lib/safe-action";
import {
  createAgendaSchedule,
  deleteAgendaSchedule,
  toggleScheduleStatus,
  updateAgendaSchedule,
  updateWeeklyTopics,
} from "@/server/dal/activities/schedules";

const scheduleTypeEnum = z.enum(["incidental", "weekly", "monthly", "yearly"]);

const createAgendaScheduleSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().trim().max(1000).optional().nullable(),
  scheduleType: scheduleTypeEnum,
  departmentId: z.string().uuid().optional().nullable(),
  picId: z.string().uuid().optional().nullable(),
  activityLocationId: z.string().uuid().optional().nullable(),
  dayOfWeek: z.number().int().min(0).max(6).optional().nullable(),
  dayOfMonth: z.number().int().min(1).max(31).optional().nullable(),
  specificDate: z.string().optional().nullable(),
  startTime: z.string().optional().nullable(),
  endTime: z.string().optional().nullable(),
  defaultLocation: z.string().trim().max(255).optional().nullable(),
  defaultLatitude: z.union([z.number(), z.string()]).optional().nullable(),
  defaultLongitude: z.union([z.number(), z.string()]).optional().nullable(),
  defaultRadius: z.number().int().positive().default(100),
  isActive: z.boolean().default(true),
});

const updateAgendaScheduleSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1, "Title is required").max(200).optional(),
  description: z.string().trim().max(1000).optional().nullable(),
  scheduleType: scheduleTypeEnum.optional(),
  departmentId: z.string().uuid().optional().nullable(),
  picId: z.string().uuid().optional().nullable(),
  activityLocationId: z.string().uuid().optional().nullable(),
  dayOfWeek: z.number().int().min(0).max(6).optional().nullable(),
  dayOfMonth: z.number().int().min(1).max(31).optional().nullable(),
  specificDate: z.string().optional().nullable(),
  startTime: z.string().optional().nullable(),
  endTime: z.string().optional().nullable(),
  defaultLocation: z.string().trim().max(255).optional().nullable(),
  defaultLatitude: z.union([z.number(), z.string()]).optional().nullable(),
  defaultLongitude: z.union([z.number(), z.string()]).optional().nullable(),
  defaultRadius: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
});

const toggleScheduleStatusSchema = z.object({
  id: z.string().uuid(),
  isActive: z.boolean(),
});

const deleteAgendaScheduleSchema = z.object({
  id: z.string().uuid(),
});

const weeklyTopicItemSchema = z.object({
  weekNumber: z.number().int().min(1).max(5),
  topic: z.string().trim().max(255).optional().nullable(),
  isActive: z.boolean().default(true),
});

const updateWeeklyTopicsSchema = z.object({
  scheduleId: z.string().uuid(),
  topics: z.array(weeklyTopicItemSchema),
});

const manageClient = createPermissionActionClient(
  PERMISSIONS.ACTIVITIES_SCHEDULES_MANAGE,
);

export const createAgendaScheduleAction = manageClient
  .inputSchema(createAgendaScheduleSchema)
  .action(async ({ parsedInput }) => {
    const schedule = await createAgendaSchedule(parsedInput);
    revalidatePath("/schedules");
    return { schedule };
  });

export const updateAgendaScheduleAction = manageClient
  .inputSchema(updateAgendaScheduleSchema)
  .action(async ({ parsedInput }) => {
    const { id, ...data } = parsedInput;
    const schedule = await updateAgendaSchedule(id, data);
    revalidatePath("/schedules");
    revalidatePath(`/schedules/${id}`);
    return { schedule };
  });

export const toggleScheduleStatusAction = manageClient
  .inputSchema(toggleScheduleStatusSchema)
  .action(async ({ parsedInput }) => {
    const schedule = await toggleScheduleStatus(
      parsedInput.id,
      parsedInput.isActive,
    );
    revalidatePath("/schedules");
    revalidatePath(`/schedules/${parsedInput.id}`);
    return { schedule };
  });

export const deleteAgendaScheduleAction = manageClient
  .inputSchema(deleteAgendaScheduleSchema)
  .action(async ({ parsedInput }) => {
    await deleteAgendaSchedule(parsedInput.id);
    revalidatePath("/schedules");
    return { success: true };
  });

export const updateWeeklyTopicsAction = manageClient
  .inputSchema(updateWeeklyTopicsSchema)
  .action(async ({ parsedInput }) => {
    const { scheduleId, topics } = parsedInput;
    const updatedTopics = await updateWeeklyTopics(scheduleId, topics);
    revalidatePath("/schedules");
    revalidatePath(`/schedules/${scheduleId}`);
    return { topics: updatedTopics };
  });
