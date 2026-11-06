import "server-only";

import { and, eq, ilike } from "drizzle-orm";
import { db } from "@/db";
import { type Department, departments } from "@/db/schema/organization";
import { PERMISSIONS } from "@/lib/permissions";
import { requirePermission, type UserSession } from "@/server/dal/auth";

export interface GetDepartmentsParams {
  search?: string;
  status?: "active" | "inactive";
}

export interface CreateDepartmentInput {
  name: string;
  description?: string | null;
  status?: "active" | "inactive";
}

export interface UpdateDepartmentInput {
  name?: string;
  description?: string | null;
  status?: "active" | "inactive";
}

export async function getDepartments(
  params?: GetDepartmentsParams,
  sessionOverride?: UserSession,
): Promise<Department[]> {
  await requirePermission(
    PERMISSIONS.ORGANIZATION_DEPARTMENTS_READ,
    sessionOverride,
  );

  const conditions = [];

  if (params?.search && params.search.trim().length > 0) {
    conditions.push(ilike(departments.name, `%${params.search.trim()}%`));
  }

  if (params?.status) {
    conditions.push(eq(departments.status, params.status));
  }

  const query = db.select().from(departments).orderBy(departments.name);

  if (conditions.length > 0) {
    return query.where(and(...conditions));
  }

  return query;
}

export async function getDepartmentById(
  id: string,
  sessionOverride?: UserSession,
): Promise<Department | null> {
  await requirePermission(
    PERMISSIONS.ORGANIZATION_DEPARTMENTS_READ,
    sessionOverride,
  );

  const [department] = await db
    .select()
    .from(departments)
    .where(eq(departments.id, id))
    .limit(1);

  return department ?? null;
}

export async function createDepartment(
  input: CreateDepartmentInput,
  sessionOverride?: UserSession,
): Promise<Department> {
  await requirePermission(
    PERMISSIONS.ORGANIZATION_DEPARTMENTS_MANAGE,
    sessionOverride,
  );

  const trimmedName = input.name.trim();
  if (!trimmedName) {
    throw new Error("Department name is required");
  }

  const existing = await db
    .select()
    .from(departments)
    .where(eq(departments.name, trimmedName))
    .limit(1);

  if (existing.length > 0) {
    throw new Error(`Department with name "${trimmedName}" already exists`);
  }

  const [created] = await db
    .insert(departments)
    .values({
      name: trimmedName,
      description: input.description?.trim() || null,
      status: input.status ?? "active",
    })
    .returning();

  if (!created) {
    throw new Error("Failed to create department");
  }

  return created;
}

export async function updateDepartment(
  id: string,
  input: UpdateDepartmentInput,
  sessionOverride?: UserSession,
): Promise<Department> {
  await requirePermission(
    PERMISSIONS.ORGANIZATION_DEPARTMENTS_MANAGE,
    sessionOverride,
  );

  const existing = await getDepartmentById(id, sessionOverride);
  if (!existing) {
    throw new Error(`Department with id "${id}" not found`);
  }

  const updates: Partial<typeof departments.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (input.name !== undefined) {
    const trimmedName = input.name.trim();
    if (!trimmedName) {
      throw new Error("Department name cannot be empty");
    }

    if (trimmedName.toLowerCase() !== existing.name.toLowerCase()) {
      const duplicate = await db
        .select()
        .from(departments)
        .where(eq(departments.name, trimmedName))
        .limit(1);

      if (duplicate.length > 0) {
        throw new Error(`Department with name "${trimmedName}" already exists`);
      }
    }

    updates.name = trimmedName;
  }

  if (input.description !== undefined) {
    updates.description = input.description?.trim() || null;
  }

  if (input.status !== undefined) {
    updates.status = input.status;
  }

  const [updated] = await db
    .update(departments)
    .set(updates)
    .where(eq(departments.id, id))
    .returning();

  if (!updated) {
    throw new Error("Failed to update department");
  }

  return updated;
}

export async function toggleDepartmentStatus(
  id: string,
  status: "active" | "inactive",
  sessionOverride?: UserSession,
): Promise<Department> {
  return updateDepartment(id, { status }, sessionOverride);
}

export async function deleteDepartment(
  id: string,
  sessionOverride?: UserSession,
): Promise<void> {
  await requirePermission(
    PERMISSIONS.ORGANIZATION_DEPARTMENTS_MANAGE,
    sessionOverride,
  );

  await db.delete(departments).where(eq(departments.id, id));
}
