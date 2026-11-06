import fs from "node:fs";
import path from "node:path";
import { getTableName } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

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
  status:
    | "scheduled"
    | "completed"
    | "holiday"
    | "postponed"
    | "relocated"
    | "cancelled";
  changeReason: string | null;
  attendanceEnabled: boolean;
  attendanceOpenAt: Date | null;
  attendanceCloseAt: Date | null;
  attendanceToken: string | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
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

const { mockActivities, mockAttendanceRecords } = vi.hoisted(() => ({
  mockActivities: [] as MockActivity[],
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

function filterActivitiesByCondition(
  items: MockActivity[],
  cond: unknown,
): MockActivity[] {
  if (!cond) return [...items];
  const obj = cond as ChunkObject;
  const flat = flattenChunks(obj.queryChunks || []).map(getChunkValue);

  return items.filter((row) => {
    const idIdx = flat.indexOf("id");
    if (idIdx !== -1 && flat[idIdx + 1] === " = ") {
      if (row.id !== flat[idIdx + 2]) return false;
    }
    const deptIdx = flat.indexOf("department_id");
    if (deptIdx !== -1 && flat[deptIdx + 1] === " = ") {
      if (row.departmentId !== flat[deptIdx + 2]) return false;
    }
    const schedIdx = flat.indexOf("agenda_schedule_id");
    if (schedIdx !== -1 && flat[schedIdx + 1] === " = ") {
      if (row.agendaScheduleId !== flat[schedIdx + 2]) return false;
    }
    const statusIdx = flat.indexOf("status");
    if (statusIdx !== -1 && flat[statusIdx + 1] === " = ") {
      if (row.status !== flat[statusIdx + 2]) return false;
    }
    const titleIdx = flat.indexOf("title");
    if (titleIdx !== -1 && flat[titleIdx + 1] === " ilike ") {
      const q = String(flat[titleIdx + 2] || "")
        .replace(/%/g, "")
        .toLowerCase();
      if (
        !row.title.toLowerCase().includes(q) &&
        !row.topic?.toLowerCase().includes(q)
      ) {
        return false;
      }
    }
    const dateIdx = flat.indexOf("activity_date");
    if (dateIdx !== -1) {
      const op = flat[dateIdx + 1];
      const val = String(flat[dateIdx + 2] || "");
      if (op === " >= " && row.activityDate < val) return false;
      if (op === " <= " && row.activityDate > val) return false;
      if (op === " = " && row.activityDate !== val) return false;
    }
    return true;
  });
}

function makeActivityQuery(currItems: MockActivity[]) {
  const p = Promise.resolve(currItems);
  return Object.assign(p, {
    orderBy: () => makeActivityQuery(currItems),
    where: (cond: unknown) => {
      const filtered = filterActivitiesByCondition(currItems, cond);
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
      select: (_selectFields?: unknown) => ({
        from: (table: unknown) => {
          let tableName = "";
          try {
            tableName = getTableName(
              table as Parameters<typeof getTableName>[0],
            );
          } catch {
            tableName = "";
          }

          if (tableName.includes("attendance")) {
            const p = Promise.resolve(mockAttendanceRecords);
            return Object.assign(p, {
              where: (cond: unknown) => {
                const obj = cond as ChunkObject;
                const flat = flattenChunks(obj?.queryChunks || []).map(
                  getChunkValue,
                );
                const actIdx = flat.indexOf("activity_id");
                const targetActId = actIdx !== -1 ? flat[actIdx + 2] : null;
                const records = targetActId
                  ? mockAttendanceRecords.filter(
                      (r) => r.activityId === targetActId,
                    )
                  : mockAttendanceRecords;
                return Promise.resolve(records);
              },
            });
          }

          if (tableName.includes("department")) {
            return {
              where: () => ({
                limit: () =>
                  Promise.resolve([{ id: "dept-1", name: "Kaderisasi" }]),
              }),
            };
          }

          if (tableName.includes("member")) {
            return {
              where: () => ({
                limit: () =>
                  Promise.resolve([
                    {
                      id: "pic-1",
                      fullName: "Ahmad Fauzi",
                      memberNumber: "10.05.001",
                    },
                  ]),
              }),
            };
          }

          if (tableName.includes("schedule")) {
            return {
              where: () => ({
                limit: () =>
                  Promise.resolve([
                    {
                      id: "sched-1",
                      title: "Kajian Pekanan Malam Ahad",
                      scheduleType: "weekly",
                    },
                  ]),
              }),
            };
          }

          return makeActivityQuery(mockActivities);
        },
      }),
      insert: () => ({
        values: (
          val: Record<string, unknown> | Array<Record<string, unknown>>,
        ) => {
          const rows = Array.isArray(val) ? val : [val];
          const created: MockActivity[] = [];

          for (const row of rows) {
            const item: MockActivity = {
              id:
                (row.id as string) ||
                `act-${Math.random().toString(36).slice(2, 8)}`,
              agendaScheduleId: (row.agendaScheduleId as string) ?? null,
              departmentId: (row.departmentId as string) ?? null,
              picId: (row.picId as string) ?? null,
              title: String(row.title),
              topic: (row.topic as string) ?? null,
              description: (row.description as string) ?? null,
              activityDate: String(row.activityDate),
              startTime: (row.startTime as string) ?? null,
              endTime: (row.endTime as string) ?? null,
              location: (row.location as string) ?? null,
              latitude: (row.latitude as string) ?? null,
              longitude: (row.longitude as string) ?? null,
              attendanceRadius: (row.attendanceRadius as number) ?? 100,
              status: (row.status as MockActivity["status"]) || "scheduled",
              changeReason: (row.changeReason as string) ?? null,
              attendanceEnabled:
                row.attendanceEnabled !== undefined
                  ? Boolean(row.attendanceEnabled)
                  : false,
              attendanceOpenAt: (row.attendanceOpenAt as Date) ?? null,
              attendanceCloseAt: (row.attendanceCloseAt as Date) ?? null,
              attendanceToken: (row.attendanceToken as string) ?? null,
              createdBy: (row.createdBy as string) ?? null,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            mockActivities.push(item);
            created.push(item);
          }

          const p = Promise.resolve(created);
          return Object.assign(p, {
            returning: async () => created,
          });
        },
      }),
      update: () => ({
        set: (vals: Record<string, unknown>) => ({
          where: (cond: unknown) => ({
            returning: async () => {
              const filtered = filterActivitiesByCondition(
                mockActivities,
                cond,
              );
              for (const item of filtered) {
                Object.assign(item, vals);
                item.updatedAt = new Date();
              }
              return filtered;
            },
          }),
        }),
      }),
      delete: () => ({
        where: async (cond: unknown) => {
          const filtered = filterActivitiesByCondition(mockActivities, cond);
          for (const item of filtered) {
            const idx = mockActivities.indexOf(item);
            if (idx !== -1) mockActivities.splice(idx, 1);
          }
        },
      }),
    },
  };
});

import { PERMISSIONS } from "@/lib/permissions";
import {
  createActivity,
  deleteActivity,
  generateAttendanceToken,
  getActivities,
  getActivityById,
  updateActivity,
  updateActivityStatus,
} from "@/server/dal/activities/events";
import { UnauthorizedError, type UserSession } from "@/server/dal/auth";

describe("Activities Events DAL & Lifecycle", () => {
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
            PERMISSIONS.ACTIVITIES_EVENTS_READ,
            PERMISSIONS.ACTIVITIES_EVENTS_CREATE,
            PERMISSIONS.ACTIVITIES_EVENTS_UPDATE,
            PERMISSIONS.ACTIVITIES_EVENTS_STATUS,
            PERMISSIONS.ACTIVITIES_EVENTS_DELETE,
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

  const noPermsSession: UserSession = {
    session: {
      id: "sess-none",
      userId: "user-none",
      token: "tok-none",
      expiresAt: new Date(Date.now() + 86400000),
    },
    user: {
      id: "user-none",
      name: "Guest",
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

  it("enforces 'server-only' import in src/server/dal/activities/events.ts", () => {
    const filePath = path.resolve(
      process.cwd(),
      "src/server/dal/activities/events.ts",
    );
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toMatch(/import\s+['"]server-only['"]/);
  });

  it("generates unique 64-character URL-safe attendance tokens", () => {
    const token1 = generateAttendanceToken();
    const token2 = generateAttendanceToken();

    expect(token1).toHaveLength(64);
    expect(token2).toHaveLength(64);
    expect(token1).not.toBe(token2);
    // URL-safe base64 characters only: A-Z, a-z, 0-9, -, _
    expect(token1).toMatch(/^[A-Za-z0-9_-]{64}$/);
    expect(token2).toMatch(/^[A-Za-z0-9_-]{64}$/);
  });

  it("enforces permission gates across all activity operations", async () => {
    // Read requires ACTIVITIES_EVENTS_READ
    await expect(getActivities(undefined, noPermsSession)).rejects.toThrow(
      UnauthorizedError,
    );
    await expect(getActivityById("act-1", noPermsSession)).rejects.toThrow(
      UnauthorizedError,
    );

    // Create requires ACTIVITIES_EVENTS_CREATE
    await expect(
      createActivity(
        {
          title: "Kajian Rutin",
          activityDate: "2026-11-10",
        },
        viewerSession,
      ),
    ).rejects.toThrow(UnauthorizedError);

    // Update requires ACTIVITIES_EVENTS_UPDATE
    await expect(
      updateActivity("act-1", { title: "New Title" }, viewerSession),
    ).rejects.toThrow(UnauthorizedError);

    // Status requires ACTIVITIES_EVENTS_STATUS
    await expect(
      updateActivityStatus("act-1", { status: "completed" }, viewerSession),
    ).rejects.toThrow(UnauthorizedError);

    // Delete requires ACTIVITIES_EVENTS_DELETE
    await expect(deleteActivity("act-1", viewerSession)).rejects.toThrow(
      UnauthorizedError,
    );
  });

  it("creates, queries, and updates concrete activity with 64-char attendance token", async () => {
    const created = await createActivity(
      {
        departmentId: "dept-1",
        picId: "pic-1",
        title: "Kajian Pekanan Malam Ahad #1",
        topic: "Tafsir Surat Al-Fatihah",
        activityDate: "2026-11-14",
        startTime: "18:30",
        endTime: "20:00",
        location: "Masjid Al-Jihad",
        attendanceEnabled: true,
      },
      managerSession,
    );

    expect(created.id).toBeDefined();
    expect(created.title).toBe("Kajian Pekanan Malam Ahad #1");
    expect(created.status).toBe("scheduled");
    expect(created.attendanceEnabled).toBe(true);
    expect(created.attendanceToken).toHaveLength(64);

    // Fetch by ID
    const found = await getActivityById(created.id, viewerSession);
    expect(found).toBeDefined();
    expect(found?.title).toBe("Kajian Pekanan Malam Ahad #1");
    expect(found?.department?.name).toBe("Kaderisasi");
    expect(found?.pic?.fullName).toBe("Ahmad Fauzi");
    expect(found?.attendanceSummary).toEqual({
      total: 0,
      present: 0,
      absent: 0,
      permission: 0,
      needVerification: 0,
    });

    // Update activity basic info
    const updated = await updateActivity(
      created.id,
      {
        topic: "Tafsir Surat Al-Baqarah 1-5",
      },
      managerSession,
    );
    expect(updated.topic).toBe("Tafsir Surat Al-Baqarah 1-5");
  });

  it("validates time range rules when both start and end time are provided", async () => {
    await expect(
      createActivity(
        {
          title: "Invalid Time Activity",
          activityDate: "2026-11-15",
          startTime: "10:00",
          endTime: "09:00",
        },
        managerSession,
      ),
    ).rejects.toThrow(/end time.*after.*start time/i);
  });

  it("enforces required changeReason when transitioning to holiday, postponed, relocated, or cancelled", async () => {
    const activity = await createActivity(
      {
        title: "Activity to Transition",
        activityDate: "2026-11-20",
        attendanceEnabled: true,
      },
      managerSession,
    );

    // Missing or empty changeReason for postponed
    await expect(
      updateActivityStatus(
        activity.id,
        { status: "postponed" },
        managerSession,
      ),
    ).rejects.toThrow(/reason is required/i);

    await expect(
      updateActivityStatus(
        activity.id,
        { status: "postponed", changeReason: "   " },
        managerSession,
      ),
    ).rejects.toThrow(/reason is required/i);

    // Missing reason for cancelled
    await expect(
      updateActivityStatus(
        activity.id,
        { status: "cancelled" },
        managerSession,
      ),
    ).rejects.toThrow(/reason is required/i);

    // Missing reason for holiday
    await expect(
      updateActivityStatus(activity.id, { status: "holiday" }, managerSession),
    ).rejects.toThrow(/reason is required/i);

    // Missing reason for relocated
    await expect(
      updateActivityStatus(
        activity.id,
        { status: "relocated" },
        managerSession,
      ),
    ).rejects.toThrow(/reason is required/i);

    // Successfully transition to completed without reason
    const completed = await updateActivityStatus(
      activity.id,
      { status: "completed" },
      managerSession,
    );
    expect(completed.status).toBe("completed");

    // Successfully transition to postponed with reason and disables attendance
    const postponed = await updateActivityStatus(
      activity.id,
      {
        status: "postponed",
        changeReason: "Ustadz berhalangan hadir karena safar",
      },
      managerSession,
    );
    expect(postponed.status).toBe("postponed");
    expect(postponed.changeReason).toBe(
      "Ustadz berhalangan hadir karena safar",
    );
    expect(postponed.attendanceEnabled).toBe(false);

    // Successfully transition to cancelled with reason and ensures attendance disabled
    const cancelled = await updateActivityStatus(
      activity.id,
      {
        status: "cancelled",
        changeReason: "Hujan badai ekstrem dan banjir",
      },
      managerSession,
    );
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.attendanceEnabled).toBe(false);
  });
});
