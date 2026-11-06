import "server-only";

import crypto from "node:crypto";
import { and, desc, eq, gte, ilike, lte, or } from "drizzle-orm";
import { db } from "@/db";
import {
  type Activity,
  activities,
  agendaSchedules,
  attendanceRecords,
} from "@/db/schema/activities";
import { departments, members } from "@/db/schema/organization";
import { PERMISSIONS } from "@/lib/permissions";
import { requirePermission, type UserSession } from "@/server/dal/auth";
import { validateCoordinates } from "./locations";

export type ActivityLifecycleStatus =
  | "scheduled"
  | "completed"
  | "holiday"
  | "postponed"
  | "relocated"
  | "cancelled";

export const STATUSES_REQUIRING_REASON: ActivityLifecycleStatus[] = [
  "holiday",
  "postponed",
  "relocated",
  "cancelled",
];

export const STATUSES_DISABLING_ATTENDANCE: ActivityLifecycleStatus[] = [
  "holiday",
  "cancelled",
  "postponed",
];

export interface AttendanceSummary {
  total: number;
  present: number;
  absent: number;
  permission: number;
  needVerification: number;
}

export interface ActivityWithDetails extends Activity {
  department?: { id: string; name: string } | null;
  pic?: { id: string; fullName: string; memberNumber: string | null } | null;
  agendaSchedule?: {
    id: string;
    title: string;
    scheduleType: string;
  } | null;
  attendanceSummary?: AttendanceSummary;
}

export interface GetActivitiesParams {
  search?: string;
  departmentId?: string;
  agendaScheduleId?: string;
  status?: ActivityLifecycleStatus;
  startDate?: string;
  endDate?: string;
}

export interface CreateActivityInput {
  agendaScheduleId?: string | null;
  departmentId?: string | null;
  picId?: string | null;
  title: string;
  topic?: string | null;
  description?: string | null;
  activityDate: string; // YYYY-MM-DD
  startTime?: string | null; // HH:mm
  endTime?: string | null; // HH:mm
  location?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  attendanceRadius?: number;
  status?: ActivityLifecycleStatus;
  changeReason?: string | null;
  attendanceEnabled?: boolean;
  attendanceOpenAt?: Date | null;
  attendanceCloseAt?: Date | null;
  attendanceToken?: string | null;
}

export interface UpdateActivityInput {
  agendaScheduleId?: string | null;
  departmentId?: string | null;
  picId?: string | null;
  title?: string;
  topic?: string | null;
  description?: string | null;
  activityDate?: string;
  startTime?: string | null;
  endTime?: string | null;
  location?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  attendanceRadius?: number;
  attendanceEnabled?: boolean;
  attendanceOpenAt?: Date | null;
  attendanceCloseAt?: Date | null;
  attendanceToken?: string | null;
}

export interface UpdateActivityStatusInput {
  status: ActivityLifecycleStatus;
  changeReason?: string | null;
}

export function generateAttendanceToken(): string {
  // 48 bytes base64url encoded is exactly 64 URL-safe characters
  return crypto.randomBytes(48).toString("base64url");
}

export function validateActivityTimeRules(
  startTime?: string | null,
  endTime?: string | null,
): void {
  if (startTime && endTime) {
    if (endTime <= startTime) {
      throw new Error("End time must be after start time.");
    }
  }
}

export async function getActivities(
  params?: GetActivitiesParams,
  sessionOverride?: UserSession,
): Promise<ActivityWithDetails[]> {
  await requirePermission(PERMISSIONS.ACTIVITIES_EVENTS_READ, sessionOverride);

  const conditions = [];

  if (params?.departmentId) {
    conditions.push(eq(activities.departmentId, params.departmentId));
  }

  if (params?.agendaScheduleId) {
    conditions.push(eq(activities.agendaScheduleId, params.agendaScheduleId));
  }

  if (params?.status) {
    conditions.push(eq(activities.status, params.status));
  }

  if (params?.startDate) {
    conditions.push(gte(activities.activityDate, params.startDate));
  }

  if (params?.endDate) {
    conditions.push(lte(activities.activityDate, params.endDate));
  }

  if (params?.search && params.search.trim().length > 0) {
    const q = `%${params.search.trim()}%`;
    conditions.push(
      or(ilike(activities.title, q), ilike(activities.topic, q)),
    );
  }

  const query = db
    .select()
    .from(activities)
    .orderBy(desc(activities.activityDate), desc(activities.createdAt));

  const items =
    conditions.length > 0
      ? await query.where(and(...conditions))
      : await query;

  return items;
}

