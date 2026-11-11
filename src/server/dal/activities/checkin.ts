import "server-only";

import { and, eq } from "drizzle-orm";
import { getDistance } from "geolib";
import { headers } from "next/headers";
import { v7 as uuidv7 } from "uuid";
import { db } from "@/db";
import {
  activities,
  type Activity,
  attendanceRecords,
  type AttendanceRecord,
} from "@/db/schema/activities";
import { users } from "@/db/schema/auth";
import { auth } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { generateAttendanceToken } from "@/server/dal/activities/events";
import {
  requirePermission,
  UnauthenticatedError,
  type UserSession,
} from "@/server/dal/auth";
import { MemberNotLinkedError } from "@/server/dal/members/portal";

// -----------------------------------------------------------------------------
// Interfaces & Types
// -----------------------------------------------------------------------------

export interface CheckInCoordinatesInput {
  latitude: number;
  longitude: number;
  locationAccuracy?: number | null;
  method?: "qr" | "link" | "manual";
}

export interface CheckInResult {
  id: string;
  activityId: string;
  memberId: string;
  status: "present" | "need_verification";
  verificationStatus: "valid" | "need_verification";
  distance: number;
  locationAccuracy?: number | null;
  checkedInAt: Date;
  activityTitle: string;
}

export interface ActivityCheckInDetails {
  id: string;
  title: string;
  topic?: string | null;
  description?: string | null;
  activityDate: string;
  startTime?: string | null;
  endTime?: string | null;
  location?: string | null;
  latitude: number | null;
  longitude: number | null;
  attendanceRadius: number;
  attendanceEnabled: boolean;
  attendanceOpenAt: Date | null;
  attendanceCloseAt: Date | null;
  attendanceToken: string | null;
  isOpen: boolean;
  windowState: "open" | "notOpen" | "closed" | "disabled";
  currentUserAttendance?: {
    status: string;
    verificationStatus: string;
    checkedInAt: Date | null;
    distance: number | null;
    notes?: string | null;
  } | null;
}

export interface LeaveRequestInput {
  reason: string;
}

// -----------------------------------------------------------------------------
// Helper: Resolve Member Context
// -----------------------------------------------------------------------------

export async function resolveCheckInMemberContext(
  sessionOverride?: UserSession | null,
): Promise<{ session: UserSession; memberId: string }> {
  let resolvedSession: UserSession | null = null;

  if (sessionOverride !== undefined) {
    resolvedSession = sessionOverride;
  } else {
    try {
      const reqHeaders = await headers();
      const currentSession = await auth.api.getSession({
        headers: reqHeaders,
      });
      if (currentSession?.session && currentSession?.user) {
        resolvedSession = currentSession as unknown as UserSession;
      }
    } catch {
      resolvedSession = null;
    }
  }

  if (!resolvedSession?.session || !resolvedSession?.user) {
    throw new UnauthenticatedError();
  }

  let memberId = (resolvedSession.user as { memberId?: string | null })
    .memberId;

  if (!memberId) {
    const userRecords = await db
      .select({ memberId: users.memberId })
      .from(users)
      .where(eq(users.id, resolvedSession.user.id))
      .limit(1);

    memberId = userRecords[0]?.memberId ?? null;
  }

  if (!memberId) {
    throw new MemberNotLinkedError();
  }

  return { session: resolvedSession, memberId };
}

// -----------------------------------------------------------------------------
// Submit Member Check-In
// -----------------------------------------------------------------------------

