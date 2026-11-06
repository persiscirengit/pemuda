import "server-only";

import { hashPassword } from "better-auth/crypto";
import { differenceInYears, format, subYears } from "date-fns";
import { and, asc, eq, ilike, lte, ne, or } from "drizzle-orm";
import { db } from "@/db";
import { accounts, roles, sessions, userRoles, users } from "@/db/schema/auth";
import {
  departments,
  type Member,
  members,
  positions,
} from "@/db/schema/organization";
import { PERMISSIONS } from "@/lib/permissions";
import { requirePermission, type UserSession } from "@/server/dal/auth";

export function calculateAge(
  birthDate: string | Date | null | undefined,
  referenceDate = new Date(),
): number | null {
  if (!birthDate) return null;
  const bDate = typeof birthDate === "string" ? new Date(birthDate) : birthDate;
  if (Number.isNaN(bDate.getTime())) return null;
  return differenceInYears(referenceDate, bDate);
}

export function isAgeLimitDue(
  birthDate: string | Date | null | undefined,
  referenceDate = new Date(),
): boolean {
  const age = calculateAge(birthDate, referenceDate);
  if (age === null) return false;
  return age >= 41;
}

export interface GetMembersParams {
  search?: string;
  departmentId?: string;
  positionId?: string;
  memberStatus?: "active" | "inactive" | "alumni" | "moved";
  ageLimitDue?: boolean;
}

export interface MemberWithDetails extends Member {
  department?: { id: string; name: string } | null;
  position?: { id: string; name: string } | null;
  user?: {
    id: string;
    email: string;
    username: string | null;
    isActive: boolean;
  } | null;
  age: number | null;
  isAgeLimitDue: boolean;
}

export interface CreateMemberInput {
  fullName: string;
  memberNumber?: string | null;
  phone?: string | null;
  email?: string | null;
  departmentId?: string | null;
  positionId?: string | null;
  address?: string | null;
  profilePhoto?: string | null;
  joinedAt?: string | null;
  birthDate?: string | null;
  memberStatus?: "active" | "inactive" | "alumni" | "moved";
  inactiveReason?:
    | "rarely_active"
    | "resigned"
    | "age_limit"
    | "transferred_to_persis"
    | "moved_domicile"
    | "other"
    | null;
  inactiveAt?: string | null;
  statusNotes?: string | null;
  notes?: string | null;
}

export interface UpdateMemberInput {
  fullName?: string;
  memberNumber?: string | null;
  phone?: string | null;
  email?: string | null;
  departmentId?: string | null;
  positionId?: string | null;
  address?: string | null;
  profilePhoto?: string | null;
  joinedAt?: string | null;
  birthDate?: string | null;
  memberStatus?: "active" | "inactive" | "alumni" | "moved";
  inactiveReason?:
    | "rarely_active"
    | "resigned"
    | "age_limit"
    | "transferred_to_persis"
    | "moved_domicile"
    | "other"
    | null;
  inactiveAt?: string | null;
  statusNotes?: string | null;
  notes?: string | null;
}

export interface ProvisionAccountInput {
  email: string;
  username?: string | null;
  password: string;
  roleIds?: string[];
}

export interface ResetPasswordInput {
  newPassword: string;
}

function validateEmail(email: string) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error("Invalid email format");
  }
}

function validatePhone(phone: string) {
  const phoneClean = phone.replace(/[\s-]/g, "");
  const phoneRegex = /^\+?[0-9]{8,20}$/;
  if (!phoneRegex.test(phoneClean)) {
    throw new Error("Invalid phone format");
  }
}

