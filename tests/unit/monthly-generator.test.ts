import fs from "node:fs";
import path from "node:path";
import { getTableName } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

interface MockSchedule {
  id: string;
  departmentId: string | null;
  picId: string | null;
  title: string;
  description: string | null;
  scheduleType: "weekly" | "monthly" | "incidental" | "yearly";
  dayOfWeek: number | null;
  startTime: string | null;
  endTime: string | null;
  defaultLocation: string | null;
  defaultLatitude: string | null;
  defaultLongitude: string | null;
  defaultRadius: number;
  isActive: boolean;
}

interface MockWeeklyTopic {
  id: string;
  agendaScheduleId: string;
  weekNumber: number;
  topic: string | null;
  isActive: boolean;
}

interface MockActivity {
  id: string;
  agendaScheduleId: string | null;
  departmentId: string | null;
  picId: string | null;
  title: string;
  topic: string | null;
  description: string | null;
  activityDate: string;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  latitude: string | null;
  longitude: string | null;
  attendanceRadius: number;
  status: string;
  attendanceEnabled: boolean;
  attendanceOpenAt: Date | null;
  attendanceCloseAt: Date | null;
  attendanceToken: string | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface MockMember {
  id: string;
  fullName: string;
  memberStatus: "active" | "inactive" | "alumni" | "moved";
}

interface MockAttendanceRecord {
  id: string;
  activityId: string;
  memberId: string;
  status: "present" | "permission" | "absent" | "need_verification";
  attendanceMethod: "qr" | "link" | "manual";
  verificationStatus: "valid" | "need_verification" | "rejected";
}

interface ChunkObject {
  name?: string;
  value?: unknown;
  queryChunks?: unknown[];
}

const {
  mockSchedules,
  mockWeeklyTopics,
  mockActivities,
  mockMembers,
  mockAttendanceRecords,
} = vi.hoisted(() => ({
  mockSchedules: [] as MockSchedule[],
  mockWeeklyTopics: [] as MockWeeklyTopic[],
  mockActivities: [] as MockActivity[],
  mockMembers: [] as MockMember[],
  mockAttendanceRecords: [] as MockAttendanceRecord[],
}));

function flattenChunks(chunks: unknown[]): unknown[] {
  let res: unknown[] = [];
  for (const c of chunks) {
    const chunk = c as ChunkObject;
    if (chunk?.queryChunks) {
      res = res.concat(flattenChunks(chunk.queryChunks));
    } else {
      res.push(c);
    }
  }
  return res;
}

function getChunkValue(c: unknown): unknown {
  if (!c) return c;
  if (typeof c === "string") return c;
  const obj = c as ChunkObject;
  if (typeof obj.name === "string") return obj.name;
  if ("value" in obj) {
    if (Array.isArray(obj.value)) return obj.value[0];
    return obj.value;
  }
  return c;
}

vi.mock("@/db", () => {
  return {
    db: {
      select: () => ({
        from: (table: unknown) => {
          let tableName = "";
          try {
            tableName = getTableName(
              table as Parameters<typeof getTableName>[0],
            );
          } catch {
            tableName = "";
          }

          if (tableName.includes("schedule")) {
            return {
              where: (cond: unknown) => {
                const obj = cond as ChunkObject;
                const flat = flattenChunks(obj?.queryChunks || []).map(
                  getChunkValue,
                );
                const idIdx = flat.indexOf("id");
                const targetId = idIdx !== -1 ? flat[idIdx + 2] : null;
                const sched = mockSchedules.find((s) => s.id === targetId);
                return {
                  limit: () => Promise.resolve(sched ? [sched] : []),
                };
              },
            };
          }

          if (tableName.includes("topic") || tableName.includes("weekly")) {
            return {
              where: (cond: unknown) => {
                const obj = cond as ChunkObject;
                const flat = flattenChunks(obj?.queryChunks || []).map(
                  getChunkValue,
                );
                const idIdx = flat.indexOf("agenda_schedule_id");
                const targetId = idIdx !== -1 ? flat[idIdx + 2] : null;
                const topics = mockWeeklyTopics.filter(
                  (t) => t.agendaScheduleId === targetId,
                );
                return {
                  orderBy: () => Promise.resolve(topics),
                };
              },
            };
          }

          if (tableName.includes("member")) {
            return {
              where: (cond: unknown) => {
                const obj = cond as ChunkObject;
                const flat = flattenChunks(obj?.queryChunks || []).map(
                  getChunkValue,
                );
                const statusIdx = flat.indexOf("member_status");
                const targetStatus =
                  statusIdx !== -1 ? flat[statusIdx + 2] : null;
                const res = targetStatus
                  ? mockMembers.filter((m) => m.memberStatus === targetStatus)
                  : mockMembers;
                return Promise.resolve(res);
              },
            };
          }

          if (tableName.includes("attendance")) {
            return {
              where: (cond: unknown) => {
                const obj = cond as ChunkObject;
                const flat = flattenChunks(obj?.queryChunks || []).map(
                  getChunkValue,
                );
                const actIdx = flat.indexOf("activity_id");
                const targetActId = actIdx !== -1 ? flat[actIdx + 2] : null;
                const filtered = targetActId
                  ? mockAttendanceRecords.filter(
                      (r) => r.activityId === targetActId,
                    )
                  : mockAttendanceRecords;
                return Promise.resolve(filtered);
              },
            };
          }

          // activities
          return {
            where: (cond: unknown) => {
              const obj = cond as ChunkObject;
              const flat = flattenChunks(obj?.queryChunks || []).map(
                getChunkValue,
              );
              let items = [...mockActivities];
              const schedIdx = flat.indexOf("agenda_schedule_id");
              if (schedIdx !== -1 && flat[schedIdx + 1] === " = ") {
                items = items.filter(
                  (a) => a.agendaScheduleId === flat[schedIdx + 2],
                );
              }
              const dateIdx = flat.indexOf("activity_date");
              if (dateIdx !== -1 && flat[dateIdx + 1] === " = ") {
                items = items.filter(
                  (a) => a.activityDate === flat[dateIdx + 2],
                );
              }
              return Promise.resolve(items);
            },
          };
        },
      }),
      insert: () => ({
        values: (
          val: Record<string, unknown> | Array<Record<string, unknown>>,
        ) => {
          const rows = Array.isArray(val) ? val : [val];
          const isAttendance =
            rows.length > 0 && rows[0] !== undefined && "memberId" in rows[0];

          if (isAttendance) {
            for (const r of rows) {
              mockAttendanceRecords.push({
                id: `att-${Math.random().toString(36).slice(2, 8)}`,
                activityId: String(r.activityId),
                memberId: String(r.memberId),
                status: r.status as MockAttendanceRecord["status"],
                attendanceMethod:
                  r.attendanceMethod as MockAttendanceRecord["attendanceMethod"],
                verificationStatus:
                  r.verificationStatus as MockAttendanceRecord["verificationStatus"],
              });
            }
            return Promise.resolve(rows);
          }

          const createdActivities: MockActivity[] = [];
          for (const r of rows) {
            const act: MockActivity = {
              id:
                (r.id as string) ||
                `act-${Math.random().toString(36).slice(2, 8)}`,
              agendaScheduleId: (r.agendaScheduleId as string) ?? null,
              departmentId: (r.departmentId as string) ?? null,
              picId: (r.picId as string) ?? null,
              title: String(r.title),
              topic: (r.topic as string) ?? null,
              description: (r.description as string) ?? null,
              activityDate: String(r.activityDate),
              startTime: (r.startTime as string) ?? null,
              endTime: (r.endTime as string) ?? null,
              location: (r.location as string) ?? null,
              latitude: (r.latitude as string) ?? null,
              longitude: (r.longitude as string) ?? null,
              attendanceRadius: (r.attendanceRadius as number) ?? 100,
              status: "scheduled",
              attendanceEnabled: Boolean(r.attendanceEnabled),
              attendanceOpenAt: (r.attendanceOpenAt as Date) ?? null,
              attendanceCloseAt: (r.attendanceCloseAt as Date) ?? null,
              attendanceToken: (r.attendanceToken as string) ?? null,
              createdBy: (r.createdBy as string) ?? null,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            mockActivities.push(act);
            createdActivities.push(act);
          }
          const p = Promise.resolve(createdActivities);
          return Object.assign(p, {
            returning: async () => createdActivities,
          });
        },
      }),
    },
  };
});

import { PERMISSIONS } from "@/lib/permissions";
import {
  calculateMonthlyOccurrences,
  generateMonthlyActivities,
} from "@/server/dal/activities/generator";
import { UnauthorizedError, type UserSession } from "@/server/dal/auth";

describe("Monthly Recurring Generator DAL", () => {
  const managerSession: UserSession = {
    session: {
      id: "sess-mgr",
      userId: "user-mgr",
      token: "tok-mgr",
      expiresAt: new Date(Date.now() + 86400000),
    },
    user: {
      id: "user-mgr",
      name: "Manager User",
      email: "manager@pemuda.local",
      emailVerified: true,
      roles: [
        {
          name: "chairperson",
          permissions: [
            PERMISSIONS.ACTIVITIES_SCHEDULES_GENERATE,
            PERMISSIONS.ACTIVITIES_EVENTS_READ,
          ],
        },
      ],
    },
  };

  const viewerSession: UserSession = {
    session: {
      id: "sess-view",
      userId: "user-view",
      token: "tok-view",
      expiresAt: new Date(Date.now() + 86400000),
    },
    user: {
      id: "user-view",
      name: "Viewer User",
      email: "viewer@pemuda.local",
      emailVerified: true,
      roles: [
        {
          name: "member",
          permissions: [PERMISSIONS.ACTIVITIES_EVENTS_READ],
        },
      ],
    },
  };

  it("enforces 'server-only' import in src/server/dal/activities/generator.ts", () => {
    const filePath = path.resolve(
      process.cwd(),
      "src/server/dal/activities/generator.ts",
    );
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toMatch(/import\s+['"]server-only['"]/);
  });

  it("enforces ACTIVITIES_SCHEDULES_GENERATE permission gate", async () => {
    await expect(
      generateMonthlyActivities(
        "sched-1",
        { year: 2026, month: 11 },
        viewerSession,
      ),
    ).rejects.toThrow(UnauthorizedError);

    await expect(
      calculateMonthlyOccurrences("sched-1", 2026, 11, viewerSession),
    ).rejects.toThrow(UnauthorizedError);
  });

  it("calculates occurrences for weeks 1-5 matching day of week with weekly topics", async () => {
    // Setup schedule: Saturday (dayOfWeek = 6), time 18:30 - 20:00
    // In November 2026:
    // Nov 1 = Sun, Nov 7 = Sat (W1), Nov 14 = Sat (W2), Nov 21 = Sat (W3), Nov 28 = Sat (W4)
    // November 2026 has 4 Saturdays.
    const schedule: MockSchedule = {
      id: "sched-sat",
      departmentId: "dept-1",
      picId: "pic-1",
      title: "Kajian Pekanan Malam Ahad",
      description: "Kajian rutin santri dan anggota",
      scheduleType: "weekly",
      dayOfWeek: 6, // Saturday
      startTime: "18:30",
      endTime: "20:00",
      defaultLocation: "Masjid Al-Jihad",
      defaultLatitude: "-6.9174639",
      defaultLongitude: "107.6191228",
      defaultRadius: 100,
      isActive: true,
    };
    mockSchedules.push(schedule);

    mockWeeklyTopics.push(
      {
        id: "top-1",
        agendaScheduleId: "sched-sat",
        weekNumber: 1,
        topic: "Tafsir Al-Qur'an",
        isActive: true,
      },
      {
        id: "top-2",
        agendaScheduleId: "sched-sat",
        weekNumber: 2,
        topic: "Hadits Riyadhus Shalihin",
        isActive: true,
      },
      {
        id: "top-3",
        agendaScheduleId: "sched-sat",
        weekNumber: 3,
        topic: "Fiqih Sunnah",
        isActive: true,
      },
      {
        id: "top-4",
        agendaScheduleId: "sched-sat",
        weekNumber: 4,
        topic: "Tarikh Islam",
        isActive: true,
      },
      {
        id: "top-5",
        agendaScheduleId: "sched-sat",
        weekNumber: 5,
        topic: "Kajian Tematik",
        isActive: true,
      },
    );

    const occurrences = await calculateMonthlyOccurrences(
      "sched-sat",
      2026,
      11,
      managerSession,
    );

    expect(occurrences).toHaveLength(4);
    expect(occurrences[0]).toEqual({
      weekNumber: 1,
      date: "2026-11-07",
      dayName: "Saturday",
      topic: "Tafsir Al-Qur'an",
      isActive: true,
      isDuplicate: false,
    });
    expect(occurrences[1]).toEqual({
      weekNumber: 2,
      date: "2026-11-14",
      dayName: "Saturday",
      topic: "Hadits Riyadhus Shalihin",
      isActive: true,
      isDuplicate: false,
    });
    expect(occurrences[2]).toEqual({
      weekNumber: 3,
      date: "2026-11-21",
      dayName: "Saturday",
      topic: "Fiqih Sunnah",
      isActive: true,
      isDuplicate: false,
    });
    expect(occurrences[3]).toEqual({
      weekNumber: 4,
      date: "2026-11-28",
      dayName: "Saturday",
      topic: "Tarikh Islam",
      isActive: true,
      isDuplicate: false,
    });
  });

  it("generates activities, computes attendance windows, creates 64-char token, and handles duplicates/inactives", async () => {
    // Setup active and inactive members
    mockMembers.push(
      { id: "mem-1", fullName: "Member Satu", memberStatus: "active" },
      { id: "mem-2", fullName: "Member Dua", memberStatus: "active" },
      { id: "mem-3", fullName: "Member Tiga", memberStatus: "inactive" },
    );

    // Pre-insert an activity for 2026-11-07 (to test duplicate skipping)
    mockActivities.push({
      id: "act-existing",
      agendaScheduleId: "sched-sat",
      departmentId: "dept-1",
      picId: "pic-1",
      title: "Kajian Pekanan Malam Ahad",
      topic: "Tafsir Al-Qur'an",
      description: null,
      activityDate: "2026-11-07",
      startTime: "18:30",
      endTime: "20:00",
      location: "Masjid Al-Jihad",
      latitude: null,
      longitude: null,
      attendanceRadius: 100,
      status: "scheduled",
      attendanceEnabled: true,
      attendanceOpenAt: null,
      attendanceCloseAt: null,
      attendanceToken: "existing-token",
      createdBy: "user-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Generate with week 3 marked inactive
    const result = await generateMonthlyActivities(
      "sched-sat",
      {
        year: 2026,
        month: 11,
        occurrences: [
          {
            weekNumber: 1,
            date: "2026-11-07",
            topic: "Tafsir Al-Qur'an",
            isActive: true,
          },
          {
            weekNumber: 2,
            date: "2026-11-14",
            topic: "Hadits Riyadhus Shalihin",
            isActive: true,
          },
          {
            weekNumber: 3,
            date: "2026-11-21",
            topic: "Fiqih Sunnah",
            isActive: false, // Inactive: should skip
          },
          {
            weekNumber: 4,
            date: "2026-11-28",
            topic: "Tarikh Islam",
            isActive: true,
          },
        ],
      },
      managerSession,
    );

    // Week 1 was duplicate -> skippedDuplicate = 1
    // Week 3 was inactive -> skippedInactive = 1
    // Week 2 and Week 4 created -> created = 2
    expect(result.created).toBe(2);
    expect(result.skippedDuplicate).toBe(1);
    expect(result.skippedInactive).toBe(1);
    // 2 activities created * 2 active members = 4 participants synced
    expect(result.participantsSynced).toBe(4);

    // Check created activities details
    expect(result.activities).toHaveLength(2);
    const createdW2 = result.activities.find(
      (a) => a.activityDate === "2026-11-14",
    );
    expect(createdW2).toBeDefined();
    expect(createdW2?.attendanceEnabled).toBe(true);
    expect(createdW2?.attendanceToken).toHaveLength(64);
    expect(createdW2?.attendanceOpenAt).toBeDefined();
    expect(createdW2?.attendanceCloseAt).toBeDefined();

    // Check attendance records created for active members only
    const recordsForW2 = mockAttendanceRecords.filter(
      (r) => r.activityId === createdW2?.id,
    );
    expect(recordsForW2).toHaveLength(2);
    expect(recordsForW2.map((r) => r.memberId)).toEqual(["mem-1", "mem-2"]);
    expect(recordsForW2[0]?.status).toBe("absent");
    expect(recordsForW2[0]?.attendanceMethod).toBe("manual");
    expect(recordsForW2[0]?.verificationStatus).toBe("valid");
  });
});