export async function submitMemberCheckIn(
  token: string,
  coords: CheckInCoordinatesInput,
  sessionOverride?: UserSession | null,
): Promise<CheckInResult> {
  await requirePermission(
    PERMISSIONS.ACTIVITIES_CHECKIN_SELF,
    sessionOverride ?? undefined,
  );

  const { session, memberId } = await resolveCheckInMemberContext(
    sessionOverride,
  );

  // 1. Fetch activity by attendanceToken
  const [activity] = await db
    .select()
    .from(activities)
    .where(eq(activities.attendanceToken, token))
    .limit(1);

  if (!activity || !activity.attendanceEnabled) {
    throw new Error("Invalid activity token or attendance is disabled.");
  }

  // 2. Window validation
  const now = new Date();
  if (activity.attendanceOpenAt && now < new Date(activity.attendanceOpenAt)) {
    throw new Error("Attendance window is not yet open.");
  }
  if (activity.attendanceCloseAt && now > new Date(activity.attendanceCloseAt)) {
    throw new Error("Attendance window is closed.");
  }

  // 3. Distance calculation using Geolib
  let rawDistance = 0;
  if (activity.latitude != null && activity.longitude != null) {
    const venueLat = Number(activity.latitude);
    const venueLon = Number(activity.longitude);
    rawDistance = getDistance(
      { latitude: coords.latitude, longitude: coords.longitude },
      { latitude: venueLat, longitude: venueLon },
    );
  }

  const distance = Number(rawDistance.toFixed(2));
  const isWithinRadius = distance <= activity.attendanceRadius;
  const status: "present" | "need_verification" = isWithinRadius
    ? "present"
    : "need_verification";
  const verificationStatus: "valid" | "need_verification" = isWithinRadius
    ? "valid"
    : "need_verification";

  // 4. Retry rules & upsert
  const [existingRecord] = await db
    .select()
    .from(attendanceRecords)
    .where(
      and(
        eq(attendanceRecords.activityId, activity.id),
        eq(attendanceRecords.memberId, memberId),
      ),
    )
    .limit(1);

  if (existingRecord) {
    if (
      existingRecord.status === "present" ||
      (existingRecord.status === "permission" &&
        existingRecord.verificationStatus === "valid")
    ) {
      throw new Error("Attendance has already been recorded for this activity.");
    }

    // Update existing record (e.g. was 'absent' or pending 'need_verification')
    await db
      .update(attendanceRecords)
      .set({
        status,
        attendanceMethod: coords.method ?? "link",
        checkedInAt: now,
        latitude: String(coords.latitude),
        longitude: String(coords.longitude),
        distanceFromActivity: String(distance),
        locationAccuracy:
          coords.locationAccuracy != null
            ? String(coords.locationAccuracy)
            : null,
        verificationStatus,
        updatedAt: now,
      })
      .where(eq(attendanceRecords.id, existingRecord.id));

    return {
      id: existingRecord.id,
      activityId: activity.id,
      memberId,
      status,
      verificationStatus,
      distance,
      locationAccuracy: coords.locationAccuracy ?? null,
      checkedInAt: now,
      activityTitle: activity.title,
    };
  }

  // Insert new record
  const recordId = uuidv7();
  await db.insert(attendanceRecords).values({
    id: recordId,
    activityId: activity.id,
    memberId,
    status,
    attendanceMethod: coords.method ?? "link",
    checkedInAt: now,
    latitude: String(coords.latitude),
    longitude: String(coords.longitude),
    distanceFromActivity: String(distance),
    locationAccuracy:
      coords.locationAccuracy != null ? String(coords.locationAccuracy) : null,
    verificationStatus,
    createdBy: session.user.id,
  });

  return {
    id: recordId,
    activityId: activity.id,
    memberId,
    status,
    verificationStatus,
    distance,
    locationAccuracy: coords.locationAccuracy ?? null,
    checkedInAt: now,
    activityTitle: activity.title,
  };
}

// -----------------------------------------------------------------------------
// Submit Member Permission (Absence Request)
// -----------------------------------------------------------------------------

export async function submitMemberPermission(
  token: string,
  input: LeaveRequestInput,
  sessionOverride?: UserSession | null,
): Promise<AttendanceRecord> {
  const trimmedReason = input.reason?.trim() ?? "";
  if (!trimmedReason || trimmedReason.length === 0) {
    throw new Error("Absence reason is required.");
  }
  if (trimmedReason.length > 500) {
    throw new Error("Absence reason cannot exceed 500 characters.");
  }

  await requirePermission(
    PERMISSIONS.ACTIVITIES_CHECKIN_SELF,
    sessionOverride ?? undefined,
  );

  const { session, memberId } = await resolveCheckInMemberContext(
    sessionOverride,
  );

  // 1. Fetch activity by attendanceToken
  const [activity] = await db
    .select()
    .from(activities)
    .where(eq(activities.attendanceToken, token))
    .limit(1);

  if (!activity || !activity.attendanceEnabled) {
    throw new Error("Invalid activity token or attendance is disabled.");
  }

  // 2. Window validation
  const now = new Date();
  if (activity.attendanceOpenAt && now < new Date(activity.attendanceOpenAt)) {
    throw new Error("Attendance window is not yet open.");
  }
  if (activity.attendanceCloseAt && now > new Date(activity.attendanceCloseAt)) {
    throw new Error("Attendance window is closed.");
  }

  // 3. Upsert attendance record
  const [existingRecord] = await db
    .select()
    .from(attendanceRecords)
    .where(
      and(
        eq(attendanceRecords.activityId, activity.id),
        eq(attendanceRecords.memberId, memberId),
      ),
    )
    .limit(1);

  if (existingRecord) {
    const [updated] = await db
      .update(attendanceRecords)
      .set({
        status: "permission",
        attendanceMethod: "link",
        checkedInAt: now,
        latitude: null,
        longitude: null,
        distanceFromActivity: null,
        locationAccuracy: null,
        verificationStatus: "valid",
        notes: trimmedReason,
        updatedAt: now,
      })
      .where(eq(attendanceRecords.id, existingRecord.id))
      .returning();

    if (!updated) {
      throw new Error("Failed to update attendance record.");
    }

    return updated;
  }

  const recordId = uuidv7();
  const [created] = await db
    .insert(attendanceRecords)
    .values({
      id: recordId,
      activityId: activity.id,
      memberId,
      status: "permission",
      attendanceMethod: "link",
      checkedInAt: now,
      latitude: null,
      longitude: null,
      distanceFromActivity: null,
      locationAccuracy: null,
      verificationStatus: "valid",
      notes: trimmedReason,
      createdBy: session.user.id,
    })
    .returning();

  if (!created) {
    throw new Error("Failed to create attendance record.");
  }

  return created;
}

