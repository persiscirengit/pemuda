import fs from "node:fs";
import path from "node:path";
import { getTableName } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

interface MockSchedule {
  id: string;
  departmentId: string | null;
  picId: string | null;
  activityLocationId: string | null;
  title: string;
  description: string | null;
  scheduleType: "weekly" | "monthly" | "incidental" | "yearly";
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  specificDate: string | null;
  startTime: string | null;
  endTime: string | null;
  defaultLocation: string | null;
  defaultLatitude: string | null;
  defaultLongitude: string | null;
  defaultRadius: number;
  isActive: boolean;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface MockWeeklyTopic {
  id: string;
  agendaScheduleId: string;
  weekNumber: number;
  topic: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface ChunkObject {
  name?: string;
  value?: unknown;
  queryChunks?: unknown[];
}

const { mockSchedules, mockWeeklyTopics } = vi.hoisted(() => ({
  mockSchedules: [] as MockSchedule[],
  mockWeeklyTopics: [] as MockWeeklyTopic[],
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

function filterSchedulesByCondition(
  items: MockSchedule[],
  cond: unknown,
): MockSchedule[] {
  if (!cond) return [...items];
  const obj = cond as ChunkObject;
  const flat = flattenChunks(obj.queryChunks || []).map(getChunkValue);
  return items.filter((row) => {
    const idIdx = flat.indexOf("id");
    if (idIdx !== -1 && flat[idIdx + 1] === " = ") {
      const val = flat[idIdx + 2];
      if (row.id !== val) return false;
    }
    const typeIdx = flat.indexOf("schedule_type");
    if (typeIdx !== -1 && flat[typeIdx + 1] === " = ") {
      const val = flat[typeIdx + 2];
      if (row.scheduleType !== val) return false;
    }
    const titleIdx = flat.indexOf("title");
    if (titleIdx !== -1 && flat[titleIdx + 1] === " ilike ") {
      const rawVal = String(flat[titleIdx + 2] || "")
        .replace(/%/g, "")
        .toLowerCase();
      if (!row.title.toLowerCase().includes(rawVal)) return false;
    }
    const activeIdx = flat.indexOf("is_active");
    if (activeIdx !== -1 && flat[activeIdx + 1] === " = ") {
      const val = flat[activeIdx + 2];
      if (row.isActive !== val) return false;
    }
    return true;
  });
}

function filterTopicsByCondition(
  items: MockWeeklyTopic[],
  cond: unknown,
): MockWeeklyTopic[] {
  if (!cond) return [...items];
  const obj = cond as ChunkObject;
  const flat = flattenChunks(obj.queryChunks || []).map(getChunkValue);
  return items.filter((row) => {
    const schedIdx = flat.indexOf("agenda_schedule_id");
    if (schedIdx !== -1 && flat[schedIdx + 1] === " = ") {
      const val = flat[schedIdx + 2];
      if (row.agendaScheduleId !== val) return false;
    }
    const weekIdx = flat.indexOf("week_number");
    if (weekIdx !== -1 && flat[weekIdx + 1] === " = ") {
      const val = flat[weekIdx + 2];
      if (row.weekNumber !== val) return false;
    }
    return true;
  });
}

function makeScheduleQuery(currItems: MockSchedule[]) {
  const p = Promise.resolve(currItems);
  return Object.assign(p, {
    orderBy: () => makeScheduleQuery(currItems),
    where: (cond: unknown) => {
      const filtered = filterSchedulesByCondition(currItems, cond);
      const subPromise = Promise.resolve(filtered);
      return Object.assign(subPromise, {
        limit: (n: number) => Promise.resolve(filtered.slice(0, n)),
        orderBy: () => Promise.resolve(filtered),
      });
    },
    limit: (n: number) => Promise.resolve(currItems.slice(0, n)),
  });
}

function makeTopicQuery(currItems: MockWeeklyTopic[]) {
  const p = Promise.resolve(currItems);
  return Object.assign(p, {
    orderBy: () => makeTopicQuery(currItems),
    where: (cond: unknown) => {
      const filtered = filterTopicsByCondition(currItems, cond);
      const subPromise = Promise.resolve(filtered);
      return Object.assign(subPromise, {
        limit: (n: number) => Promise.resolve(filtered.slice(0, n)),
        orderBy: () => Promise.resolve(filtered),
      });
    },
    limit: (n: number) => Promise.resolve(currItems.slice(0, n)),
  });
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
          if (tableName.includes("topic") || tableName.includes("weekly")) {
            return makeTopicQuery(mockWeeklyTopics);
          }
          return makeScheduleQuery(mockSchedules);
        },
      }),
      insert: () => ({
        values: (val: Record<string, unknown>) => {
          const isTopic = "weekNumber" in val;
          let createdItem: unknown;
          if (isTopic) {
            const item: MockWeeklyTopic = {
              id: `topic-${Math.random().toString(36).slice(2, 8)}`,
              agendaScheduleId: String(val.agendaScheduleId),
              weekNumber: Number(val.weekNumber),
              topic: (val.topic as string) ?? null,
              isActive: (val.isActive as boolean) ?? true,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            mockWeeklyTopics.push(item);
            createdItem = item;
          } else {
            const schedule: MockSchedule = {
              id: `sched-${Math.random().toString(36).slice(2, 8)}`,
              departmentId: (val.departmentId as string) ?? null,
              picId: (val.picId as string) ?? null,
              activityLocationId: (val.activityLocationId as string) ?? null,
              title: String(val.title),
              description: (val.description as string) ?? null,
              scheduleType: val.scheduleType as
                | "weekly"
                | "monthly"
                | "incidental"
                | "yearly",
              dayOfWeek:
                val.dayOfWeek !== undefined ? Number(val.dayOfWeek) : null,
              dayOfMonth:
                val.dayOfMonth !== undefined ? Number(val.dayOfMonth) : null,
              specificDate: (val.specificDate as string) ?? null,
              startTime: (val.startTime as string) ?? null,
              endTime: (val.endTime as string) ?? null,
              defaultLocation: (val.defaultLocation as string) ?? null,
              defaultLatitude: (val.defaultLatitude as string) ?? null,
              defaultLongitude: (val.defaultLongitude as string) ?? null,
              defaultRadius: (val.defaultRadius as number) ?? 100,
              isActive: (val.isActive as boolean) ?? true,
              createdBy: (val.createdBy as string) ?? null,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            mockSchedules.push(schedule);
            createdItem = schedule;
          }

          const p = Promise.resolve([createdItem]);
          return Object.assign(p, {
            returning: async () => [createdItem],
          });
        },
      }),
      update: () => ({
        set: (vals: Record<string, unknown>) => ({
          where: (cond: unknown) => ({
            returning: async () => {
              const isTopic = "topic" in vals || "weekNumber" in vals;
              if (isTopic) {
                const filtered = filterTopicsByCondition(
                  mockWeeklyTopics,
                  cond,
                );
                for (const item of filtered) {
                  Object.assign(item, vals);
                }
                return filtered;
              }

              const filtered = filterSchedulesByCondition(mockSchedules, cond);
              for (const item of filtered) {
                Object.assign(item, vals);
              }
              return filtered;
            },
          }),
        }),
      }),
      delete: () => ({
        where: async (cond: unknown) => {
          const filtered = filterTopicsByCondition(mockWeeklyTopics, cond);
          for (const item of filtered) {
            const idx = mockWeeklyTopics.indexOf(item);
            if (idx !== -1) mockWeeklyTopics.splice(idx, 1);
          }
        },
      }),
    },
  };
});

import { PERMISSIONS } from "@/lib/permissions";
import {
  createAgendaSchedule,
  getAgendaScheduleById,
  getAgendaSchedules,
  getWeeklyTopics,
  toggleScheduleStatus,
  updateAgendaSchedule,
  updateWeeklyTopics,
} from "@/server/dal/activities/schedules";
import { UnauthorizedError, type UserSession } from "@/server/dal/auth";

describe("Agenda Schedules DAL", () => {
  const managerSession: UserSession = {
    session: {
      id: "sess-1",
      userId: "user-1",
      token: "tok-1",
      expiresAt: new Date(Date.now() + 86400000),
    },
    user: {
      id: "user-1",
      name: "Manager User",
      email: "manager@pemuda.local",
      emailVerified: true,
      roles: [
        {
          name: "chairperson",
          permissions: [
            PERMISSIONS.ACTIVITIES_SCHEDULES_READ,
            PERMISSIONS.ACTIVITIES_SCHEDULES_MANAGE,
          ],
        },
      ],
    },
  };

  const viewerSession: UserSession = {
    session: {
      id: "sess-2",
      userId: "user-2",
      token: "tok-2",
      expiresAt: new Date(Date.now() + 86400000),
    },
    user: {
      id: "user-2",
      name: "Viewer User",
      email: "viewer@pemuda.local",
      emailVerified: true,
      roles: [
        {
          name: "member",
          permissions: [PERMISSIONS.ACTIVITIES_SCHEDULES_READ],
        },
      ],
    },
  };

  const noPermsSession: UserSession = {
    session: {
      id: "sess-3",
      userId: "user-3",
      token: "tok-3",
      expiresAt: new Date(Date.now() + 86400000),
    },
    user: {
      id: "user-3",
      name: "Guest User",
      email: "guest@pemuda.local",
      emailVerified: true,
      roles: [
        {
          name: "guest",
          permissions: [],
        },
      ],
    },
  };

  it("enforces 'server-only' import in src/server/dal/activities/schedules.ts", () => {
    const filePath = path.resolve(
      process.cwd(),
      "src/server/dal/activities/schedules.ts",
    );
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toMatch(/import\s+['"]server-only['"]/);
  });

  it("enforces permission gates on read and manage operations", async () => {
    // Read requires ACTIVITIES_SCHEDULES_READ
    await expect(getAgendaSchedules(undefined, noPermsSession)).rejects.toThrow(
      UnauthorizedError,
    );
    await expect(
      getAgendaScheduleById("any-id", noPermsSession),
    ).rejects.toThrow(UnauthorizedError);

    // Manage requires ACTIVITIES_SCHEDULES_MANAGE
    await expect(
      createAgendaSchedule(
        {
          title: "Kajian Rutin",
          scheduleType: "weekly",
          dayOfWeek: 1,
        },
        viewerSession,
      ),
    ).rejects.toThrow(UnauthorizedError);

    await expect(
      updateAgendaSchedule("any-id", { title: "Updated Title" }, viewerSession),
    ).rejects.toThrow(UnauthorizedError);

    await expect(
      toggleScheduleStatus("any-id", false, viewerSession),
    ).rejects.toThrow(UnauthorizedError);

    await expect(
      updateWeeklyTopics(
        "any-id",
        [{ weekNumber: 1, topic: "Akidah" }],
        viewerSession,
      ),
    ).rejects.toThrow(UnauthorizedError);
  });

  it("validates recurrence rules for weekly, monthly, and incidental schedules", async () => {
    // Weekly requires valid dayOfWeek (0-6)
    await expect(
      createAgendaSchedule(
        {
          title: "Invalid Weekly (missing dayOfWeek)",
          scheduleType: "weekly",
        },
        managerSession,
      ),
    ).rejects.toThrow(/day of week/i);

    await expect(
      createAgendaSchedule(
        {
          title: "Invalid Weekly (dayOfWeek 7 out of range)",
          scheduleType: "weekly",
          dayOfWeek: 7,
        },
        managerSession,
      ),
    ).rejects.toThrow(/day of week/i);

    // Monthly requires valid dayOfMonth (1-31)
    await expect(
      createAgendaSchedule(
        {
          title: "Invalid Monthly (missing dayOfMonth)",
          scheduleType: "monthly",
        },
        managerSession,
      ),
    ).rejects.toThrow(/day of month/i);

    await expect(
      createAgendaSchedule(
        {
          title: "Invalid Monthly (dayOfMonth 0 out of range)",
          scheduleType: "monthly",
          dayOfMonth: 0,
        },
        managerSession,
      ),
    ).rejects.toThrow(/day of month/i);

    await expect(
      createAgendaSchedule(
        {
          title: "Invalid Monthly (dayOfMonth 32 out of range)",
          scheduleType: "monthly",
          dayOfMonth: 32,
        },
        managerSession,
      ),
    ).rejects.toThrow(/day of month/i);

    // Incidental requires specificDate
    await expect(
      createAgendaSchedule(
        {
          title: "Invalid Incidental (missing specificDate)",
          scheduleType: "incidental",
        },
        managerSession,
      ),
    ).rejects.toThrow(/specific date/i);
  });

  it("validates that end time must be after start time", async () => {
    await expect(
      createAgendaSchedule(
        {
          title: "Backwards Time Schedule",
          scheduleType: "weekly",
          dayOfWeek: 5,
          startTime: "10:00",
          endTime: "09:00",
        },
        managerSession,
      ),
    ).rejects.toThrow(/end time.*after.*start time/i);

    await expect(
      createAgendaSchedule(
        {
          title: "Equal Time Schedule",
          scheduleType: "weekly",
          dayOfWeek: 5,
          startTime: "10:00",
          endTime: "10:00",
        },
        managerSession,
      ),
    ).rejects.toThrow(/end time.*after.*start time/i);
  });

  it("creates, updates, and configures weekly curriculum topics across weeks 1-5", async () => {
    const created = await createAgendaSchedule(
      {
        title: "Kajian Pekanan Malam Ahad",
        scheduleType: "weekly",
        dayOfWeek: 6, // Saturday
        startTime: "18:30",
        endTime: "20:00",
        isActive: true,
      },
      managerSession,
    );

    expect(created.id).toBeDefined();
    expect(created.title).toBe("Kajian Pekanan Malam Ahad");
    expect(created.dayOfWeek).toBe(6);

    // Week number bounds validation (< 1 or > 5)
    await expect(
      updateWeeklyTopics(
        created.id,
        [{ weekNumber: 0, topic: "Invalid Week 0" }],
        managerSession,
      ),
    ).rejects.toThrow(/week number/i);

    await expect(
      updateWeeklyTopics(
        created.id,
        [{ weekNumber: 6, topic: "Invalid Week 6" }],
        managerSession,
      ),
    ).rejects.toThrow(/week number/i);

    // Configure 5 weekly topics
    const topics = [
      { weekNumber: 1, topic: "Tafsir Al-Qur'an (Juz 'Amma)" },
      { weekNumber: 2, topic: "Hadits Riyadhus Shalihin" },
      { weekNumber: 3, topic: "Fiqih Sunnah Sayyid Sabiq" },
      { weekNumber: 4, topic: "Tarikh & Sirah Nabawiyyah" },
      { weekNumber: 5, topic: "Kajian Tematik & Bedah Buku" },
    ];

    const savedTopics = await updateWeeklyTopics(
      created.id,
      topics,
      managerSession,
    );
    expect(savedTopics.length).toBe(5);

    // Retrieve weekly topics
    const fetchedTopics = await getWeeklyTopics(created.id, viewerSession);
    expect(fetchedTopics.length).toBe(5);
    expect(fetchedTopics.find((t) => t.weekNumber === 1)?.topic).toBe(
      "Tafsir Al-Qur'an (Juz 'Amma)",
    );

    // Retrieve schedule by ID
    const fullSchedule = await getAgendaScheduleById(created.id, viewerSession);
    expect(fullSchedule).toBeDefined();
    expect(fullSchedule?.title).toBe("Kajian Pekanan Malam Ahad");
    expect(fullSchedule?.weeklyTopics?.length).toBe(5);
  });
});
