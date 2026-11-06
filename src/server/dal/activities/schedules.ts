import "server-only";

import { and, desc, eq, ilike } from "drizzle-orm";
import { db } from "@/db";
import {
  type AgendaSchedule,
  type AgendaWeeklyTopic,
  activityLocations,
  agendaSchedules,
  agendaWeeklyTopics,
} from "@/db/schema/activities";
import { departments, members } from "@/db/schema/organization";
import { PERMISSIONS } from "@/lib/permissions";
import { requirePermission, type UserSession } from "@/server/dal/auth";
import { validateCoordinates } from "./locations";

export type ScheduleType = "incidental" | "weekly" | "monthly" | "yearly";

export interface GetAgendaSchedulesParams {
  scheduleType?: ScheduleType;
  departmentId?: string;
  isActive?: boolean;
  search?: string;
}

export interface CreateAgendaScheduleInput {
  title: string;
  description?: string | null;
  scheduleType: ScheduleType;
  departmentId?: string | null;
  picId?: string | null;
  activityLocationId?: string | null;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  specificDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  defaultLocation?: string | null;
  defaultLatitude?: number | string | null;
  defaultLongitude?: number | string | null;
  defaultRadius?: number;
  isActive?: boolean;
}

export interface UpdateAgendaScheduleInput {
  title?: string;
  description?: string | null;
  scheduleType?: ScheduleType;
  departmentId?: string | null;
  picId?: string | null;
  activityLocationId?: string | null;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  specificDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  defaultLocation?: string | null;
  defaultLatitude?: number | string | null;
  defaultLongitude?: number | string | null;
  defaultRadius?: number;
  isActive?: boolean;
}

export interface WeeklyTopicInput {
  weekNumber: number;
  topic?: string | null;
  isActive?: boolean;
}

export interface AgendaScheduleWithDetails extends AgendaSchedule {
  department?: { id: string; name: string } | null;
  pic?: { id: string; fullName: string; memberNumber: string | null } | null;
  activityLocation?: {
    id: string;
    name: string;
    address: string | null;
  } | null;
  weeklyTopics?: AgendaWeeklyTopic[];
}

export function validateScheduleRules(
  scheduleType: ScheduleType,
  dayOfWeek?: number | null,
  dayOfMonth?: number | null,
  specificDate?: string | null,
  startTime?: string | null,
  endTime?: string | null,
): void {
  if (scheduleType === "weekly") {
    if (
      dayOfWeek === undefined ||
      dayOfWeek === null ||
      dayOfWeek < 0 ||
      dayOfWeek > 6
    ) {
      throw new Error(
        "Weekly schedules require a valid day of week between 0 (Sunday) and 6 (Saturday).",
      );
    }
  }

  if (scheduleType === "monthly") {
    if (
      dayOfMonth === undefined ||
      dayOfMonth === null ||
      dayOfMonth < 1 ||
      dayOfMonth > 31
    ) {
      throw new Error(
        "Monthly schedules require a valid day of month between 1 and 31.",
      );
    }
  }

  if (scheduleType === "incidental") {
    if (!specificDate || specificDate.trim().length === 0) {
      throw new Error("Incidental schedules require a specific date.");
    }
  }

  if (startTime && endTime) {
    // Basic time format comparison (e.g. "08:00" vs "10:00")
    if (endTime <= startTime) {
      throw new Error("End time must be after start time.");
    }
  }
}

export async function getAgendaSchedules(
  params?: GetAgendaSchedulesParams,
  sessionOverride?: UserSession,
): Promise<AgendaSchedule[]> {
  await requirePermission(
    PERMISSIONS.ACTIVITIES_SCHEDULES_READ,
    sessionOverride,
  );

  const conditions = [];

  if (params?.scheduleType) {
    conditions.push(eq(agendaSchedules.scheduleType, params.scheduleType));
  }

  if (params?.departmentId) {
    conditions.push(eq(agendaSchedules.departmentId, params.departmentId));
  }

  if (params?.isActive !== undefined) {
    conditions.push(eq(agendaSchedules.isActive, params.isActive));
  }

  if (params?.search && params.search.trim().length > 0) {
    conditions.push(ilike(agendaSchedules.title, `%${params.search.trim()}%`));
  }

  const query = db
    .select()
    .from(agendaSchedules)
    .orderBy(desc(agendaSchedules.createdAt));

  if (conditions.length > 0) {
    return query.where(and(...conditions));
  }

  return query;
}

