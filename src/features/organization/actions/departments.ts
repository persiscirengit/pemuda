"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PERMISSIONS } from "@/lib/permissions";
import { createPermissionActionClient } from "@/lib/safe-action";
import {
  createDepartment,
  deleteDepartment,
  toggleDepartmentStatus,
  updateDepartment,
} from "@/server/dal/organization/departments";

const createDepartmentSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  description: z.string().trim().max(500).optional().nullable(),
  status: z.enum(["active", "inactive"]).default("active"),
});

const updateDepartmentSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1, "Name is required").max(100).optional(),
  description: z.string().trim().max(500).optional().nullable(),
  status: z.enum(["active", "inactive"]).optional(),
});

const toggleDepartmentStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["active", "inactive"]),
});

const deleteDepartmentSchema = z.object({
  id: z.string().uuid(),
});

const manageClient = createPermissionActionClient(
  PERMISSIONS.ORGANIZATION_DEPARTMENTS_MANAGE,
);

export const createDepartmentAction = manageClient
  .inputSchema(createDepartmentSchema)
  .action(async ({ parsedInput }) => {
    const department = await createDepartment(parsedInput);
    revalidatePath("/departments");
    return { department };
  });

export const updateDepartmentAction = manageClient
  .inputSchema(updateDepartmentSchema)
  .action(async ({ parsedInput }) => {
    const { id, ...data } = parsedInput;
    const department = await updateDepartment(id, data);
    revalidatePath("/departments");
    return { department };
  });

export const toggleDepartmentStatusAction = manageClient
  .inputSchema(toggleDepartmentStatusSchema)
  .action(async ({ parsedInput }) => {
    const department = await toggleDepartmentStatus(
      parsedInput.id,
      parsedInput.status,
    );
    revalidatePath("/departments");
    return { department };
  });

export const deleteDepartmentAction = manageClient
  .inputSchema(deleteDepartmentSchema)
  .action(async ({ parsedInput }) => {
    await deleteDepartment(parsedInput.id);
    revalidatePath("/departments");
    return { success: true };
  });
