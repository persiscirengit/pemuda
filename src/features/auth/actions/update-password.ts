"use server";

import { hashPassword, verifyPassword } from "better-auth/crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { accounts } from "@/db/schema/auth";
import { authActionClient } from "@/lib/safe-action";

const updatePasswordSchema = z
  .object({
    currentPassword: z.string().min(8),
    newPassword: z.string().min(8),
    confirmPassword: z.string().min(8),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "passwordMismatch",
    path: ["confirmPassword"],
  });

export const updatePasswordAction = authActionClient
  .inputSchema(updatePasswordSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { currentPassword, newPassword } = parsedInput;
    const userId = ctx.user.id;

    // Find credential account
    const [account] = await db
      .select()
      .from(accounts)
      .where(
        and(eq(accounts.userId, userId), eq(accounts.providerId, "credential")),
      )
      .limit(1);

    if (!account?.password) {
      throw new Error("No credential account found for this user");
    }

    const isValid = await verifyPassword({
      hash: account.password,
      password: currentPassword,
    });

    if (!isValid) {
      throw new Error("currentPasswordIncorrect");
    }

    const newHashedPassword = await hashPassword(newPassword);

    await db
      .update(accounts)
      .set({
        password: newHashedPassword,
        updatedAt: new Date(),
      })
      .where(eq(accounts.id, account.id));

    return { success: true };
  });
