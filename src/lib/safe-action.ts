import { headers } from "next/headers";
import { createSafeActionClient } from "next-safe-action";
import { auth } from "@/lib/auth";
import {
  requirePermission,
  UnauthenticatedError,
  type UserSession,
} from "@/server/dal/auth";

export const actionClient = createSafeActionClient();

export const authActionClient = actionClient.use(async ({ next }) => {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({
    headers: reqHeaders,
  });

  if (!session?.user || !session?.session) {
    throw new UnauthenticatedError(
      "Authentication required to perform this action",
    );
  }

  return next({
    ctx: {
      session: session.session,
      user: session.user,
    },
  });
});

export function createPermissionActionClient(permissionKey: string) {
  return authActionClient.use(async ({ next, ctx }) => {
    await requirePermission(permissionKey, {
      session: ctx.session as unknown as UserSession["session"],
      user: ctx.user as unknown as UserSession["user"],
    });

    return next({ ctx });
  });
}
