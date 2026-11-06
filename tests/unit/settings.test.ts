import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

interface MockSetting {
  id: string;
  key: string;
  value: string | null;
  type: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ChunkObject {
  name?: string;
  value?: unknown;
  queryChunks?: unknown[];
}

const { mockSettings } = vi.hoisted(() => ({
  mockSettings: [] as MockSetting[],
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

function filterByCondition(items: MockSetting[], cond: unknown): MockSetting[] {
  if (!cond) return [...items];
  const obj = cond as ChunkObject;
  const flat = flattenChunks(obj.queryChunks || []).map(getChunkValue);
  return items.filter((row) => {
    const keyIdx = flat.indexOf("key");
    if (keyIdx !== -1 && flat[keyIdx + 1] === " = ") {
      const val = flat[keyIdx + 2];
      if (row.key !== val) return false;
    }
    return true;
  });
}

vi.mock("@/db", () => {
  return {
    db: {
      select: () => ({
        from: () => {
          const p = Promise.resolve(mockSettings);
          return Object.assign(p, {
            where: (cond: unknown) => {
              const filtered = filterByCondition(mockSettings, cond);
              return {
                limit: (n: number) => Promise.resolve(filtered.slice(0, n)),
              };
            },
          });
        },
      }),
      insert: () => ({
        values: async (val: { key: string; value: string; type?: string }) => {
          const item: MockSetting = {
            id: `setting-${Math.random().toString(36).slice(2, 8)}`,
            key: val.key,
            value: val.value,
            type: val.type ?? "string",
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          mockSettings.push(item);
          return [item];
        },
      }),
      update: () => ({
        set: (vals: Partial<MockSetting>) => ({
          where: async (cond: unknown) => {
            const filtered = filterByCondition(mockSettings, cond);
            for (const item of filtered) {
              Object.assign(item, vals);
            }
            return filtered;
          },
        }),
      }),
    },
  };
});

import { PERMISSIONS } from "@/lib/permissions";
import { UnauthorizedError, type UserSession } from "@/server/dal/auth";
import {
  DEFAULT_SYSTEM_SETTINGS,
  getSystemSettings,
  updateSystemSettings,
} from "@/server/dal/organization/settings";

describe("System Settings DAL", () => {
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
            PERMISSIONS.ORGANIZATION_SETTINGS_READ,
            PERMISSIONS.ORGANIZATION_SETTINGS_MANAGE,
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
          permissions: [PERMISSIONS.ORGANIZATION_SETTINGS_READ],
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
      name: "No Perms User",
      email: "noperms@pemuda.local",
      emailVerified: true,
      roles: [
        {
          name: "guest",
          permissions: [],
        },
      ],
    },
  };

  it("enforces permission gates on read and manage operations", async () => {
    await expect(getSystemSettings(noPermsSession)).rejects.toThrow(
      UnauthorizedError,
    );

    await expect(
      updateSystemSettings({ app_name: "Test" }, viewerSession),
    ).rejects.toThrow(UnauthorizedError);
  });

  it("returns fallback defaults when rows are missing", async () => {
    const settings = await getSystemSettings(viewerSession);
    expect(settings.app_name).toBeDefined();
    expect(settings.organization_name).toBeDefined();
    expect(settings.default_attendance_radius).toBe(
      DEFAULT_SYSTEM_SETTINGS.default_attendance_radius,
    );
  });

  it("updates system settings and persists new values", async () => {
    const updatedAppName = `Pemuda Test ${Date.now()}`;
    const res = await updateSystemSettings(
      {
        app_name: updatedAppName,
        default_attendance_radius: "150",
      },
      managerSession,
    );

    expect(res.app_name).toBe(updatedAppName);
    expect(res.default_attendance_radius).toBe("150");

    const fetched = await getSystemSettings(viewerSession);
    expect(fetched.app_name).toBe(updatedAppName);
    expect(fetched.default_attendance_radius).toBe("150");
  });
});
