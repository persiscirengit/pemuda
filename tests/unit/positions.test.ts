import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

interface MockPos {
  id: string;
  name: string;
  description: string | null;
  status: "active" | "inactive";
  createdAt: Date;
  updatedAt: Date;
}

interface ChunkObject {
  name?: string;
  value?: unknown;
  queryChunks?: unknown[];
}

const { mockPositions } = vi.hoisted(() => ({
  mockPositions: [] as MockPos[],
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

function filterByCondition(items: MockPos[], cond: unknown): MockPos[] {
  if (!cond) return [...items];
  const obj = cond as ChunkObject;
  const flat = flattenChunks(obj.queryChunks || []).map(getChunkValue);
  return items.filter((row) => {
    const idIdx = flat.indexOf("id");
    if (idIdx !== -1 && flat[idIdx + 1] === " = ") {
      const val = flat[idIdx + 2];
      if (row.id !== val) return false;
    }
    const nameIdx = flat.indexOf("name");
    if (nameIdx !== -1 && flat[nameIdx + 1] === " = ") {
      const val = flat[nameIdx + 2];
      if (row.name !== val) return false;
    }
    if (nameIdx !== -1 && flat[nameIdx + 1] === " ilike ") {
      const rawVal = String(flat[nameIdx + 2] || "")
        .replace(/%/g, "")
        .toLowerCase();
      if (!row.name?.toLowerCase().includes(rawVal)) return false;
    }
    const statusIdx = flat.indexOf("status");
    if (statusIdx !== -1 && flat[statusIdx + 1] === " = ") {
      const val = flat[statusIdx + 2];
      if (row.status !== val) return false;
    }
    return true;
  });
}

function makeQuery(currItems: MockPos[]) {
  const p = Promise.resolve(currItems);
  return Object.assign(p, {
    orderBy: () => makeQuery(currItems),
    where: (cond: unknown) => {
      const filtered = filterByCondition(currItems, cond);
      const subPromise = Promise.resolve(filtered);
      return Object.assign(subPromise, {
        limit: (n: number) => Promise.resolve(filtered.slice(0, n)),
      });
    },
    limit: (n: number) => Promise.resolve(currItems.slice(0, n)),
  });
}

vi.mock("@/db", () => {
  return {
    db: {
      select: () => ({
        from: () => makeQuery(mockPositions),
      }),
      insert: () => ({
        values: (val: {
          name: string;
          description?: string | null;
          status?: "active" | "inactive";
        }) => ({
          returning: async () => {
            const item: MockPos = {
              id: `pos-${Math.random().toString(36).slice(2, 8)}`,
              name: val.name,
              description: val.description ?? null,
              status: val.status ?? "active",
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            mockPositions.push(item);
            return [item];
          },
        }),
      }),
      update: () => ({
        set: (vals: Partial<MockPos>) => ({
          where: (cond: unknown) => ({
            returning: async () => {
              const filtered = filterByCondition(mockPositions, cond);
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
          const filtered = filterByCondition(mockPositions, cond);
          for (const item of filtered) {
            const idx = mockPositions.indexOf(item);
            if (idx !== -1) mockPositions.splice(idx, 1);
          }
        },
      }),
    },
  };
});

import { PERMISSIONS } from "@/lib/permissions";
import { UnauthorizedError, type UserSession } from "@/server/dal/auth";
import {
  createPosition,
  deletePosition,
  getPositionById,
  getPositions,
  togglePositionStatus,
  updatePosition,
} from "@/server/dal/organization/positions";

describe("Positions DAL", () => {
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
            PERMISSIONS.ORGANIZATION_POSITIONS_READ,
            PERMISSIONS.ORGANIZATION_POSITIONS_MANAGE,
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
          permissions: [PERMISSIONS.ORGANIZATION_POSITIONS_READ],
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
    // Read requires ORGANIZATION_POSITIONS_READ
    await expect(getPositions(undefined, noPermsSession)).rejects.toThrow(
      UnauthorizedError,
    );
    await expect(getPositionById("any-id", noPermsSession)).rejects.toThrow(
      UnauthorizedError,
    );

    // Manage requires ORGANIZATION_POSITIONS_MANAGE
    await expect(
      createPosition({ name: "Test Pos" }, viewerSession),
    ).rejects.toThrow(UnauthorizedError);

    await expect(
      updatePosition("any-id", { name: "Updated" }, viewerSession),
    ).rejects.toThrow(UnauthorizedError);

    await expect(
      togglePositionStatus("any-id", "inactive", viewerSession),
    ).rejects.toThrow(UnauthorizedError);

    await expect(deletePosition("any-id", viewerSession)).rejects.toThrow(
      UnauthorizedError,
    );
  });

  it("creates, retrieves, updates, toggles, and deletes positions successfully", async () => {
    const uniqueName = `Pos-${Date.now()}`;
    const created = await createPosition(
      {
        name: uniqueName,
        description: "Test Position Description",
        status: "active",
      },
      managerSession,
    );

    expect(created.id).toBeDefined();
    expect(created.name).toBe(uniqueName);
    expect(created.status).toBe("active");

    // Duplicate name rejection
    await expect(
      createPosition({ name: uniqueName }, managerSession),
    ).rejects.toThrow(/duplicate|exists/i);

    // Get by ID
    const fetched = await getPositionById(created.id, viewerSession);
    expect(fetched).toBeDefined();
    expect(fetched?.name).toBe(uniqueName);

    // Update
    const updated = await updatePosition(
      created.id,
      { description: "Updated Position Description" },
      managerSession,
    );
    expect(updated.description).toBe("Updated Position Description");

    // Toggle status
    const toggled = await togglePositionStatus(
      created.id,
      "inactive",
      managerSession,
    );
    expect(toggled.status).toBe("inactive");

    // Filter by search & status
    const searchResults = await getPositions(
      { search: uniqueName, status: "inactive" },
      viewerSession,
    );
    expect(searchResults.some((p) => p.id === created.id)).toBe(true);

    // Delete
    await deletePosition(created.id, managerSession);
    const afterDelete = await getPositionById(created.id, viewerSession);
    expect(afterDelete).toBeNull();
  });
});
