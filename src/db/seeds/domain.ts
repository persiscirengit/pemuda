/* cspell:disable */
import { db as defaultDb } from "@/db";
import { articleCategories } from "@/db/schema/content";
import {
  financialCategories,
  membershipFeeSettings,
} from "@/db/schema/finance";
import {
  departments,
  positions,
  systemSettings,
} from "@/db/schema/organization";

export async function seedDomain(db = defaultDb) {
  console.log("🌱 Seeding organization departments...");
  const starterDepartments = [
    {
      name: "Pendidikan",
      description: "Bidang Pendidikan dan Pengembangan Keilmuan",
      status: "active" as const,
    },
    {
      name: "Dakwah",
      description: "Bidang Dakwah dan Kajian Islam",
      status: "active" as const,
    },
    {
      name: "Kaderisasi",
      description: "Bidang Kaderisasi dan Pembinaan Anggota",
      status: "active" as const,
    },
    {
      name: "Sosial",
      description: "Bidang Sosial, Kemasyarakatan dan Kepedulian Umat",
      status: "active" as const,
    },
    {
      name: "Ekonomi",
      description: "Bidang Pemberdayaan Ekonomi dan Kewirausahaan",
      status: "active" as const,
    },
    {
      name: "Publikasi",
      description: "Bidang Publikasi, Media, dan Dokumentasi",
      status: "active" as const,
    },
    {
      name: "Olahraga",
      description: "Bidang Olahraga, Kesehatan, dan Kebugaran",
      status: "active" as const,
    },
    {
      name: "Urusan Rumah Tangga",
      description: "Bidang Pengelolaan Fasilitas dan Rumah Tangga Organisasi",
      status: "active" as const,
    },
  ];

  for (const dept of starterDepartments) {
    await db
      .insert(departments)
      .values(dept)
      .onConflictDoNothing({ target: departments.name });
  }

  console.log("🌱 Seeding organization positions...");
  const starterPositions = [
    {
      name: "Ketua",
      description: "Ketua Pimpinan Cabang Pemuda Persis",
      status: "active" as const,
    },
    {
      name: "Wakil Ketua",
      description: "Wakil Ketua Pimpinan Cabang Pemuda Persis",
      status: "active" as const,
    },
    {
      name: "Sekretaris",
      description: "Sekretaris Organisasi",
      status: "active" as const,
    },
    {
      name: "Bendahara",
      description: "Bendahara Keuangan Organisasi",
      status: "active" as const,
    },
    {
      name: "Ketua Bidang",
      description: "Koordinator / Pimpinan Bidang Kerja",
      status: "active" as const,
    },
    {
      name: "Anggota Bidang",
      description: "Staf Pelaksana Bidang Kerja",
      status: "active" as const,
    },
    {
      name: "Anggota",
      description: "Anggota Reguler Pemuda Persis",
      status: "active" as const,
    },
  ];

  for (const pos of starterPositions) {
    await db
      .insert(positions)
      .values(pos)
      .onConflictDoNothing({ target: positions.name });
  }

  console.log("🌱 Seeding system settings catalog...");
  const defaultSettings = [
    {
      key: "app_name",
      value: "Pemuda Cirengit",
      type: "string",
    },
    {
      key: "organization_name",
      value: "Pemuda Persis Cirengit",
      type: "string",
    },
    {
      key: "theme_mode",
      value: "light",
      type: "string",
    },
    {
      key: "default_attendance_radius",
      value: "100",
      type: "number",
    },
    {
      key: "default_attendance_open_minutes_before",
      value: "30",
      type: "number",
    },
    {
      key: "default_attendance_close_minutes_after",
      value: "30",
      type: "number",
    },
    {
      key: "default_location_accuracy_tolerance",
      value: "50",
      type: "number",
    },
    {
      key: "whatsapp_group_reminder_template",
      value:
        "Assalamu'alaikum Wr. Wb.\n\nMengingatkan kembali agenda *{activity_title}*:\n📅 *Tanggal:* {activity_date}\n⏰ *Waktu:* {activity_time}\n📍 *Tempat:* {activity_location}\n\nKehadiran antum sangat diharapkan. Jazakallahu khairan.",
      type: "string",
    },
  ];

  for (const setting of defaultSettings) {
    await db
      .insert(systemSettings)
      .values(setting)
      .onConflictDoNothing({ target: systemSettings.key });
  }

  console.log("🌱 Seeding default membership fee settings...");
  const existingFeeSettings = await db
    .select()
    .from(membershipFeeSettings)
    .limit(1);

  if (existingFeeSettings.length === 0) {
    await db.insert(membershipFeeSettings).values({
      name: "Monthly Membership Fee",
      defaultAmountIdr: 10000,
      effectiveFrom: new Date().toISOString().slice(0, 10),
      isActive: true,
    });
  }

  console.log("🌱 Seeding starter financial categories...");
  const starterFinancialCategories = [
    {
      name: "Iuran Anggota",
      slug: "income-iuran-anggota",
      type: "income" as const,
      description: "Pemasukan rutin dari iuran anggota.",
      sortOrder: 1,
    },
    {
      name: "Donasi",
      slug: "income-donasi",
      type: "income" as const,
      description: "Donasi umum untuk kas organisasi.",
      sortOrder: 2,
    },
    {
      name: "Infaq",
      slug: "income-infaq",
      type: "income" as const,
      description: "Infaq dari anggota atau simpatisan.",
      sortOrder: 3,
    },
    {
      name: "Kas Kegiatan",
      slug: "income-kas-kegiatan",
      type: "income" as const,
      description: "Pemasukan khusus kegiatan.",
      sortOrder: 4,
    },
    {
      name: "Sponsor",
      slug: "income-sponsor",
      type: "income" as const,
      description: "Dukungan sponsor kegiatan.",
      sortOrder: 5,
    },
    {
      name: "Lain-lain",
      slug: "income-lain-lain",
      type: "income" as const,
      description: "Pemasukan lain di luar kategori utama.",
      sortOrder: 6,
    },
    {
      name: "Konsumsi",
      slug: "expense-konsumsi",
      type: "expense" as const,
      description: "Pengeluaran konsumsi kegiatan.",
      sortOrder: 7,
    },
    {
      name: "Operasional",
      slug: "expense-operasional",
      type: "expense" as const,
      description: "Pengeluaran operasional organisasi.",
      sortOrder: 8,
    },
    {
      name: "Kegiatan",
      slug: "expense-kegiatan",
      type: "expense" as const,
      description: "Pengeluaran pelaksanaan kegiatan.",
      sortOrder: 9,
    },
    {
      name: "Transport",
      slug: "expense-transport",
      type: "expense" as const,
      description: "Pengeluaran transportasi.",
      sortOrder: 10,
    },
    {
      name: "Sosial",
      slug: "expense-sosial",
      type: "expense" as const,
      description: "Pengeluaran sosial dan santunan.",
      sortOrder: 11,
    },
    {
      name: "Perlengkapan",
      slug: "expense-perlengkapan",
      type: "expense" as const,
      description: "Pengeluaran perlengkapan organisasi.",
      sortOrder: 12,
    },
    {
      name: "Dokumentasi",
      slug: "expense-dokumentasi",
      type: "expense" as const,
      description: "Pengeluaran dokumentasi kegiatan.",
      sortOrder: 13,
    },
    {
      name: "Lain-lain",
      slug: "expense-lain-lain",
      type: "expense" as const,
      description: "Pengeluaran lain di luar kategori utama.",
      sortOrder: 14,
    },
  ];

  for (const cat of starterFinancialCategories) {
    await db
      .insert(financialCategories)
      .values(cat)
      .onConflictDoNothing({ target: financialCategories.slug });
  }

  console.log("🌱 Seeding starter article categories...");
  const starterArticleCategories = [
    { name: "Kajian", slug: "kajian", sortOrder: 1 },
    { name: "Umum", slug: "umum", sortOrder: 2 },
    { name: "Pendidikan", slug: "pendidikan", sortOrder: 3 },
    { name: "Organisasi", slug: "organisasi", sortOrder: 4 },
    { name: "Kepemudaan", slug: "kepemudaan", sortOrder: 5 },
    { name: "Pengumuman", slug: "pengumuman", sortOrder: 6 },
    { name: "Aqidah", slug: "aqidah", sortOrder: 7 },
    { name: "Fiqih", slug: "fiqih", sortOrder: 8 },
    { name: "Akhlak", slug: "akhlak", sortOrder: 9 },
    { name: "Sirah", slug: "sirah", sortOrder: 10 },
    { name: "Pemikiran Islam", slug: "pemikiran-islam", sortOrder: 11 },
    { name: "Kajian Umum", slug: "kajian-umum", sortOrder: 12 },
  ];

  for (const cat of starterArticleCategories) {
    await db
      .insert(articleCategories)
      .values({ ...cat, isActive: true })
      .onConflictDoNothing({ target: articleCategories.slug });
  }

  console.log("✅ Domain system seeding complete.");
}

// Direct execution entrypoint
if (process.argv[1]?.includes("domain.ts")) {
  seedDomain()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("❌ Domain seeding failed:", err);
      process.exit(1);
    });
}
