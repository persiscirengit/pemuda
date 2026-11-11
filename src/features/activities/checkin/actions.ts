"use server";

import { revalidatePath } from "next/cache";
import { PERMISSIONS } from "@/lib/permissions";
import { createPermissionActionClient } from "@/lib/safe-action";
import {
  submitMemberCheckIn,
  submitMemberPermission,
} from "@/server/dal/activities/checkin";
import { checkInSchema, leaveRequestSchema } from "./types";

export const submitMemberCheckInAction = createPermissionActionClient(
  PERMISSIONS.ACTIVITIES_CHECKIN_SELF,
)
  .inputSchema(checkInSchema)
  .action(async ({ parsedInput }) => {
    const result = await submitMemberCheckIn(parsedInput.token, {
      latitude: parsedInput.latitude,
      longitude: parsedInput.longitude,
      locationAccuracy: parsedInput.locationAccuracy,
      method: parsedInput.method,
    });

    revalidatePath(`/attendance/check-in/${parsedInput.token}`);
    revalidatePath("/check-in");
    revalidatePath("/activities");
    revalidatePath("/");

    return {
      success: true,
      data: result,
    };
  });

export const submitMemberPermissionAction = createPermissionActionClient(
  PERMISSIONS.ACTIVITIES_CHECKIN_SELF,
)
  .inputSchema(leaveRequestSchema)
  .action(async ({ parsedInput }) => {
    const record = await submitMemberPermission(parsedInput.token, {
      reason: parsedInput.reason,
    });

    revalidatePath(`/attendance/check-in/${parsedInput.token}`);
    revalidatePath("/check-in");
    revalidatePath("/activities");
    revalidatePath("/");

    return {
      success: true,
      data: record,
    };
  });