// -----------------------------------------------------------------------------
// Get Activity By Attendance Token
// -----------------------------------------------------------------------------

export async function getActivityByAttendanceToken(
  token: string,
  sessionOverride?: UserSession | null,
): Promise<ActivityCheckInDetails | null> {
  const [activity] = await db
    .select()
    .from(activities)
    .where(eq(activities.attendanceToken, token))
    .limit(1);

  if (!activity) {
    return null;
  }

  const now = new Date();
  let windowState: "open" | "notOpen" | "closed" | "disabled" = "disabled";

  if (activity.attendanceEnabled) {
    if (activity.attendanceOpenAt && now < new Date(activity.attendanceOpenAt)) {
      windowState = "notOpen";
    } else if (
      activity.attendanceCloseAt &&
      now > new Date(activity.attendanceCloseAt)
    ) {
      windowState = "closed";
    } else {
      windowState = "open";
    }
  }

  let currentUserAttendance: ActivityCheckInDetails["currentUserAttendance"] =
    null;

  try {
    const { memberId } = await resolveCheckInMemberContext(sessionOverride);
    const [record] = await db
      .select()
      .from(attendanceRecords)
      .where(
        and(
          eq(attendanceRecords.activityId, activity.id),
          eq(attendanceRecords.memberId, memberId),
        ),
      )
      .limit(1);

    if (record) {
      currentUserAttendance = {
        status: record.status,
        verificationStatus: record.verificationStatus,
        checkedInAt: record.checkedInAt,
        distance:
          record.distanceFromActivity != null
            ? Number(record.distanceFromActivity)
            : null,
        notes: record.notes,
      };
    }
  } catch {
    // If unauthenticated or unlinked, leave currentUserAttendance null
  }

  return {
    id: activity.id,
    title: activity.title,
    topic: activity.topic,
    description: activity.description,
    activityDate: activity.activityDate,
    startTime: activity.startTime,
    endTime: activity.endTime,
    location: activity.location,
    latitude: activity.latitude != null ? Number(activity.latitude) : null,
    longitude: activity.longitude != null ? Number(activity.longitude) : null,
    attendanceRadius: activity.attendanceRadius,
    attendanceEnabled: activity.attendanceEnabled,
    attendanceOpenAt: activity.attendanceOpenAt,
    attendanceCloseAt: activity.attendanceCloseAt,
    attendanceToken: activity.attendanceToken,
    isOpen: windowState === "open",
    windowState,
    currentUserAttendance,
  };
}

// -----------------------------------------------------------------------------
// Regenerate Attendance Token
// -----------------------------------------------------------------------------

export async function regenerateAttendanceToken(
  activityId: string,
  sessionOverride?: UserSession | null,
): Promise<{ activityId: string; attendanceToken: string }> {
  await requirePermission(
    PERMISSIONS.ACTIVITIES_EVENTS_UPDATE,
    sessionOverride ?? undefined,
  );

  const newToken = generateAttendanceToken();

  await db
    .update(activities)
    .set({
      attendanceToken: newToken,
      updatedAt: new Date(),
    })
    .where(eq(activities.id, activityId));

  return {
    activityId,
    attendanceToken: newToken,
  };
}
