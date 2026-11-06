"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PERMISSIONS } from "@/lib/permissions";
import { createPermissionActionClient } from "@/lib/safe-action";
import {
  createActivity,
  deleteActivity,
  updateActivity,
  updateActivityStatus,
} from "@/server/dal/activities/events";

const activityStatusEnum = z.enum([
  "scheduled",
  "completed",
  "holiday",
  "postponed",
  "relocated",
  "cancelled",
]);

const createActivitySchema = z.object({
  agendaScheduleId: z.string().uuid().optional().nullable(),
  departmentId: z.string().uuid().optional().nullable(),
  picId: z.string().uuid().optional().nullable(),
  title: z.string().trim().min(1, "Title is required").max(200),
  topic: z.string().trim().max(255).optional().nullable(),
  description: z.string().trim().max(1000).optional().nullable(),
  activityDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  startTime: z.string().optional().nullable(),
  endTime: z.string().optional().nullable(),
  location: z.string().trim().max(255).optional().nullable(),
  latitude: z.union([z.number(), z.string()]).optional().nullable(),
  longitude: z.union([z.number(), z.string()]).optional().nullable(),
  attendanceRadius: z.number().int().positive().default(100),
  status: activityStatusEnum.default("scheduled"),
  changeReason: z.string().trim().max(500).optional().nullable(),
  attendanceEnabled: z.boolean().default(true),
});

const updateActivitySchema = z.object({
  id: z.string().uuid(),
  agendaScheduleId: z.string().uuid().optional().nullable(),
  departmentId: z.string().uuid().optional().nullable(),
  picId: z.string().uuid().optional().nullable(),
  title: z.string().trim().min(1, "Title is required").max(200).optional(),
  topic: z.string().trim().max(255).optional().nullable(),
  description: z.string().trim().max(1000).optional().nullable(),
  activityDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)")
    .optional(),
  startTime: z.string().optional().nullable(),
  endTime: z.string().optional().nullable(),
  location: z.string().trim().max(255).optional().nullable(),
  latitude: z.union([z.number(), z.string()]).optional().nullable(),
  longitude: z.union([z.number(), z.string()]).optional().nullable(),
  attendanceRadius: z.number().int().positive().optional(),
  attendanceEnabled: z.boolean().optional(),
});

const updateActivityStatusSchema = z.object({
  id: z.string().uuid(),
  status: activityStatusEnum,
  changeReason: z.string().trim().max(500).optional().nullable(),
});

const deleteActivitySchema = z.object({
  id: z.string().uuid(),
});

const createClient = createPermissionActionClient(
  PERMISSIONS.ACTIVITIES_EVENTS_CREATE,
);

const updateClient = createPermissionActionClient(
  PERMISSIONS.ACTIVITIES_EVENTS_UPDATE,
);

const statusClient = createPermissionActionClient(
  PERMISSIONS.ACTIVITIES_EVENTS_STATUS,
);

const deleteClient = createPermissionActionClient(
  PERMISSIONS.ACTIVITIES_EVENTS_DELETE,
);

export const createActivityAction = createClient
  .inputSchema(createActivitySchema)
  .action(async ({ parsedInput, ctx }) => {
    const activity = await createActivity(parsedInput, {
      session: ctx.session,
      user: ctx.user,
    });
    revalidatePath("/activities");
    return { activity };
  });

export const updateActivityAction = updateClient
  .inputSchema(updateActivitySchema)
  .action(async ({ parsedInput, ctx }) => {
    const { id, ...data } = parsedInput;
    const activity = await updateActivity(id, data, {
      session: ctx.session,
      user: ctx.user,
    });
    revalidatePath("/activities");
    revalidatePath(`/activities/${id}`);
    return { activity };
  });

export const updateActivityStatusAction = statusClient
  .inputSchema(updateActivityStatusSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { id, status, changeReason } = parsedInput;
    const activity = await updateActivityStatus(
      id,
      { status, changeReason },
      {
        session: ctx.session,
        user: ctx.user,
      },
    );
    revalidatePath("/activities");
    revalidatePath(`/activities/${id}`);
    return { activity };
  });

export const deleteActivityAction = deleteClient
  .inputSchema(deleteActivitySchema)
  .action(async ({ parsedInput, ctx }) => {
    await deleteActivity(parsedInput.id, {
      session: ctx.session,
      user: ctx.user,
    });
    revalidatePath("/activities");
    return { success: true };
  });