export async function getMembers(
  params?: GetMembersParams,
  sessionOverride?: UserSession | null,
): Promise<MemberWithDetails[]> {
  await requirePermission(
    PERMISSIONS.ORGANIZATION_MEMBERS_READ,
    sessionOverride,
  );

  const conditions = [];

  if (params?.search && params.search.trim().length > 0) {
    const term = `%${params.search.trim()}%`;
    conditions.push(
      or(
        ilike(members.fullName, term),
        ilike(members.memberNumber, term),
        ilike(members.phone, term),
        ilike(members.email, term),
      ),
    );
  }

  if (params?.departmentId) {
    conditions.push(eq(members.departmentId, params.departmentId));
  }

  if (params?.positionId) {
    conditions.push(eq(members.positionId, params.positionId));
  }

  if (params?.memberStatus) {
    conditions.push(eq(members.memberStatus, params.memberStatus));
  }

  if (params?.ageLimitDue) {
    const cutoffDateStr = format(subYears(new Date(), 41), "yyyy-MM-dd");
    conditions.push(
      and(
        eq(members.memberStatus, "active"),
        lte(members.birthDate, cutoffDateStr),
      ),
    );
  }

  const query = db
    .select({
      member: members,
      department: {
        id: departments.id,
        name: departments.name,
      },
      position: {
        id: positions.id,
        name: positions.name,
      },
      user: {
        id: users.id,
        email: users.email,
        username: users.username,
        isActive: users.isActive,
      },
    })
    .from(members)
    .leftJoin(departments, eq(members.departmentId, departments.id))
    .leftJoin(positions, eq(members.positionId, positions.id))
    .leftJoin(users, eq(members.id, users.memberId));

  const rows =
    conditions.length > 0
      ? await query.where(and(...conditions)).orderBy(asc(members.fullName))
      : await query.orderBy(asc(members.fullName));

  return rows.map((r) => {
    const m = r.member;
    const age = calculateAge(m.birthDate);
    const ageLimitDue = isAgeLimitDue(m.birthDate);

    return {
      ...m,
      department: r.department?.id ? r.department : null,
      position: r.position?.id ? r.position : null,
      user: r.user?.id ? r.user : null,
      age,
      isAgeLimitDue: m.memberStatus === "active" && ageLimitDue,
    };
  });
}

export async function getMemberById(
  id: string,
  sessionOverride?: UserSession | null,
): Promise<
  | (MemberWithDetails & {
      user?: {
        id: string;
        email: string;
        username: string | null;
        isActive: boolean;
        banned: boolean;
        createdAt: Date;
        roles?: Array<{ id: string; name: string; description: string | null }>;
      } | null;
    })
  | null
> {
  await requirePermission(
    PERMISSIONS.ORGANIZATION_MEMBERS_READ,
    sessionOverride,
  );

  const [row] = await db
    .select({
      member: members,
      department: {
        id: departments.id,
        name: departments.name,
      },
      position: {
        id: positions.id,
        name: positions.name,
      },
      user: {
        id: users.id,
        email: users.email,
        username: users.username,
        isActive: users.isActive,
        banned: users.banned,
        createdAt: users.createdAt,
      },
    })
    .from(members)
    .leftJoin(departments, eq(members.departmentId, departments.id))
    .leftJoin(positions, eq(members.positionId, positions.id))
    .leftJoin(users, eq(members.id, users.memberId))
    .where(eq(members.id, id))
    .limit(1);

  if (!row) return null;

  const m = row.member;
  const age = calculateAge(m.birthDate);
  const ageLimitDue = isAgeLimitDue(m.birthDate);

  let userRolesList: Array<{
    id: string;
    name: string;
    description: string | null;
  }> = [];
  if (row.user?.id) {
    const roleRows = await db
      .select({
        id: roles.id,
        name: roles.name,
        description: roles.description,
      })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, row.user.id));
    userRolesList = roleRows;
  }

  return {
    ...m,
    department: row.department?.id ? row.department : null,
    position: row.position?.id ? row.position : null,
    user: row.user?.id
      ? {
          ...row.user,
          roles: userRolesList,
        }
      : null,
    age,
    isAgeLimitDue: m.memberStatus === "active" && ageLimitDue,
  };
}

