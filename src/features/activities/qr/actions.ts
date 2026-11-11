"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PERMISSIONS } from "@/lib/permissions";
import { createPermissionActionClient } from "@/lib/safe-action";
import { regenerateAttendanceToken } from "@/server/dal/activities/checkin";

const regenerateTokenSchema = z.object({
  activityId: z.string().uuid(),
});

export const regenerateAttendanceTokenAction = createPermissionActionClient(
  PERMISSIONS.ACTIVITIES_EVENTS_UPDATE,
)
  .inputSchema(regenerateTokenSchema)
  .action(async ({ parsedInput }) => {
    const result = await regenerateAttendanceToken(parsedInput.activityId);

    revalidatePath(`/activities/${parsedInput.activityId}/qr`);
    revalidatePath(`/activities/${parsedInput.activityId}`);
    revalidatePath("/activities");

    return {
      success: true,
      data: result,
    };
  });