export async function getAgendaScheduleById(
  id: string,
  sessionOverride?: UserSession,
): Promise<AgendaScheduleWithDetails | null> {
  await requirePermission(
    PERMISSIONS.ACTIVITIES_SCHEDULES_READ,
    sessionOverride,
  );

  const [schedule] = await db
    .select()
    .from(agendaSchedules)
    .where(eq(agendaSchedules.id, id))
    .limit(1);

  if (!schedule) {
    return null;
  }

  const result: AgendaScheduleWithDetails = {
    ...schedule,
  };

  // Fetch linked weekly topics
  const topics = await db
    .select()
    .from(agendaWeeklyTopics)
    .where(eq(agendaWeeklyTopics.agendaScheduleId, id))
    .orderBy(agendaWeeklyTopics.weekNumber);

  result.weeklyTopics = topics;

  // Fetch optional department details
  if (schedule.departmentId) {
    const [dept] = await db
      .select({
        id: departments.id,
        name: departments.name,
      })
      .from(departments)
      .where(eq(departments.id, schedule.departmentId))
      .limit(1);
    result.department = dept ?? null;
  }

  // Fetch optional PIC details
  if (schedule.picId) {
    const [pic] = await db
      .select({
        id: members.id,
        fullName: members.fullName,
        memberNumber: members.memberNumber,
      })
      .from(members)
      .where(eq(members.id, schedule.picId))
      .limit(1);
    result.pic = pic ?? null;
  }

  // Fetch optional location details
  if (schedule.activityLocationId) {
    const [loc] = await db
      .select({
        id: activityLocations.id,
        name: activityLocations.name,
        address: activityLocations.address,
      })
      .from(activityLocations)
      .where(eq(activityLocations.id, schedule.activityLocationId))
      .limit(1);
    result.activityLocation = loc ?? null;
  }

  return result;
}

export async function createAgendaSchedule(
  input: CreateAgendaScheduleInput,
  sessionOverride?: UserSession,
): Promise<AgendaSchedule> {
  const session = await requirePermission(
    PERMISSIONS.ACTIVITIES_SCHEDULES_MANAGE,
    sessionOverride,
  );

  const trimmedTitle = input.title.trim();
  if (!trimmedTitle) {
    throw new Error("Schedule title is required.");
  }

  validateScheduleRules(
    input.scheduleType,
    input.dayOfWeek,
    input.dayOfMonth,
    input.specificDate,
    input.startTime,
    input.endTime,
  );

  validateCoordinates(
    input.defaultLatitude,
    input.defaultLongitude,
    input.defaultRadius,
  );

  const [created] = await db
    .insert(agendaSchedules)
    .values({
      title: trimmedTitle,
      description: input.description?.trim() || null,
      scheduleType: input.scheduleType,
      departmentId: input.departmentId ?? null,
      picId: input.picId ?? null,
      activityLocationId: input.activityLocationId ?? null,
      dayOfWeek: input.dayOfWeek ?? null,
      dayOfMonth: input.dayOfMonth ?? null,
      specificDate: input.specificDate ?? null,
      startTime: input.startTime ?? null,
      endTime: input.endTime ?? null,
      defaultLocation: input.defaultLocation?.trim() || null,
      defaultLatitude:
        input.defaultLatitude !== undefined && input.defaultLatitude !== null
          ? String(input.defaultLatitude)
          : null,
      defaultLongitude:
        input.defaultLongitude !== undefined && input.defaultLongitude !== null
          ? String(input.defaultLongitude)
          : null,
      defaultRadius: input.defaultRadius ?? 100,
      isActive: input.isActive ?? true,
      createdBy: session.user.id,
    })
    .returning();

  if (!created) {
    throw new Error("Failed to create agenda schedule.");
  }

  return created;
}