export async function createMember(
  input: CreateMemberInput,
  sessionOverride?: UserSession | null,
): Promise<Member> {
  await requirePermission(
    PERMISSIONS.ORGANIZATION_MEMBERS_CREATE,
    sessionOverride,
  );

  if (!input.fullName || input.fullName.trim().length === 0) {
    throw new Error("Full name is required");
  }

  if (input.email && input.email.trim().length > 0) {
    validateEmail(input.email.trim());
  }

  if (input.phone && input.phone.trim().length > 0) {
    validatePhone(input.phone.trim());
  }

  const memberNumber = input.memberNumber?.trim() || null;
  if (memberNumber) {
    const [existing] = await db
      .select()
      .from(members)
      .where(eq(members.memberNumber, memberNumber))
      .limit(1);

    if (existing) {
      throw new Error(`Member with NPA "${memberNumber}" already exists`);
    }
  }

  const [created] = await db
    .insert(members)
    .values({
      fullName: input.fullName.trim(),
      memberNumber,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      departmentId: input.departmentId || null,
      positionId: input.positionId || null,
      address: input.address?.trim() || null,
      profilePhoto: input.profilePhoto?.trim() || null,
      joinedAt: input.joinedAt || null,
      birthDate: input.birthDate || null,
      memberStatus: input.memberStatus || "active",
      inactiveReason: input.inactiveReason || null,
      inactiveAt: input.inactiveAt || null,
      statusNotes: input.statusNotes?.trim() || null,
      notes: input.notes?.trim() || null,
    })
    .returning();

  if (!created) {
    throw new Error("Failed to create member");
  }

  return created;
}

export async function updateMember(
  id: string,
  input: UpdateMemberInput,
  sessionOverride?: UserSession | null,
): Promise<Member> {
  await requirePermission(
    PERMISSIONS.ORGANIZATION_MEMBERS_UPDATE,
    sessionOverride,
  );

  const [current] = await db
    .select()
    .from(members)
    .where(eq(members.id, id))
    .limit(1);

  if (!current) {
    throw new Error("Member not found");
  }

  if (input.fullName !== undefined && input.fullName.trim().length === 0) {
    throw new Error("Full name cannot be empty");
  }

  if (input.email && input.email.trim().length > 0) {
    validateEmail(input.email.trim());
  }

  if (input.phone && input.phone.trim().length > 0) {
    validatePhone(input.phone.trim());
  }

  const memberNumber =
    input.memberNumber !== undefined
      ? input.memberNumber?.trim() || null
      : current.memberNumber;

  if (memberNumber && memberNumber !== current.memberNumber) {
    const [existing] = await db
      .select()
      .from(members)
      .where(and(eq(members.memberNumber, memberNumber), ne(members.id, id)))
      .limit(1);

    if (existing) {
      throw new Error(`Member with NPA "${memberNumber}" already exists`);
    }
  }

  const updateData: Partial<typeof members.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (input.fullName !== undefined) updateData.fullName = input.fullName.trim();
  if (input.memberNumber !== undefined) updateData.memberNumber = memberNumber;
  if (input.phone !== undefined) updateData.phone = input.phone?.trim() || null;
  if (input.email !== undefined) updateData.email = input.email?.trim() || null;
  if (input.departmentId !== undefined)
    updateData.departmentId = input.departmentId;
  if (input.positionId !== undefined) updateData.positionId = input.positionId;
  if (input.address !== undefined)
    updateData.address = input.address?.trim() || null;
  if (input.profilePhoto !== undefined)
    updateData.profilePhoto = input.profilePhoto?.trim() || null;
  if (input.joinedAt !== undefined) updateData.joinedAt = input.joinedAt;
  if (input.birthDate !== undefined) updateData.birthDate = input.birthDate;
  if (input.memberStatus !== undefined)
    updateData.memberStatus = input.memberStatus;
  if (input.inactiveReason !== undefined)
    updateData.inactiveReason = input.inactiveReason;
  if (input.inactiveAt !== undefined) updateData.inactiveAt = input.inactiveAt;
  if (input.statusNotes !== undefined)
    updateData.statusNotes = input.statusNotes?.trim() || null;
  if (input.notes !== undefined) updateData.notes = input.notes?.trim() || null;

  const [updated] = await db
    .update(members)
    .set(updateData)
    .where(eq(members.id, id))
    .returning();

  if (!updated) {
    throw new Error("Failed to update member");
  }

  return updated;
}

