import fs from "node:fs";
import path from "node:path";
import { getTableName } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

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
  createdBy: string | null;
}

interface ChunkObject {
  name?: string;
  value?: unknown;
  queryChunks?: unknown[];
}

const { mockMembers, mockAttendanceRecords } = vi.hoisted(() => ({
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

          return {
            where: () => Promise.resolve([]),
          };
        },
      }),
      insert: () => ({
        values: (rows: Array<Record<string, unknown>>) => {
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
              createdBy: (r.createdBy as string) ?? null,
            });
          }
          return Promise.resolve(rows);
        },
      }),
    },
  };
});

import { PERMISSIONS } from "@/lib/permissions";
import { syncActivityParticipants } from "@/server/dal/activities/generator";
import { UnauthorizedError, type UserSession } from "@/server/dal/auth";

describe("Attendance Participant Synchronization", () => {
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
          permissions: [PERMISSIONS.ACTIVITIES_SCHEDULES_GENERATE],
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

  it("enforces 'server-only' import in generator/sync DAL", () => {
    const filePath = path.resolve(
      process.cwd(),
      "src/server/dal/activities/generator.ts",
    );
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toMatch(/import\s+['"]server-only['"]/);
  });

  it("enforces permission check on participant synchronization", async () => {
    await expect(
      syncActivityParticipants("act-1", viewerSession),
    ).rejects.toThrow(UnauthorizedError);
  });

  it("synchronizes active members with absent, manual, and valid default status", async () => {
    mockMembers.length = 0;
    mockAttendanceRecords.length = 0;

    mockMembers.push(
      { id: "mem-active-1", fullName: "Ahmad Fauzi", memberStatus: "active" },
      { id: "mem-active-2", fullName: "Budi Santoso", memberStatus: "active" },
      {
        id: "mem-inactive",
        fullName: "Dedi Inactive",
        memberStatus: "inactive",
      },
      { id: "mem-alumni", fullName: "Eko Alumni", memberStatus: "alumni" },
      { id: "mem-moved", fullName: "Fajar Moved", memberStatus: "moved" },
    );

    const syncedCount = await syncActivityParticipants(
      "act-100",
      managerSession,
    );
    expect(syncedCount).toBe(2);

    const records = mockAttendanceRecords.filter(
      (r) => r.activityId === "act-100",
    );
    expect(records).toHaveLength(2);

    for (const rec of records) {
      expect(rec.status).toBe("absent");
      expect(rec.attendanceMethod).toBe("manual");
      expect(rec.verificationStatus).toBe("valid");
      expect(["mem-active-1", "mem-active-2"]).toContain(rec.memberId);
    }

    // Verify non-active members were completely excluded
    const syncedMemberIds = records.map((r) => r.memberId);
    expect(syncedMemberIds).not.toContain("mem-inactive");
    expect(syncedMemberIds).not.toContain("mem-alumni");
    expect(syncedMemberIds).not.toContain("mem-moved");
  });

  it("is idempotent and avoids duplicate participant records on repeated sync", async () => {
    // Calling sync again for act-100 should insert 0 new records
    const repeatedCount = await syncActivityParticipants(
      "act-100",
      managerSession,
    );
    expect(repeatedCount).toBe(0);

    const totalRecords = mockAttendanceRecords.filter(
      (r) => r.activityId === "act-100",
    );
    expect(totalRecords).toHaveLength(2);

    // If a new active member joins later:
    mockMembers.push({
      id: "mem-active-3",
      fullName: "Third Active Member",
      memberStatus: "active",
    });

    const newSyncCount = await syncActivityParticipants(
      "act-100",
      managerSession,
    );
    expect(newSyncCount).toBe(1);

    const updatedRecords = mockAttendanceRecords.filter(
      (r) => r.activityId === "act-100",
    );
    expect(updatedRecords).toHaveLength(3);
    expect(updatedRecords.some((r) => r.memberId === "mem-active-3")).toBe(
      true,
    );
  });
});
