import "server-only";

import { and, desc, eq, ilike } from "drizzle-orm";
import { db } from "@/db";
import {
  type ActivityLocation,
  activityLocations,
} from "@/db/schema/activities";
import { PERMISSIONS } from "@/lib/permissions";
import { requirePermission, type UserSession } from "@/server/dal/auth";

export interface GetActivityLocationsParams {
  search?: string;
  isActive?: boolean;
}

export interface CreateActivityLocationInput {
  name: string;
  address?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  radiusMeters?: number;
  isActive?: boolean;
}

export interface UpdateActivityLocationInput {
  name?: string;
  address?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  radiusMeters?: number;
  isActive?: boolean;
}

export function validateCoordinates(
  latitude?: number | string | null,
  longitude?: number | string | null,
  radiusMeters?: number,
): void {
  if (latitude !== undefined && latitude !== null && latitude !== "") {
    const lat = Number(latitude);
    if (Number.isNaN(lat) || lat < -90 || lat > 90) {
      throw new Error(
        "Invalid latitude: Latitude must be between -90 and 90 degrees.",
      );
    }
  }

  if (longitude !== undefined && longitude !== null && longitude !== "") {
    const lng = Number(longitude);
    if (Number.isNaN(lng) || lng < -180 || lng > 180) {
      throw new Error(
        "Invalid longitude: Longitude must be between -180 and 180 degrees.",
      );
    }
  }

  if (radiusMeters !== undefined) {
    if (radiusMeters <= 0) {
      throw new Error("Invalid radius: Radius must be greater than 0 meters.");
    }
  }
}

export async function getActivityLocations(
  params?: GetActivityLocationsParams,
  sessionOverride?: UserSession,
): Promise<ActivityLocation[]> {
  await requirePermission(
    PERMISSIONS.ACTIVITIES_LOCATIONS_READ,
    sessionOverride,
  );

  const conditions = [];

  if (params?.search && params.search.trim().length > 0) {
    conditions.push(ilike(activityLocations.name, `%${params.search.trim()}%`));
  }

  if (params?.isActive !== undefined) {
    conditions.push(eq(activityLocations.isActive, params.isActive));
  }

  const query = db
    .select()
    .from(activityLocations)
    .orderBy(desc(activityLocations.createdAt));

  if (conditions.length > 0) {
    return query.where(and(...conditions));
  }

  return query;
}

export async function getActivityLocationById(
  id: string,
  sessionOverride?: UserSession,
): Promise<ActivityLocation | null> {
  await requirePermission(
    PERMISSIONS.ACTIVITIES_LOCATIONS_READ,
    sessionOverride,
  );

  const [location] = await db
    .select()
    .from(activityLocations)
    .where(eq(activityLocations.id, id))
    .limit(1);

  return location ?? null;
}

export async function createActivityLocation(
  input: CreateActivityLocationInput,
  sessionOverride?: UserSession,
): Promise<ActivityLocation> {
  await requirePermission(
    PERMISSIONS.ACTIVITIES_LOCATIONS_MANAGE,
    sessionOverride,
  );

  const trimmedName = input.name.trim();
  if (!trimmedName) {
    throw new Error("Location name is required.");
  }

  validateCoordinates(input.latitude, input.longitude, input.radiusMeters);

  const [created] = await db
    .insert(activityLocations)
    .values({
      name: trimmedName,
      address: input.address?.trim() || null,
      latitude:
        input.latitude !== undefined && input.latitude !== null
          ? String(input.latitude)
          : null,
      longitude:
        input.longitude !== undefined && input.longitude !== null
          ? String(input.longitude)
          : null,
      radiusMeters: input.radiusMeters ?? 100,
      isActive: input.isActive ?? true,
    })
    .returning();

  if (!created) {
    throw new Error("Failed to create activity location.");
  }

  return created;
}

export async function updateActivityLocation(
  id: string,
  input: UpdateActivityLocationInput,
  sessionOverride?: UserSession,
): Promise<ActivityLocation> {
  await requirePermission(
    PERMISSIONS.ACTIVITIES_LOCATIONS_MANAGE,
    sessionOverride,
  );

  const existing = await getActivityLocationById(id, sessionOverride);
  if (!existing) {
    throw new Error(`Location with id "${id}" not found.`);
  }

  validateCoordinates(input.latitude, input.longitude, input.radiusMeters);

  const updates: Partial<typeof activityLocations.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (input.name !== undefined) {
    const trimmed = input.name.trim();
    if (!trimmed) {
      throw new Error("Location name cannot be empty.");
    }
    updates.name = trimmed;
  }

  if (input.address !== undefined) {
    updates.address = input.address?.trim() || null;
  }

  if (input.latitude !== undefined) {
    updates.latitude = input.latitude !== null ? String(input.latitude) : null;
  }

  if (input.longitude !== undefined) {
    updates.longitude =
      input.longitude !== null ? String(input.longitude) : null;
  }

  if (input.radiusMeters !== undefined) {
    updates.radiusMeters = input.radiusMeters;
  }

  if (input.isActive !== undefined) {
    updates.isActive = input.isActive;
  }

  const [updated] = await db
    .update(activityLocations)
    .set(updates)
    .where(eq(activityLocations.id, id))
    .returning();

  if (!updated) {
    throw new Error("Failed to update activity location.");
  }

  return updated;
}

export async function toggleLocationStatus(
  id: string,
  isActive: boolean,
  sessionOverride?: UserSession,
): Promise<ActivityLocation> {
  return updateActivityLocation(id, { isActive }, sessionOverride);
}

export async function deleteActivityLocation(
  id: string,
  sessionOverride?: UserSession,
): Promise<void> {
  await requirePermission(
    PERMISSIONS.ACTIVITIES_LOCATIONS_MANAGE,
    sessionOverride,
  );

  await db.delete(activityLocations).where(eq(activityLocations.id, id));
}
