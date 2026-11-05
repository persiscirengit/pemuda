import "server-only";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";
import {
  permissions,
  rolePermissions,
  roles,
  userRoles,
} from "@/db/schema/auth";
import { auth } from "@/lib/auth";
import { resolveUserPermissions } from "@/lib/permissions";

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized: insufficient permissions") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class UnauthenticatedError extends Error {
  constructor(message = "Unauthenticated: active session required") {
    super(message);
    this.name = "UnauthenticatedError";
  }
}

export interface UserSession {
  session: {
    id: string;
    userId: string;
    token: string;
    expiresAt: Date;
    createdAt?: Date;
    updatedAt?: Date;
    ipAddress?: string | null;
    userAgent?: string | null;
    impersonatedBy?: string | null;
  };
  user: {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    image?: string | null;
    createdAt?: Date;
    updatedAt?: Date;
    roles?: Array<{
      name: string;
      permissions: readonly string[] | string[];
    }>;
  };
}

export async function publicQuery(): Promise<void> {
  // Explicit marker for public DAL queries per ADR 003
}

export async function getUserPermissions(userId: string): Promise<string[]> {
  const records = await db
    .select({
      permissionName: permissions.name,
    })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .innerJoin(rolePermissions, eq(roles.id, rolePermissions.roleId))
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(eq(userRoles.userId, userId));

  return Array.from(new Set(records.map((r) => r.permissionName)));
}

export async function requirePermission(
  permissionKey: string,
  sessionOverride?: UserSession | null,
): Promise<UserSession> {
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

  // If roles and permissions are pre-attached (e.g. in testing fixtures or memoized sessions)
  if (resolvedSession.user.roles && resolvedSession.user.roles.length > 0) {
    const userPerms = resolveUserPermissions(resolvedSession.user.roles);
    if (!userPerms.includes(permissionKey)) {
      throw new UnauthorizedError();
    }
    return resolvedSession;
  }

  // Otherwise, query dynamic 4-table RBAC database
  const userPerms = await getUserPermissions(resolvedSession.user.id);
  if (!userPerms.includes(permissionKey)) {
    throw new UnauthorizedError();
  }

  return resolvedSession;
}