export async function deleteMember(
  id: string,
  sessionOverride?: UserSession | null,
): Promise<Member> {
  await requirePermission(
    PERMISSIONS.ORGANIZATION_MEMBERS_DELETE,
    sessionOverride,
  );

  const [deleted] = await db
    .delete(members)
    .where(eq(members.id, id))
    .returning();

  if (!deleted) {
    throw new Error("Failed to delete member");
  }

  return deleted;
}

export async function markMemberAgeLimitInactive(
  id: string,
  sessionOverride?: UserSession | null,
): Promise<Member> {
  await requirePermission(
    PERMISSIONS.ORGANIZATION_MEMBERS_UPDATE,
    sessionOverride,
  );

  const todayStr = format(new Date(), "yyyy-MM-dd");

  const [updated] = await db
    .update(members)
    .set({
      memberStatus: "inactive",
      inactiveReason: "age_limit",
      inactiveAt: todayStr,
      updatedAt: new Date(),
    })
    .where(eq(members.id, id))
    .returning();

  if (!updated) {
    throw new Error("Failed to transition member age limit status");
  }

  return updated;
}

export async function provisionMemberAccount(
  memberId: string,
  input: ProvisionAccountInput,
  sessionOverride?: UserSession | null,
) {
  await requirePermission(
    PERMISSIONS.ORGANIZATION_MEMBERS_ACCOUNTS,
    sessionOverride,
  );

  const [member] = await db
    .select()
    .from(members)
    .where(eq(members.id, memberId))
    .limit(1);

  if (!member) {
    throw new Error("Member not found");
  }

  // Check if user already linked
  const [existingUser] = await db
    .select()
    .from(users)
    .where(eq(users.memberId, memberId))
    .limit(1);

  if (existingUser) {
    throw new Error("Account already provisioned for this member");
  }

  // Check unique email
  validateEmail(input.email);
  const [existingEmail] = await db
    .select()
    .from(users)
    .where(eq(users.email, input.email.trim()))
    .limit(1);

  if (existingEmail) {
    throw new Error("Email already in use");
  }

  if (input.password.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }

  const hashedPassword = await hashPassword(input.password);

  const [newUser] = await db
    .insert(users)
    .values({
      memberId,
      name: member.fullName,
      email: input.email.trim(),
      username: input.username?.trim() || null,
      displayUsername: input.username?.trim() || null,
      emailVerified: true,
      isActive: true,
    })
    .returning();

  if (!newUser) {
    throw new Error("Failed to create user account");
  }

  await db.insert(accounts).values({
    userId: newUser.id,
    accountId: input.email.trim(),
    providerId: "credential",
    password: hashedPassword,
  });

  if (input.roleIds && input.roleIds.length > 0) {
    const userRoleValues = input.roleIds.map((roleId) => ({
      userId: newUser.id,
      roleId,
    }));
    await db.insert(userRoles).values(userRoleValues);
  }

  return newUser;
}

export async function resetMemberPassword(
  memberId: string,
  input: ResetPasswordInput,
  sessionOverride?: UserSession | null,
): Promise<{ success: boolean }> {
  await requirePermission(
    PERMISSIONS.ORGANIZATION_MEMBERS_ACCOUNTS,
    sessionOverride,
  );

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.memberId, memberId))
    .limit(1);

  if (!user) {
    throw new Error("No user account found for this member");
  }

  if (input.newPassword.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }

  const hashedPassword = await hashPassword(input.newPassword);

  const [account] = await db
    .select()
    .from(accounts)
    .where(
      and(eq(accounts.userId, user.id), eq(accounts.providerId, "credential")),
    )
    .limit(1);

  if (!account) {
    throw new Error("No credential account found for this user");
  }

  await db
    .update(accounts)
    .set({
      password: hashedPassword,
      updatedAt: new Date(),
    })
    .where(eq(accounts.id, account.id));

  // Invalidate active sessions
  await db.delete(sessions).where(eq(sessions.userId, user.id));

  return { success: true };
}
