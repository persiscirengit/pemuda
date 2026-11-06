"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PERMISSIONS } from "@/lib/permissions";
import { createPermissionActionClient } from "@/lib/safe-action";
import {
  createActivityLocation,
  deleteActivityLocation,
  toggleLocationStatus,
  updateActivityLocation,
} from "@/server/dal/activities/locations";

const createActivityLocationSchema = z.object({
  name: z.string().trim().min(1, "Location name is required").max(150),
  address: z.string().trim().max(500).optional().nullable(),
  latitude: z.union([z.number(), z.string()]).optional().nullable(),
  longitude: z.union([z.number(), z.string()]).optional().nullable(),
  radiusMeters: z.number().int().positive().default(100),
  isActive: z.boolean().default(true),
});

const updateActivityLocationSchema = z.object({
  id: z.string().uuid(),
  name: z
    .string()
    .trim()
    .min(1, "Location name is required")
    .max(150)
    .optional(),
  address: z.string().trim().max(500).optional().nullable(),
  latitude: z.union([z.number(), z.string()]).optional().nullable(),
  longitude: z.union([z.number(), z.string()]).optional().nullable(),
  radiusMeters: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
});

const toggleLocationStatusSchema = z.object({
  id: z.string().uuid(),
  isActive: z.boolean(),
});

const deleteActivityLocationSchema = z.object({
  id: z.string().uuid(),
});

const manageClient = createPermissionActionClient(
  PERMISSIONS.ACTIVITIES_LOCATIONS_MANAGE,
);

export const createActivityLocationAction = manageClient
  .inputSchema(createActivityLocationSchema)
  .action(async ({ parsedInput }) => {
    const location = await createActivityLocation(parsedInput);
    revalidatePath("/locations");
    return { location };
  });

export const updateActivityLocationAction = manageClient
  .inputSchema(updateActivityLocationSchema)
  .action(async ({ parsedInput }) => {
    const { id, ...data } = parsedInput;
    const location = await updateActivityLocation(id, data);
    revalidatePath("/locations");
    return { location };
  });

export const toggleLocationStatusAction = manageClient
  .inputSchema(toggleLocationStatusSchema)
  .action(async ({ parsedInput }) => {
    const location = await toggleLocationStatus(
      parsedInput.id,
      parsedInput.isActive,
    );
    revalidatePath("/locations");
    return { location };
  });

export const deleteActivityLocationAction = manageClient
  .inputSchema(deleteActivityLocationSchema)
  .action(async ({ parsedInput }) => {
    await deleteActivityLocation(parsedInput.id);
    revalidatePath("/locations");
    return { success: true };
  });
