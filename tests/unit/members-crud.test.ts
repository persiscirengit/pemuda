import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { PERMISSIONS } from "@/lib/permissions";
import { UnauthorizedError } from "@/server/dal/auth";

interface MockMember {
  id: string;
  departmentId: string | null;
  positionId: string | null;
  fullName: string;
  memberNumber: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  profilePhoto: string | null;
  joinedAt: string | null;
  birthDate: string | null;
  memberStatus: "active" | "inactive" | "alumni" | "moved";
  inactiveReason: string | null;
  inactiveAt: string | null;
  statusNotes: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface ChunkObject {
  name?: string;
  value?: unknown;
  queryChunks?: unknown[];
}

const { mockMembersState } = vi.hoisted(() => ({
  mockMembersState: { items: [] as MockMember[] },
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

function filterMembers(items: MockMember[], cond: unknown): MockMember[] {
  if (!cond) return [...items];
  const obj = cond as ChunkObject;
  const flat = flattenChunks(obj.queryChunks || []).map(getChunkValue);
  return items.filter((row) => {
    const idIdx = flat.indexOf("id");
    if (idIdx !== -1 && flat[idIdx + 1] === " = ") {
      if (row.id !== flat[idIdx + 2]) return false;
    }
    const notIdIdx = flat.indexOf("id");
    if (notIdIdx !== -1 && flat[notIdIdx + 1] === " <> ") {
      if (row.id === flat[notIdIdx + 2]) return false;
    }
    const npaIdx = flat.indexOf("member_number");
    if (npaIdx !== -1 && flat[npaIdx + 1] === " = ") {
      if (row.memberNumber !== flat[npaIdx + 2]) return false;
    }
    const statusIdx = flat.indexOf("member_status");
    if (statusIdx !== -1 && flat[statusIdx + 1] === " = ") {
      if (row.memberStatus !== flat[statusIdx + 2]) return false;
    }
    return true;
  });
}

vi.mock("@/db", () => {
  return {
    db: {
      select: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockImplementation(() => {
          const getItems = () => mockMembersState.items;
          const basePromise = Promise.resolve(getItems());
          return Object.assign(basePromise, {
            leftJoin: vi.fn().mockReturnThis(),
            orderBy: () => Promise.resolve(getItems()),
            where: (cond: unknown) => {
              const filtered = filterMembers(mockMembersState.items, cond);
              const sub = Promise.resolve(filtered);
              return Object.assign(sub, {
                limit: (n: number) => Promise.resolve(filtered.slice(0, n)),
                orderBy: () => Promise.resolve(filtered),
              });
            },
          });
        }),
      })),
      insert: vi.fn().mockImplementation(() => ({
        values: vi.fn().mockImplementation((values) => {
          const inserted = {
            id: values.id || "018d0000-0000-7000-8000-000000000001",
            createdAt: new Date(),
            updatedAt: new Date(),
            ...values,
          };
          mockMembersState.items.push(inserted);
          const p = Promise.resolve([inserted]);
          return Object.assign(p, {
            returning: vi.fn().mockResolvedValue([inserted]),
          });
        }),
      })),
      update: vi.fn().mockImplementation(() => ({
        set: vi.fn().mockImplementation((values) => ({
          where: vi.fn().mockImplementation((cond) => {
            const matched = filterMembers(mockMembersState.items, cond);
            const target = matched[0] || mockMembersState.items[0];
            const updated = { ...target, ...values, updatedAt: new Date() };
            const idx = mockMembersState.items.findIndex(
              (m) => m.id === target?.id,
            );
            if (idx !== -1) mockMembersState.items[idx] = updated;
            const p = Promise.resolve([updated]);
            return Object.assign(p, {
              returning: vi.fn().mockResolvedValue([updated]),
            });
          }),
        })),
      })),
      delete: vi.fn().mockImplementation(() => ({
        where: vi.fn().mockImplementation((cond) => {
          const matched = filterMembers(mockMembersState.items, cond);
          const target = matched[0] || mockMembersState.items[0];
          mockMembersState.items = mockMembersState.items.filter(
            (m) => m.id !== target?.id,
          );
          const p = Promise.resolve([target]);
          return Object.assign(p, {
            returning: vi.fn().mockResolvedValue([target]),
          });
        }),
      })),
    },
  };
});

import {
  createMember,
  deleteMember,
  getMemberById,
  getMembers,
  updateMember,
} from "@/server/dal/organization/members";

describe("Members Directory DAL & CRUD Governance", () => {
  const adminSession = {
    session: {
      id: "s-admin",
      userId: "u-admin",
      token: "tok",
      expiresAt: new Date(),
    },
    user: {
      id: "u-admin",
      name: "Secretary",
      email: "secretary@pemuda.local",
      emailVerified: true,
      roles: [
        {
          name: "secretary",
          permissions: [
            PERMISSIONS.ORGANIZATION_MEMBERS_READ,
            PERMISSIONS.ORGANIZATION_MEMBERS_CREATE,
            PERMISSIONS.ORGANIZATION_MEMBERS_UPDATE,
            PERMISSIONS.ORGANIZATION_MEMBERS_DELETE,
          ],
        },
      ],
    },
  };

  beforeEach(() => {
    mockMembersState.items = [
      {
        id: "mem-1",
        departmentId: null,
        positionId: null,
        fullName: "Ahmad Fauzi",
        memberNumber: "10.05.001",
        phone: "+6281234567890",
        email: "ahmad.fauzi@pemuda.local",
        address: "Jl. Cirengit No. 1",
        profilePhoto: "uploads/members/photo-1.webp",
        joinedAt: "2020-01-01",
        birthDate: "1995-05-15",
        memberStatus: "active",
        inactiveReason: null,
        inactiveAt: null,
        statusNotes: null,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
  });

  it("enforces 'server-only' import in src/server/dal/organization/members.ts", () => {
    const filePath = path.resolve(
      process.cwd(),
      "src/server/dal/organization/members.ts",
    );
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toMatch(/import\s+['"]server-only['"]/);
  });

  it("creates member and enforces unique NPA (memberNumber)", async () => {
    const created = await createMember(
      {
        fullName: "Budi Santoso",
        memberNumber: "10.05.002",
        phone: "081298765432",
        email: "budi@pemuda.local",
        birthDate: "1998-03-20",
      },
      adminSession,
    );

    expect(created.id).toBeDefined();
    expect(created.fullName).toBe("Budi Santoso");
    expect(created.memberNumber).toBe("10.05.002");

    // Attempt duplicate memberNumber
    await expect(
      createMember(
        {
          fullName: "Budi Clone",
          memberNumber: "10.05.002",
        },
        adminSession,
      ),
    ).rejects.toThrow(/already exists|duplicate/i);
  });

  it("validates phone number formatting when provided", async () => {
    await expect(
      createMember(
        {
          fullName: "Invalid Phone Member",
          phone: "invalid-phone-abc",
        },
        adminSession,
      ),
    ).rejects.toThrow(/invalid.*phone/i);
  });

  it("validates email formatting when provided", async () => {
    await expect(
      createMember(
        {
          fullName: "Invalid Email Member",
          email: "not-an-email",
        },
        adminSession,
      ),
    ).rejects.toThrow(/invalid.*email/i);
  });

  it("updates member information cleanly", async () => {
    const updated = await updateMember(
      "mem-1",
      {
        fullName: "Ahmad Fauzi Updated",
        phone: "+628111222333",
      },
      adminSession,
    );

    expect(updated.fullName).toBe("Ahmad Fauzi Updated");
    expect(updated.phone).toBe("+628111222333");
  });

  it("deletes member successfully", async () => {
    const deleted = await deleteMember("mem-1", adminSession);
    expect(deleted.id).toBe("mem-1");
    expect(mockMembersState.items.length).toBe(0);
  });

  it("enforces permissions on read and mutations", async () => {
    const unauthorizedSession = {
      session: {
        id: "s-unauth",
        userId: "u-unauth",
        token: "tok",
        expiresAt: new Date(),
      },
      user: {
        id: "u-unauth",
        name: "Member Only",
        email: "member@pemuda.local",
        emailVerified: true,
        roles: [
          {
            name: "member",
            permissions: [PERMISSIONS.ACTIVITIES_CHECKIN_SELF],
          },
        ],
      },
    };

    await expect(getMembers({}, unauthorizedSession)).rejects.toThrow(
      UnauthorizedError,
    );
    await expect(getMemberById("mem-1", unauthorizedSession)).rejects.toThrow(
      UnauthorizedError,
    );
    await expect(
      createMember({ fullName: "Forbidden" }, unauthorizedSession),
    ).rejects.toThrow(UnauthorizedError);
    await expect(
      updateMember("mem-1", { fullName: "Forbidden" }, unauthorizedSession),
    ).rejects.toThrow(UnauthorizedError);
    await expect(deleteMember("mem-1", unauthorizedSession)).rejects.toThrow(
      UnauthorizedError,
    );
  });
});