export async function getActivityById(
  id: string,
  sessionOverride?: UserSession,
): Promise<ActivityWithDetails | null> {
  await requirePermission(PERMISSIONS.ACTIVITIES_EVENTS_READ, sessionOverride);

  const [activity] = await db
    .select()
    .from(activities)
    .where(eq(activities.id, id))
    .limit(1);

  if (!activity) {
    return null;
  }

  const result: ActivityWithDetails = {
    ...activity,
  };

  if (activity.departmentId) {
    const [dept] = await db
      .select({ id: departments.id, name: departments.name })
      .from(departments)
      .where(eq(departments.id, activity.departmentId))
      .limit(1);
    result.department = dept ?? null;
  }

  if (activity.picId) {
    const [pic] = await db
      .select({
        id: members.id,
        fullName: members.fullName,
        memberNumber: members.memberNumber,
      })
      .from(members)
      .where(eq(members.id, activity.picId))
      .limit(1);
    result.pic = pic ?? null;
  }

  if (activity.agendaScheduleId) {
    const [sched] = await db
      .select({
        id: agendaSchedules.id,
        title: agendaSchedules.title,
        scheduleType: agendaSchedules.scheduleType,
      })
      .from(agendaSchedules)
      .where(eq(agendaSchedules.id, activity.agendaScheduleId))
      .limit(1);
    result.agendaSchedule = sched ?? null;
  }

  // Attendance summary
  const records = await db
    .select()
    .from(attendanceRecords)
    .where(eq(attendanceRecords.activityId, id));

  const summary: AttendanceSummary = {
    total: records.length,
    present: records.filter((r) => r.status === "present").length,
    absent: records.filter((r) => r.status === "absent").length,
    permission: records.filter((r) => r.status === "permission").length,
    needVerification: records.filter(
      (r) => r.status === "need_verification",
    ).length,
  };

  result.attendanceSummary = summary;

  return result;
}

export async function createActivity(
  input: CreateActivityInput,
  sessionOverride?: UserSession,
): Promise<Activity> {
  const session = await requirePermission(
    PERMISSIONS.ACTIVITIES_EVENTS_CREATE,
    sessionOverride,
  );

  if (!input.title || input.title.trim().length === 0) {
    throw new Error("Activity title is required.");
  }

  if (!input.activityDate || input.activityDate.trim().length === 0) {
    throw new Error("Activity date is required.");
  }

  validateActivityTimeRules(input.startTime, input.endTime);

  if (
    input.latitude !== undefined &&
    input.latitude !== null &&
    input.longitude !== undefined &&
    input.longitude !== null
  ) {
    validateCoordinates(Number(input.latitude), Number(input.longitude));
  }

  const token = input.attendanceToken || generateAttendanceToken();

  const [created] = await db
    .insert(activities)
    .values({
      agendaScheduleId: input.agendaScheduleId ?? null,
      departmentId: input.departmentId ?? null,
      picId: input.picId ?? null,
      title: input.title.trim(),
      topic: input.topic?.trim() ?? null,
      description: input.description?.trim() ?? null,
      activityDate: input.activityDate,
      startTime: input.startTime ?? null,
      endTime: input.endTime ?? null,
      location: input.location?.trim() ?? null,
      latitude:
        input.latitude !== undefined && input.latitude !== null
          ? String(input.latitude)
          : null,
      longitude:
        input.longitude !== undefined && input.longitude !== null
          ? String(input.longitude)
          : null,
      attendanceRadius: input.attendanceRadius ?? 100,
      status: input.status ?? "scheduled",
      changeReason: input.changeReason?.trim() ?? null,
      attendanceEnabled: input.attendanceEnabled ?? false,
      attendanceOpenAt: input.attendanceOpenAt ?? null,
      attendanceCloseAt: input.attendanceCloseAt ?? null,
      attendanceToken: token,
      createdBy: session.user.id,
    })
    .returning();

  return created;
}

