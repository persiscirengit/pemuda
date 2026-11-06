import "server-only";

import { and, desc, eq, gte, isNull, lte, or } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";
import {
  type Activity,
  activities,
  attendanceRecords,
} from "@/db/schema/activities";
import { users } from "@/db/schema/auth";
import { type MemberFeeRecord, memberFeeRecords } from "@/db/schema/finance";
import { notifications } from "@/db/schema/notifications";
import {
  departments,
  type Member,
  members,
  positions,
} from "@/db/schema/organization";
import { auth } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import {
  requirePermission,
  UnauthenticatedError,
  type UserSession,
} from "@/server/dal/auth";

export class MemberNotLinkedError extends Error {
  constructor(
    message = "Your user account is not linked to any member record.",
  ) {
    super(message);
    this.name = "MemberNotLinkedError";
  }
}

export interface MemberPortalProfile extends Member {
  departmentName?: string | null;
  positionName?: string | null;
}

export interface OpenPortalActivity extends Activity {
  alreadyCheckedIn: boolean;
  userAttendanceStatus?: string | null;
}

export interface AttendanceStatistics {
  present: number;
  excused: number;
  absent: number;
  total: number;
  percentage: number;
}

export interface FeePortalSummary {
  outstandingBalance: number;
  hasOverdue: boolean;
  unpaidCount: number;
  overdueCount: number;
}

export interface DashboardSummaryResult {
  member: MemberPortalProfile;
  openActivities: OpenPortalActivity[];
  upcomingActivities: Activity[];
  attendanceStats: AttendanceStatistics;
  feeSummary: FeePortalSummary;
}

export type PortalFeeStatus = "unpaid" | "paid" | "overdue" | "waived";

export interface PortalFeeRecord extends Omit<MemberFeeRecord, "status"> {
  status: PortalFeeStatus;
}

export interface FeeRecordsResult {
  records: PortalFeeRecord[];
  totalOutstanding: number;
  hasOverdue: boolean;
}

export function isFeeOverdue(
  year: number,
  month: number,
  status: string,
): boolean {
  if (status === "overdue") return true;
  if (status !== "unpaid") return false;
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  if (year < currentYear) return true;
  if (year === currentYear && month < currentMonth) return true;
  return false;
}

export interface UpdateMyProfileInput {
  phone?: string | null;
  address?: string | null;
  birthDate?: string | null;
  profilePhoto?: string | null;
}

/**
 * Resolves the authenticated user session and the associated member ID.
 */