export async function updateAgendaSchedule(
  id: string,
  input: UpdateAgendaScheduleInput,
  sessionOverride?: UserSession,
): Promise<AgendaSchedule> {
  await requirePermission(
    PERMISSIONS.ACTIVITIES_SCHEDULES_MANAGE,
    sessionOverride,
  );

  const existing = await getAgendaScheduleById(id, sessionOverride);
  if (!existing) {
    throw new Error(`Schedule with id "${id}" not found.`);
  }

  const effectiveType = input.scheduleType ?? existing.scheduleType;
  const effectiveDayOfWeek =
    input.dayOfWeek !== undefined ? input.dayOfWeek : existing.dayOfWeek;
  const effectiveDayOfMonth =
    input.dayOfMonth !== undefined ? input.dayOfMonth : existing.dayOfMonth;
  const effectiveDate =
    input.specificDate !== undefined
      ? input.specificDate
      : existing.specificDate;
  const effectiveStartTime =
    input.startTime !== undefined ? input.startTime : existing.startTime;
  const effectiveEndTime =
    input.endTime !== undefined ? input.endTime : existing.endTime;

  validateScheduleRules(
    effectiveType,
    effectiveDayOfWeek,
    effectiveDayOfMonth,
    effectiveDate,
    effectiveStartTime,
    effectiveEndTime,
  );

  validateCoordinates(
    input.defaultLatitude,
    input.defaultLongitude,
    input.defaultRadius,
  );

  const updates: Partial<typeof agendaSchedules.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (input.title !== undefined) {
    const trimmed = input.title.trim();
    if (!trimmed) {
      throw new Error("Schedule title cannot be empty.");
    }
    updates.title = trimmed;
  }

  if (input.description !== undefined) {
    updates.description = input.description?.trim() || null;
  }

  if (input.scheduleType !== undefined) {
    updates.scheduleType = input.scheduleType;
  }

  if (input.departmentId !== undefined) {
    updates.departmentId = input.departmentId;
  }

  if (input.picId !== undefined) {
    updates.picId = input.picId;
  }

  if (input.activityLocationId !== undefined) {
    updates.activityLocationId = input.activityLocationId;
  }

  if (input.dayOfWeek !== undefined) {
    updates.dayOfWeek = input.dayOfWeek;
  }

  if (input.dayOfMonth !== undefined) {
    updates.dayOfMonth = input.dayOfMonth;
  }

  if (input.specificDate !== undefined) {
    updates.specificDate = input.specificDate;
  }

  if (input.startTime !== undefined) {
    updates.startTime = input.startTime;
  }

  if (input.endTime !== undefined) {
    updates.endTime = input.endTime;
  }

  if (input.defaultLocation !== undefined) {
    updates.defaultLocation = input.defaultLocation?.trim() || null;
  }

  if (input.defaultLatitude !== undefined) {
    updates.defaultLatitude =
      input.defaultLatitude !== null ? String(input.defaultLatitude) : null;
  }

  if (input.defaultLongitude !== undefined) {
    updates.defaultLongitude =
      input.defaultLongitude !== null ? String(input.defaultLongitude) : null;
  }

  if (input.defaultRadius !== undefined) {
    updates.defaultRadius = input.defaultRadius;
  }

  if (input.isActive !== undefined) {
    updates.isActive = input.isActive;
  }

  const [updated] = await db
    .update(agendaSchedules)
    .set(updates)
    .where(eq(agendaSchedules.id, id))
    .returning();

  if (!updated) {
    throw new Error("Failed to update agenda schedule.");
  }

  return updated;
}

export async function toggleScheduleStatus(
  id: string,
  isActive: boolean,
  sessionOverride?: UserSession,
): Promise<AgendaSchedule> {
  return updateAgendaSchedule(id, { isActive }, sessionOverride);
}

export async function deleteAgendaSchedule(
  id: string,
  sessionOverride?: UserSession,
): Promise<void> {
  await requirePermission(
    PERMISSIONS.ACTIVITIES_SCHEDULES_MANAGE,
    sessionOverride,
  );

  await db.delete(agendaSchedules).where(eq(agendaSchedules.id, id));
}

export async function getWeeklyTopics(
  scheduleId: string,
  sessionOverride?: UserSession,
): Promise<AgendaWeeklyTopic[]> {
  await requirePermission(
    PERMISSIONS.ACTIVITIES_SCHEDULES_READ,
    sessionOverride,
  );

  return db
    .select()
    .from(agendaWeeklyTopics)
    .where(eq(agendaWeeklyTopics.agendaScheduleId, scheduleId))
    .orderBy(agendaWeeklyTopics.weekNumber);
}

export async function updateWeeklyTopics(
  scheduleId: string,
  topics: WeeklyTopicInput[],
  sessionOverride?: UserSession,
): Promise<AgendaWeeklyTopic[]> {
  await requirePermission(
    PERMISSIONS.ACTIVITIES_SCHEDULES_MANAGE,
    sessionOverride,
  );

  const seenWeeks = new Set<number>();
  for (const item of topics) {
    if (item.weekNumber < 1 || item.weekNumber > 5) {
      throw new Error(
        `Invalid week number ${item.weekNumber}: Week number must be between 1 and 5.`,
      );
    }
    if (seenWeeks.has(item.weekNumber)) {
      throw new Error(
        `Duplicate week number ${item.weekNumber} provided for schedule.`,
      );
    }
    seenWeeks.add(item.weekNumber);
  }

  // Upsert each weekly topic slot
  for (const item of topics) {
    const existing = await db
      .select()
      .from(agendaWeeklyTopics)
      .where(
        and(
          eq(agendaWeeklyTopics.agendaScheduleId, scheduleId),
          eq(agendaWeeklyTopics.weekNumber, item.weekNumber),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(agendaWeeklyTopics)
        .set({
          topic: item.topic?.trim() || null,
          isActive: item.isActive ?? true,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(agendaWeeklyTopics.agendaScheduleId, scheduleId),
            eq(agendaWeeklyTopics.weekNumber, item.weekNumber),
          ),
        );
    } else {
      await db.insert(agendaWeeklyTopics).values({
        agendaScheduleId: scheduleId,
        weekNumber: item.weekNumber,
        topic: item.topic?.trim() || null,
        isActive: item.isActive ?? true,
      });
    }
  }

  return getWeeklyTopics(scheduleId, sessionOverride);
}
