"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { optimizeImage } from "@/lib/image";
import { PERMISSIONS } from "@/lib/permissions";
import { createPermissionActionClient } from "@/lib/safe-action";
import { generateStorageKey, storage } from "@/lib/storage";
import {
  getSystemSettings,
  updateSystemSettings,
} from "@/server/dal/organization/settings";

const updateSettingsSchema = z.record(z.string(), z.string());

const uploadSettingAssetSchema = z.object({
  key: z.enum(["app_logo", "favicon"]),
  fileData: z.string().min(1, "File data is required"),
});

const manageClient = createPermissionActionClient(
  PERMISSIONS.ORGANIZATION_SETTINGS_MANAGE,
);

export const updateSettingsAction = manageClient
  .inputSchema(updateSettingsSchema)
  .action(async ({ parsedInput }) => {
    const settings = await updateSystemSettings(parsedInput);
    revalidatePath("/settings");
    return { settings };
  });

export const uploadSettingAssetAction = manageClient
  .inputSchema(uploadSettingAssetSchema)
  .action(async ({ parsedInput }) => {
    const { key, fileData } = parsedInput;

    const base64Content = fileData.replace(
      /^data:image\/[a-zA-Z+]+;base64,/,
      "",
    );
    const buffer = Buffer.from(base64Content, "base64");

    const maxWidth = key === "favicon" ? 128 : 512;
    const maxHeight = key === "favicon" ? 128 : 512;

    const optimized = await optimizeImage(buffer, {
      maxWidth,
      maxHeight,
      quality: 85,
    });

    const storageKey = generateStorageKey("system");
    await storage.upload(storageKey, optimized.buffer, "image/webp");

    const currentSettings = await getSystemSettings();
    const oldKey = currentSettings[key];
    if (oldKey?.startsWith("uploads/system/")) {
      try {
        await storage.delete(oldKey);
      } catch {
        // Ignore deletion errors for missing legacy assets
      }
    }

    const settings = await updateSystemSettings({
      [key]: storageKey,
    });

    revalidatePath("/settings");
    return { settings, key: storageKey };
  });