export async function resolveMemberContext(
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

/**
 * Retrieves the comprehensive self-service portal dashboard summary for the authenticated member.
 */
export async function getMyDashboardSummary(
  sessionOverride?: UserSession | null,
): Promise<DashboardSummaryResult> {
  const { memberId } = await resolveMemberContext(sessionOverride);

  // 1. Fetch Member details with Department and Position
  const memberRows = await db
    .select({
      id: members.id,
      departmentId: members.departmentId,
      positionId: members.positionId,
      fullName: members.fullName,
      memberNumber: members.memberNumber,
      phone: members.phone,
      email: members.email,
      address: members.address,
      profilePhoto: members.profilePhoto,
      birthDate: members.birthDate,
      joinedAt: members.joinedAt,
      memberStatus: members.memberStatus,
      inactiveReason: members.inactiveReason,
      inactiveAt: members.inactiveAt,
      statusNotes: members.statusNotes,
      notes: members.notes,
      createdAt: members.createdAt,
      updatedAt: members.updatedAt,
      departmentName: departments.name,
      positionName: positions.name,
    })
    .from(members)
    .leftJoin(departments, eq(members.departmentId, departments.id))
    .leftJoin(positions, eq(members.positionId, positions.id))
    .where(eq(members.id, memberId))
    .limit(1);

  const member = memberRows[0] as MemberPortalProfile;
  if (!member) {
    throw new MemberNotLinkedError("Associated member record not found.");
  }

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const future14Days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const future14DaysStr = future14Days.toISOString().slice(0, 10);

  // 2. Fetch Open Activities
  const candidateActivities = await db
    .select()
    .from(activities)
    .where(
      and(
        eq(activities.attendanceEnabled, true),
        or(
          eq(activities.status, "scheduled"),
          eq(
            activities.status,
            "ongoing" as unknown as typeof activities.status,
          ),
        ),
        lte(activities.attendanceOpenAt, now),
        or(
          isNull(activities.attendanceCloseAt),
          gte(activities.attendanceCloseAt, now),
        ),
      ),
    );

  // 3. Check current member attendance for open activities
  const memberAttendance = await db
    .select()
    .from(attendanceRecords)
    .where(eq(attendanceRecords.memberId, memberId));

  const attendanceByActivityId = new Map(
    memberAttendance.map((att) => [att.activityId, att]),
  );

  const openActivities: OpenPortalActivity[] = candidateActivities.map(
    (act) => {
      const userAtt = attendanceByActivityId.get(act.id);
      return {
        ...act,
        alreadyCheckedIn: !!userAtt && userAtt.status === "present",
        userAttendanceStatus: userAtt?.status ?? null,
      };
    },
  );

  // 4. Fetch upcoming scheduled activities for the next 14 days
  const upcomingActivities = await db
    .select()
    .from(activities)
    .where(
      and(
        eq(activities.status, "scheduled"),
        gte(activities.activityDate, todayStr),
        lte(activities.activityDate, future14DaysStr),
      ),
    )
    .orderBy(activities.activityDate, activities.startTime);

  // 5. Compute personal attendance stats
  let present = 0;
  let excused = 0;
  let absent = 0;
  let total = 0;

  for (const record of memberAttendance) {
    total++;
    if (record.status === "present") present++;
    else if (record.status === "permission") excused++;
    else if (record.status === "absent") absent++;
  }

  const percentage = total > 0 ? Math.round((present / total) * 100) : 0;

  // 6. Compute fee summary
  const feeRecords = await db
    .select()
    .from(memberFeeRecords)
    .where(eq(memberFeeRecords.memberId, memberId));

  let outstandingBalance = 0;
  let unpaidCount = 0;
  let overdueCount = 0;

  for (const fee of feeRecords) {
    const rawStatus = fee.status as string;
    if (rawStatus === "unpaid" || rawStatus === "overdue") {
      outstandingBalance += Number(fee.amountIdr);
      if (isFeeOverdue(fee.year, fee.month, rawStatus)) {
        overdueCount++;
      } else {
        unpaidCount++;
      }
    }
  }

  return {
    member,
    openActivities,
    upcomingActivities,
    attendanceStats: {
      present,
      excused,
      absent,
      total,
      percentage,
    },
    feeSummary: {
      outstandingBalance,
      hasOverdue: overdueCount > 0,
      unpaidCount,
      overdueCount,
    },
  };
}

/**
 * Retrieves the authenticated member's complete fee records history.
 */
export async function getMyFeeRecords(
  sessionOverride?: UserSession | null,
): Promise<FeeRecordsResult> {
  const session = await requirePermission(
    PERMISSIONS.FINANCE_FEES_SELF,
    sessionOverride,
  );

  const { memberId } = await resolveMemberContext(session);

  const records = await db
    .select()
    .from(memberFeeRecords)
    .where(eq(memberFeeRecords.memberId, memberId))
    .orderBy(desc(memberFeeRecords.year), desc(memberFeeRecords.month));

  const portalRecords: PortalFeeRecord[] = records.map((r) => {
    const rawStatus = r.status as string;
    const overdue = isFeeOverdue(r.year, r.month, rawStatus);
    const status: PortalFeeStatus = overdue
      ? "overdue"
      : (rawStatus as PortalFeeStatus);
    return {
      ...r,
      status,
    };
  });

  let totalOutstanding = 0;
  let hasOverdue = false;

  for (const r of portalRecords) {
    if (r.status === "unpaid" || r.status === "overdue") {
      totalOutstanding += Number(r.amountIdr);
      if (r.status === "overdue") {
        hasOverdue = true;
      }
    }
  }

  return {
    records: portalRecords,
    totalOutstanding,
    hasOverdue,
  };
}

/**
 * Updates the authenticated member's contact information and clears active profile_incomplete alerts.
 */
export async function updateMyProfile(
  input: UpdateMyProfileInput,
  sessionOverride?: UserSession | null,
): Promise<Member> {
  const { session, memberId } = await resolveMemberContext(sessionOverride);

  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (input.phone !== undefined) updateData.phone = input.phone;
  if (input.address !== undefined) updateData.address = input.address;
  if (input.birthDate !== undefined) updateData.birthDate = input.birthDate;
  if (input.profilePhoto !== undefined)
    updateData.profilePhoto = input.profilePhoto;

  const updatedRows = await db
    .update(members)
    .set(updateData)
    .where(eq(members.id, memberId));

  // If profile photo updated, also sync user's image in auth table
  if (input.profilePhoto !== undefined) {
    await db
      .update(users)
      .set({
        image: input.profilePhoto,
        updatedAt: new Date(),
      })
      .where(eq(users.id, session.user.id));
  }

  // Clear active profile_incomplete notifications
  await db
    .delete(notifications)
    .where(
      and(
        eq(notifications.type, "profile_incomplete"),
        or(
          eq(notifications.memberId, memberId),
          eq(notifications.userId, session.user.id),
        ),
      ),
    );

  const updated = (
    Array.isArray(updatedRows) && updatedRows[0]
      ? updatedRows[0]
      : { id: memberId, ...updateData }
  ) as Member;

  return updated;
}
