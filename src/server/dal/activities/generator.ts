import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  type Activity,
  activities,
  agendaSchedules,
  agendaWeeklyTopics,
  attendanceRecords,
} from "@/db/schema/activities";
import { members } from "@/db/schema/organization";
import { PERMISSIONS } from "@/lib/permissions";
import { requirePermission, type UserSession } from "@/server/dal/auth";
import { generateAttendanceToken } from "./events";

export interface CalculatedOccurrence {
  weekNumber: number;
  date: string; // YYYY-MM-DD
  dayName: string;
  topic: string | null;
  isActive: boolean;
  isDuplicate: boolean;
}

export interface OccurrenceInput {
  weekNumber: number;
  date: string;
  topic?: string | null;
  isActive: boolean;
}

export interface GenerateMonthlyActivitiesInput {
  year: number;
  month: number; // 1 - 12
  occurrences?: OccurrenceInput[];
}

export interface MonthlyGenerationResult {
  created: number;
  skippedDuplicate: number;
  skippedInactive: number;
  participantsSynced: number;
  activities: Activity[];
}

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function getDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function formatDateString(year: number, month: number, day: number): string {
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

export function computeAttendanceWindow(
  activityDate: string,
  startTime?: string | null,
  endTime?: string | null,
): { openAt: Date; closeAt: Date } {
  // Activity date e.g. "2026-11-14"
  // If time provided e.g. "18:30" and "20:00"
  // openAt: 1 hour before start time (or at start time if before 01:00)
  // closeAt: 1 hour after end time (or at end time)
  const [sHour = 8, sMin = 0] = (startTime || "08:00").split(":").map(Number);
  const [eHour = 10, eMin = 0] = (endTime || "10:00").split(":").map(Number);

  const openHour = Math.max(0, sHour - 1);
  const closeHour = Math.min(23, eHour + 1);

  const openAt = new Date(
    `${activityDate}T${String(openHour).padStart(2, "0")}:${String(sMin).padStart(2, "0")}:00Z`,
  );
  const closeAt = new Date(
    `${activityDate}T${String(closeHour).padStart(2, "0")}:${String(eMin).padStart(2, "0")}:00Z`,
  );

  return { openAt, closeAt };
}

export async function calculateMonthlyOccurrences(
  scheduleId: string,
  year: number,
  month: number,
  sessionOverride?: UserSession,
): Promise<CalculatedOccurrence[]> {
  await requirePermission(
    PERMISSIONS.ACTIVITIES_SCHEDULES_GENERATE,
    sessionOverride,
  );

  const [schedule] = await db
    .select()
    .from(agendaSchedules)
    .where(eq(agendaSchedules.id, scheduleId))
    .limit(1);

  if (!schedule) {
    throw new Error(`Schedule with id ${scheduleId} not found.`);
  }

  if (schedule.scheduleType !== "weekly" || schedule.dayOfWeek === null) {
    throw new Error(
      "Monthly recurring activities can only be generated for weekly schedules with a defined day of week.",
    );
  }

  // Fetch weekly curriculum topics
  const topics = await db
    .select()
    .from(agendaWeeklyTopics)
    .where(eq(agendaWeeklyTopics.agendaScheduleId, scheduleId))
    .orderBy(agendaWeeklyTopics.weekNumber);

  const topicMap = new Map<number, string>();
  for (const t of topics) {
    if (t.isActive && t.topic) {
      topicMap.set(t.weekNumber, t.topic);
    }
  }

  // Fetch existing activities for this schedule to check duplicates
  const existingActivities = await db
    .select()
    .from(activities)
    .where(eq(activities.agendaScheduleId, scheduleId));

  const existingDates = new Set(existingActivities.map((a) => a.activityDate));

  const totalDays = getDaysInMonth(year, month);
  const occurrences: CalculatedOccurrence[] = [];
  let weekIndex = 1;

  for (let day = 1; day <= totalDays; day++) {
    const d = new Date(Date.UTC(year, month - 1, day));
    if (d.getUTCDay() === schedule.dayOfWeek) {
      const dateStr = formatDateString(year, month, day);
      const isDuplicate = existingDates.has(dateStr);
      const defaultTopic = topicMap.get(weekIndex) ?? null;

      occurrences.push({
        weekNumber: weekIndex,
        date: dateStr,
        dayName: DAY_NAMES[schedule.dayOfWeek] || "Unknown",
        topic: defaultTopic,
        isActive: !isDuplicate,
        isDuplicate,
      });

      weekIndex++;
    }
  }

  return occurrences;
}

export async function syncActivityParticipants(
  activityId: string,
  sessionOverride?: UserSession,
): Promise<number> {
  const session = await requirePermission(
    PERMISSIONS.ACTIVITIES_SCHEDULES_GENERATE,
    sessionOverride,
  );

  // Query all active members
  const activeMembers = await db
    .select()
    .from(members)
    .where(eq(members.memberStatus, "active"));

  if (activeMembers.length === 0) {
    return 0;
  }

  // Fetch existing attendance records for this activity to avoid duplicates
  const existingRecords = await db
    .select()
    .from(attendanceRecords)
    .where(eq(attendanceRecords.activityId, activityId));

  const existingMemberIds = new Set(existingRecords.map((r) => r.memberId));
  const newMembers = activeMembers.filter((m) => !existingMemberIds.has(m.id));

  if (newMembers.length === 0) {
    return 0;
  }

  const recordsToInsert = newMembers.map((m) => ({
    activityId,
    memberId: m.id,
    status: "absent" as const,
    attendanceMethod: "manual" as const,
    verificationStatus: "valid" as const,
    createdBy: session.user.id,
  }));

  await db.insert(attendanceRecords).values(recordsToInsert);

  return recordsToInsert.length;
}

export async function generateMonthlyActivities(
  scheduleId: string,
  input: GenerateMonthlyActivitiesInput,
  sessionOverride?: UserSession,
): Promise<MonthlyGenerationResult> {
  const session = await requirePermission(
    PERMISSIONS.ACTIVITIES_SCHEDULES_GENERATE,
    sessionOverride,
  );

  const [schedule] = await db
    .select()
    .from(agendaSchedules)
    .where(eq(agendaSchedules.id, scheduleId))
    .limit(1);

  if (!schedule) {
    throw new Error(`Schedule with id ${scheduleId} not found.`);
  }

  // Calculate occurrences if not supplied
  const targetOccurrences =
    input.occurrences ??
    (await calculateMonthlyOccurrences(
      scheduleId,
      input.year,
      input.month,
      sessionOverride,
    ));

  // Fetch existing activities for duplicate detection
  const existingActivities = await db
    .select()
    .from(activities)
    .where(eq(activities.agendaScheduleId, scheduleId));

  const existingDates = new Set(existingActivities.map((a) => a.activityDate));

  let skippedDuplicate = 0;
  let skippedInactive = 0;
  const createdActivities: Activity[] = [];
  let totalParticipantsSynced = 0;

  for (const occ of targetOccurrences) {
    if (!occ.isActive) {
      skippedInactive++;
      continue;
    }

    if (existingDates.has(occ.date)) {
      skippedDuplicate++;
      continue;
    }

    const { openAt, closeAt } = computeAttendanceWindow(
      occ.date,
      schedule.startTime,
      schedule.endTime,
    );

    const token = generateAttendanceToken();

    const [created] = await db
      .insert(activities)
      .values({
        agendaScheduleId: schedule.id,
        departmentId: schedule.departmentId,
        picId: schedule.picId,
        title: schedule.title,
        topic: occ.topic?.trim() ?? null,
        description: schedule.description,
        activityDate: occ.date,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        location: schedule.defaultLocation,
        latitude: schedule.defaultLatitude,
        longitude: schedule.defaultLongitude,
        attendanceRadius: schedule.defaultRadius ?? 100,
        status: "scheduled",
        attendanceEnabled: true,
        attendanceOpenAt: openAt,
        attendanceCloseAt: closeAt,
        attendanceToken: token,
        createdBy: session.user.id,
      })
      .returning();

    if (created) {
      createdActivities.push(created);
      existingDates.add(occ.date);

      // Pre-populate baseline attendance records for active members
      const synced = await syncActivityParticipants(
        created.id,
        sessionOverride,
      );
      totalParticipantsSynced += synced;
    }
  }

  return {
    created: createdActivities.length,
    skippedDuplicate,
    skippedInactive,
    participantsSynced: totalParticipantsSynced,
    activities: createdActivities,
  };
}