export async function updateActivity(
  id: string,
  input: UpdateActivityInput,
  sessionOverride?: UserSession,
): Promise<Activity> {
  await requirePermission(
    PERMISSIONS.ACTIVITIES_EVENTS_UPDATE,
    sessionOverride,
  );

  validateActivityTimeRules(input.startTime, input.endTime);

  if (
    input.latitude !== undefined &&
    input.latitude !== null &&
    input.longitude !== undefined &&
    input.longitude !== null
  ) {
    validateCoordinates(Number(input.latitude), Number(input.longitude));
  }

  const updateData: Record<string, unknown> = {};

  if (input.title !== undefined) updateData.title = input.title.trim();
  if (input.topic !== undefined) updateData.topic = input.topic?.trim() ?? null;
  if (input.description !== undefined)
    updateData.description = input.description?.trim() ?? null;
  if (input.activityDate !== undefined)
    updateData.activityDate = input.activityDate;
  if (input.startTime !== undefined) updateData.startTime = input.startTime;
  if (input.endTime !== undefined) updateData.endTime = input.endTime;
  if (input.location !== undefined)
    updateData.location = input.location?.trim() ?? null;
  if (input.latitude !== undefined)
    updateData.latitude =
      input.latitude !== null ? String(input.latitude) : null;
  if (input.longitude !== undefined)
    updateData.longitude =
      input.longitude !== null ? String(input.longitude) : null;
  if (input.attendanceRadius !== undefined)
    updateData.attendanceRadius = input.attendanceRadius;
  if (input.departmentId !== undefined)
    updateData.departmentId = input.departmentId;
  if (input.picId !== undefined) updateData.picId = input.picId;
  if (input.agendaScheduleId !== undefined)
    updateData.agendaScheduleId = input.agendaScheduleId;
  if (input.attendanceEnabled !== undefined)
    updateData.attendanceEnabled = input.attendanceEnabled;
  if (input.attendanceOpenAt !== undefined)
    updateData.attendanceOpenAt = input.attendanceOpenAt;
  if (input.attendanceCloseAt !== undefined)
    updateData.attendanceCloseAt = input.attendanceCloseAt;
  if (input.attendanceToken !== undefined)
    updateData.attendanceToken = input.attendanceToken;

  const [updated] = await db
    .update(activities)
    .set(updateData)
    .where(eq(activities.id, id))
    .returning();

  if (!updated) {
    throw new Error(`Activity with id ${id} not found.`);
  }

  return updated;
}

export async function updateActivityStatus(
  id: string,
  input: UpdateActivityStatusInput,
  sessionOverride?: UserSession,
): Promise<Activity> {
  await requirePermission(
    PERMISSIONS.ACTIVITIES_EVENTS_STATUS,
    sessionOverride,
  );

  const { status, changeReason } = input;

  if (STATUSES_REQUIRING_REASON.includes(status)) {
    if (!changeReason || changeReason.trim().length === 0) {
      throw new Error(
        `A non-empty administrative reason is required for status transition to "${status}".`,
      );
    }
  }

  const updateData: Record<string, unknown> = {
    status,
    changeReason: changeReason?.trim() ?? null,
  };

  if (STATUSES_DISABLING_ATTENDANCE.includes(status)) {
    updateData.attendanceEnabled = false;
  }

  const [updated] = await db
    .update(activities)
    .set(updateData)
    .where(eq(activities.id, id))
    .returning();

  if (!updated) {
    throw new Error(`Activity with id ${id} not found.`);
  }

  return updated;
}

export async function deleteActivity(
  id: string,
  sessionOverride?: UserSession,
): Promise<void> {
  await requirePermission(
    PERMISSIONS.ACTIVITIES_EVENTS_DELETE,
    sessionOverride,
  );

  await db.delete(activities).where(eq(activities.id, id));
}
