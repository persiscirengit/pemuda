"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { optimizeImage } from "@/lib/image";
import { authActionClient } from "@/lib/safe-action";
import { generateStorageKey, storage } from "@/lib/storage";
import { updateMyProfile } from "@/server/dal/members/portal";

const updateMyProfileSchema = z.object({
  phone: z.string().max(30).optional().nullable(),
  address: z.string().optional().nullable(),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)")
    .optional()
    .nullable(),
  profilePhoto: z.string().optional().nullable(),
  profilePhotoBase64: z.string().optional().nullable(),
});

export const updateMyProfileAction = authActionClient
  .inputSchema(updateMyProfileSchema)
  .action(async ({ parsedInput }) => {
    let photoKey = parsedInput.profilePhoto;

    if (parsedInput.profilePhotoBase64) {
      const base64Content = parsedInput.profilePhotoBase64.replace(
        /^data:image\/[a-zA-Z+]+;base64,/,
        "",
      );
      const buffer = Buffer.from(base64Content, "base64");
      const optimized = await optimizeImage(buffer, {
        maxWidth: 800,
        maxHeight: 800,
        quality: 85,
      });

      photoKey = generateStorageKey("members");
      await storage.upload(photoKey, optimized.buffer, "image/webp");
    }

    const updated = await updateMyProfile({
      phone: parsedInput.phone,
      address: parsedInput.address,
      birthDate: parsedInput.birthDate,
      profilePhoto: photoKey,
    });

    revalidatePath("/my-profile");
    revalidatePath("/profile");
    revalidatePath("/dashboard/profile");
    revalidatePath("/check-in");
    revalidatePath("/");

    return { success: true, member: updated };
  });
