import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { systemSettings } from "@/db/schema/organization";
import { PERMISSIONS } from "@/lib/permissions";
import { requirePermission, type UserSession } from "@/server/dal/auth";

export const DEFAULT_SYSTEM_SETTINGS = {
  app_name: "Pemuda Cirengit",
  organization_name: "Pemuda Persis Cirengit",
  app_logo: "",
  favicon: "",
  theme_mode: "light",
  default_attendance_radius: "100",
  default_attendance_open_minutes_before: "30",
  default_attendance_close_minutes_after: "30",
  default_location_accuracy_tolerance: "50",
  whatsapp_group_reminder_template:
    "Assalamu'alaikum Wr. Wb.\n\nMengingatkan kembali agenda *{nama_kegiatan}*:\n📌 *Topik:* {topic}\n📅 *Hari, Tanggal:* {hari_tanggal}\n⏰ *Jam Mulai:* {jam_mulai}\n📍 *Lokasi:* {lokasi}\n🔗 *Presensi:* {link_presensi}\n\nKehadiran antum sangat diharapkan. Jazakallahu khairan.",
} as const;

export type SystemSettingsCatalog = Record<
  keyof typeof DEFAULT_SYSTEM_SETTINGS | string,
  string
>;

export async function getSystemSettings(
  sessionOverride?: UserSession,
): Promise<SystemSettingsCatalog> {
  await requirePermission(
    PERMISSIONS.ORGANIZATION_SETTINGS_READ,
    sessionOverride,
  );

  const rows = await db.select().from(systemSettings);

  const result: SystemSettingsCatalog = { ...DEFAULT_SYSTEM_SETTINGS };
  for (const row of rows) {
    if (row.value !== null && row.value !== undefined) {
      result[row.key] = row.value;
    }
  }

  return result;
}

export async function updateSystemSettings(
  entries: Record<string, string>,
  sessionOverride?: UserSession,
): Promise<SystemSettingsCatalog> {
  await requirePermission(
    PERMISSIONS.ORGANIZATION_SETTINGS_MANAGE,
    sessionOverride,
  );

  for (const [key, value] of Object.entries(entries)) {
    const existing = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, key))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(systemSettings)
        .set({
          value,
          updatedAt: new Date(),
        })
        .where(eq(systemSettings.key, key));
    } else {
      await db.insert(systemSettings).values({
        key,
        value,
        type: "string",
      });
    }
  }

  return getSystemSettings(sessionOverride);
}
