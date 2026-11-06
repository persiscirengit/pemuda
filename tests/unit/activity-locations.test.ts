import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

interface MockLocation {
  id: string;
  name: string;
  address: string | null;
  latitude: string | null;
  longitude: string | null;
  radiusMeters: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface ChunkObject {
  name?: string;
  value?: unknown;
  queryChunks?: unknown[];
}

const { mockLocations } = vi.hoisted(() => ({
  mockLocations: [] as MockLocation[],
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

function filterByCondition(
  items: MockLocation[],
  cond: unknown,
): MockLocation[] {
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
    const activeIdx = flat.indexOf("is_active");
    if (activeIdx !== -1 && flat[activeIdx + 1] === " = ") {
      const val = flat[activeIdx + 2];
      if (row.isActive !== val) return false;
    }
    return true;
  });
}

function makeQuery(currItems: MockLocation[]) {
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
        from: () => makeQuery(mockLocations),
      }),
      insert: () => ({
        values: (val: {
          name: string;
          address?: string | null;
          latitude?: string | null;
          longitude?: string | null;
          radiusMeters?: number;
          isActive?: boolean;
        }) => ({
          returning: async () => {
            const item: MockLocation = {
              id: `loc-${Math.random().toString(36).slice(2, 8)}`,
              name: val.name,
              address: val.address ?? null,
              latitude: val.latitude ?? null,
              longitude: val.longitude ?? null,
              radiusMeters: val.radiusMeters ?? 100,
              isActive: val.isActive ?? true,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            mockLocations.push(item);
            return [item];
          },
        }),
      }),
      update: () => ({
        set: (vals: Partial<MockLocation>) => ({
          where: (cond: unknown) => ({
            returning: async () => {
              const filtered = filterByCondition(mockLocations, cond);
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
          const filtered = filterByCondition(mockLocations, cond);
          for (const item of filtered) {
            const idx = mockLocations.indexOf(item);
            if (idx !== -1) mockLocations.splice(idx, 1);
          }
        },
      }),
    },
  };
});

import { PERMISSIONS } from "@/lib/permissions";
import {
  createActivityLocation,
  getActivityLocationById,
  getActivityLocations,
  toggleLocationStatus,
  updateActivityLocation,
} from "@/server/dal/activities/locations";
import { UnauthorizedError, type UserSession } from "@/server/dal/auth";

describe("Activity Locations DAL", () => {
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
            PERMISSIONS.ACTIVITIES_LOCATIONS_READ,
            PERMISSIONS.ACTIVITIES_LOCATIONS_MANAGE,
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
          permissions: [PERMISSIONS.ACTIVITIES_LOCATIONS_READ],
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

  it("enforces 'server-only' import in src/server/dal/activities/locations.ts", () => {
    const filePath = path.resolve(
      process.cwd(),
      "src/server/dal/activities/locations.ts",
    );
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toMatch(/import\s+['"]server-only['"]/);
  });

  it("enforces permission gates on read and manage operations", async () => {
    // Read requires ACTIVITIES_LOCATIONS_READ
    await expect(
      getActivityLocations(undefined, noPermsSession),
    ).rejects.toThrow(UnauthorizedError);
    await expect(
      getActivityLocationById("any-id", noPermsSession),
    ).rejects.toThrow(UnauthorizedError);

    // Manage requires ACTIVITIES_LOCATIONS_MANAGE
    await expect(
      createActivityLocation({ name: "Masjid Al-Jihad" }, viewerSession),
    ).rejects.toThrow(UnauthorizedError);

    await expect(
      updateActivityLocation(
        "any-id",
        { name: "Updated Venue" },
        viewerSession,
      ),
    ).rejects.toThrow(UnauthorizedError);

    await expect(
      toggleLocationStatus("any-id", false, viewerSession),
    ).rejects.toThrow(UnauthorizedError);
  });

  it("validates geographic coordinates and geofence radius bounds", async () => {
    // Latitude < -90 or > 90
    await expect(
      createActivityLocation(
        {
          name: "Invalid Lat Venue",
          latitude: 95.123,
          longitude: 107.6191,
        },
        managerSession,
      ),
    ).rejects.toThrow(/latitude/i);

    await expect(
      createActivityLocation(
        {
          name: "Invalid Lat Venue Low",
          latitude: -91.0,
          longitude: 107.6191,
        },
        managerSession,
      ),
    ).rejects.toThrow(/latitude/i);

    // Longitude < -180 or > 180
    await expect(
      createActivityLocation(
        {
          name: "Invalid Lng Venue",
          latitude: -6.9175,
          longitude: 185.0,
        },
        managerSession,
      ),
    ).rejects.toThrow(/longitude/i);

    await expect(
      createActivityLocation(
        {
          name: "Invalid Lng Venue Low",
          latitude: -6.9175,
          longitude: -181.0,
        },
        managerSession,
      ),
    ).rejects.toThrow(/longitude/i);

    // Radius <= 0
    await expect(
      createActivityLocation(
        {
          name: "Zero Radius Venue",
          radiusMeters: 0,
        },
        managerSession,
      ),
    ).rejects.toThrow(/radius/i);

    await expect(
      createActivityLocation(
        {
          name: "Negative Radius Venue",
          radiusMeters: -50,
        },
        managerSession,
      ),
    ).rejects.toThrow(/radius/i);
  });

  it("creates, retrieves, updates, and deactivates venues while preserving records", async () => {
    const venueName = `Venue-${Date.now()}`;
    const created = await createActivityLocation(
      {
        name: venueName,
        address: "Jl. Cirengit No. 10",
        latitude: -6.9174639,
        longitude: 107.6191228,
        radiusMeters: 100,
        isActive: true,
      },
      managerSession,
    );

    expect(created.id).toBeDefined();
    expect(created.name).toBe(venueName);
    expect(created.radiusMeters).toBe(100);
    expect(created.isActive).toBe(true);

    // Retrieve by ID
    const fetched = await getActivityLocationById(created.id, viewerSession);
    expect(fetched).toBeDefined();
    expect(fetched?.name).toBe(venueName);

    // Update
    const updated = await updateActivityLocation(
      created.id,
      {
        address: "Jl. Cirengit No. 12",
        radiusMeters: 150,
      },
      managerSession,
    );
    expect(updated.address).toBe("Jl. Cirengit No. 12");
    expect(updated.radiusMeters).toBe(150);

    // Deactivate location (preserves record, sets isActive: false)
    const deactivated = await toggleLocationStatus(
      created.id,
      false,
      managerSession,
    );
    expect(deactivated.isActive).toBe(false);

    // Still retrievable (preserving foreign keys for historical attendances)
    const afterDeactivation = await getActivityLocationById(
      created.id,
      viewerSession,
    );
    expect(afterDeactivation).toBeDefined();
    expect(afterDeactivation?.isActive).toBe(false);
  });
});
