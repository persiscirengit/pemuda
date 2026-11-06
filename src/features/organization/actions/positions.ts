"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PERMISSIONS } from "@/lib/permissions";
import { createPermissionActionClient } from "@/lib/safe-action";
import {
  createPosition,
  deletePosition,
  togglePositionStatus,
  updatePosition,
} from "@/server/dal/organization/positions";

const createPositionSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  description: z.string().trim().max(500).optional().nullable(),
  status: z.enum(["active", "inactive"]).default("active"),
});

const updatePositionSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1, "Name is required").max(100).optional(),
  description: z.string().trim().max(500).optional().nullable(),
  status: z.enum(["active", "inactive"]).optional(),
});

const togglePositionStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["active", "inactive"]),
});

const deletePositionSchema = z.object({
  id: z.string().uuid(),
});

const manageClient = createPermissionActionClient(
  PERMISSIONS.ORGANIZATION_POSITIONS_MANAGE,
);

export const createPositionAction = manageClient
  .inputSchema(createPositionSchema)
  .action(async ({ parsedInput }) => {
    const position = await createPosition(parsedInput);
    revalidatePath("/positions");
    return { position };
  });

export const updatePositionAction = manageClient
  .inputSchema(updatePositionSchema)
  .action(async ({ parsedInput }) => {
    const { id, ...data } = parsedInput;
    const position = await updatePosition(id, data);
    revalidatePath("/positions");
    return { position };
  });

export const togglePositionStatusAction = manageClient
  .inputSchema(togglePositionStatusSchema)
  .action(async ({ parsedInput }) => {
    const position = await togglePositionStatus(
      parsedInput.id,
      parsedInput.status,
    );
    revalidatePath("/positions");
    return { position };
  });

export const deletePositionAction = manageClient
  .inputSchema(deletePositionSchema)
  .action(async ({ parsedInput }) => {
    await deletePosition(parsedInput.id);
    revalidatePath("/positions");
    return { success: true };
  });
