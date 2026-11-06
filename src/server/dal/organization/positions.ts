import "server-only";

import { and, eq, ilike } from "drizzle-orm";
import { db } from "@/db";
import { type Position, positions } from "@/db/schema/organization";
import { PERMISSIONS } from "@/lib/permissions";
import { requirePermission, type UserSession } from "@/server/dal/auth";

export interface GetPositionsParams {
  search?: string;
  status?: "active" | "inactive";
}

export interface CreatePositionInput {
  name: string;
  description?: string | null;
  status?: "active" | "inactive";
}

export interface UpdatePositionInput {
  name?: string;
  description?: string | null;
  status?: "active" | "inactive";
}

export async function getPositions(
  params?: GetPositionsParams,
  sessionOverride?: UserSession,
): Promise<Position[]> {
  await requirePermission(
    PERMISSIONS.ORGANIZATION_POSITIONS_READ,
    sessionOverride,
  );

  const conditions = [];

  if (params?.search && params.search.trim().length > 0) {
    conditions.push(ilike(positions.name, `%${params.search.trim()}%`));
  }

  if (params?.status) {
    conditions.push(eq(positions.status, params.status));
  }

  const query = db.select().from(positions).orderBy(positions.name);

  if (conditions.length > 0) {
    return query.where(and(...conditions));
  }

  return query;
}

export async function getPositionById(
  id: string,
  sessionOverride?: UserSession,
): Promise<Position | null> {
  await requirePermission(
    PERMISSIONS.ORGANIZATION_POSITIONS_READ,
    sessionOverride,
  );

  const [position] = await db
    .select()
    .from(positions)
    .where(eq(positions.id, id))
    .limit(1);

  return position ?? null;
}

export async function createPosition(
  input: CreatePositionInput,
  sessionOverride?: UserSession,
): Promise<Position> {
  await requirePermission(
    PERMISSIONS.ORGANIZATION_POSITIONS_MANAGE,
    sessionOverride,
  );

  const trimmedName = input.name.trim();
  if (!trimmedName) {
    throw new Error("Position name is required");
  }

  const existing = await db
    .select()
    .from(positions)
    .where(eq(positions.name, trimmedName))
    .limit(1);

  if (existing.length > 0) {
    throw new Error(`Position with name "${trimmedName}" already exists`);
  }

  const [created] = await db
    .insert(positions)
    .values({
      name: trimmedName,
      description: input.description?.trim() || null,
      status: input.status ?? "active",
    })
    .returning();

  if (!created) {
    throw new Error("Failed to create position");
  }

  return created;
}

export async function updatePosition(
  id: string,
  input: UpdatePositionInput,
  sessionOverride?: UserSession,
): Promise<Position> {
  await requirePermission(
    PERMISSIONS.ORGANIZATION_POSITIONS_MANAGE,
    sessionOverride,
  );

  const existing = await getPositionById(id, sessionOverride);
  if (!existing) {
    throw new Error(`Position with id "${id}" not found`);
  }

  const updates: Partial<typeof positions.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (input.name !== undefined) {
    const trimmedName = input.name.trim();
    if (!trimmedName) {
      throw new Error("Position name cannot be empty");
    }

    if (trimmedName.toLowerCase() !== existing.name.toLowerCase()) {
      const duplicate = await db
        .select()
        .from(positions)
        .where(eq(positions.name, trimmedName))
        .limit(1);

      if (duplicate.length > 0) {
        throw new Error(`Position with name "${trimmedName}" already exists`);
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
    .update(positions)
    .set(updates)
    .where(eq(positions.id, id))
    .returning();

  if (!updated) {
    throw new Error("Failed to update position");
  }

  return updated;
}

export async function togglePositionStatus(
  id: string,
  status: "active" | "inactive",
  sessionOverride?: UserSession,
): Promise<Position> {
  return updatePosition(id, { status }, sessionOverride);
}

export async function deletePosition(
  id: string,
  sessionOverride?: UserSession,
): Promise<void> {
  await requirePermission(
    PERMISSIONS.ORGANIZATION_POSITIONS_MANAGE,
    sessionOverride,
  );

  await db.delete(positions).where(eq(positions.id, id));
}
