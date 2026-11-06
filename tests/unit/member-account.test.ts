import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { PERMISSIONS } from "@/lib/permissions";
import { UnauthorizedError } from "@/server/dal/auth";

interface MockUser {
  id: string;
  memberId: string | null;
  name: string;
  email: string;
  username: string | null;
  emailVerified: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface MockAccount {
  id: string;
  userId: string;
  accountId: string;
  providerId: string;
  password: string;
  createdAt: Date;
  updatedAt: Date;
}

interface MockSession {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
}

interface MockUserRole {
  userId: string;
  roleId: string;
}

const { mockAuthState } = vi.hoisted(() => ({
  mockAuthState: {
    members: [
      { id: "mem-1", fullName: "Ahmad Fauzi", email: "ahmad@pemuda.local" },
    ],
    users: [] as MockUser[],
    accounts: [] as MockAccount[],
    sessions: [] as MockSession[],
    userRoles: [] as MockUserRole[],
  },
}));

vi.mock("@/db", () => {
  return {
    db: {
      select: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockImplementation((table) => {
          const tableName = table?.[Symbol.for("drizzle:Name")] || "";
          return {
            where: vi.fn().mockImplementation(() => {
              if (tableName === "users") {
                const p = Promise.resolve(mockAuthState.users);
                return Object.assign(p, {
                  limit: (n: number) =>
                    Promise.resolve(mockAuthState.users.slice(0, n)),
                });
              }
              if (tableName === "members") {
                const p = Promise.resolve(mockAuthState.members);
                return Object.assign(p, {
                  limit: (n: number) =>
                    Promise.resolve(mockAuthState.members.slice(0, n)),
                });
              }
              if (tableName === "accounts") {
                const p = Promise.resolve(mockAuthState.accounts);
                return Object.assign(p, {
                  limit: (n: number) =>
                    Promise.resolve(mockAuthState.accounts.slice(0, n)),
                });
              }
              return Promise.resolve([]);
            }),
          };
        }),
      })),
      insert: vi.fn().mockImplementation((table) => {
        const tableName = table?.[Symbol.for("drizzle:Name")] || "";
        return {
          values: vi.fn().mockImplementation((values) => {
            if (tableName === "users") {
              const u = {
                id: values.id || "018d0000-0000-7000-8000-000000000099",
                createdAt: new Date(),
                updatedAt: new Date(),
                ...values,
              };
              mockAuthState.users.push(u);
              const p = Promise.resolve([u]);
              return Object.assign(p, {
                returning: vi.fn().mockResolvedValue([u]),
              });
            }
            if (tableName === "accounts") {
              const a = {
                id: values.id || "018d0000-0000-7000-8000-000000000098",
                createdAt: new Date(),
                updatedAt: new Date(),
                ...values,
              };
              mockAuthState.accounts.push(a);
              const p = Promise.resolve([a]);
              return Object.assign(p, {
                returning: vi.fn().mockResolvedValue([a]),
              });
            }
            if (tableName === "user_roles") {
              const items = Array.isArray(values) ? values : [values];
              for (const item of items) {
                mockAuthState.userRoles.push(item);
              }
              return Promise.resolve(items);
            }
            return Promise.resolve([values]);
          }),
        };
      }),
      update: vi.fn().mockImplementation((table) => {
        const tableName = table?.[Symbol.for("drizzle:Name")] || "";
        return {
          set: vi.fn().mockImplementation((values) => ({
            where: vi.fn().mockImplementation(() => {
              if (tableName === "accounts") {
                if (mockAuthState.accounts[0]) {
                  mockAuthState.accounts[0] = {
                    ...mockAuthState.accounts[0],
                    ...values,
                  };
                }
                const p = Promise.resolve([mockAuthState.accounts[0]]);
                return Object.assign(p, {
                  returning: vi
                    .fn()
                    .mockResolvedValue([mockAuthState.accounts[0]]),
                });
              }
              return Promise.resolve([values]);
            }),
          })),
        };
      }),
      delete: vi.fn().mockImplementation((table) => {
        const tableName = table?.[Symbol.for("drizzle:Name")] || "";
        return {
          where: vi.fn().mockImplementation(() => {
            if (tableName === "sessions") {
              mockAuthState.sessions = [];
              return Promise.resolve([]);
            }
            return Promise.resolve([]);
          }),
        };
      }),
    },
  };
});

import {
  provisionMemberAccount,
  resetMemberPassword,
} from "@/server/dal/organization/members";

describe("Member Account Provisioning & Password Management", () => {
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
            PERMISSIONS.ORGANIZATION_MEMBERS_ACCOUNTS,
          ],
        },
      ],
    },
  };

  beforeEach(() => {
    mockAuthState.users = [];
    mockAuthState.accounts = [];
    mockAuthState.sessions = [
      {
        id: "sess-1",
        userId: "018d0000-0000-7000-8000-000000000099",
        token: "active-session-token",
        expiresAt: new Date(Date.now() + 3600000),
      },
    ];
    mockAuthState.userRoles = [];
  });

  it("provisions member user account with password hashing and role assignments", async () => {
    const user = await provisionMemberAccount(
      "mem-1",
      {
        email: "ahmad@pemuda.local",
        username: "ahmadfauzi",
        password: "SuperSecretPassword123!",
        roleIds: ["role-member-id"],
      },
      adminSession,
    );

    expect(user.id).toBeDefined();
    expect(user.email).toBe("ahmad@pemuda.local");
    expect(user.memberId).toBe("mem-1");

    // Check account record created with hashed password
    expect(mockAuthState.accounts.length).toBe(1);
    expect(mockAuthState.accounts[0]?.password).not.toBe(
      "SuperSecretPassword123!",
    );
    expect(mockAuthState.accounts[0]?.password.length).toBeGreaterThan(20);

    // Check user_roles assigned
    expect(mockAuthState.userRoles.length).toBe(1);
    expect(mockAuthState.userRoles[0]?.roleId).toBe("role-member-id");
  });

  it("resets member password and invalidates active sessions", async () => {
    // Setup existing account
    mockAuthState.users = [
      {
        id: "018d0000-0000-7000-8000-000000000099",
        memberId: "mem-1",
        name: "Ahmad Fauzi",
        email: "ahmad@pemuda.local",
        username: "ahmadfauzi",
        emailVerified: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    mockAuthState.accounts = [
      {
        id: "acc-1",
        userId: "018d0000-0000-7000-8000-000000000099",
        accountId: "ahmad@pemuda.local",
        providerId: "credential",
        password: "old-hashed-password",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const result = await resetMemberPassword(
      "mem-1",
      {
        newPassword: "BrandNewPassword456!",
      },
      adminSession,
    );

    expect(result.success).toBe(true);
    expect(mockAuthState.accounts[0]?.password).not.toBe("old-hashed-password");
    expect(mockAuthState.accounts[0]?.password).not.toBe(
      "BrandNewPassword456!",
    );

    // Sessions invalidated
    expect(mockAuthState.sessions.length).toBe(0);
  });

  it("enforces requirePermission(PERMISSIONS.ORGANIZATION_MEMBERS_ACCOUNTS)", async () => {
    const unauthorizedSession = {
      session: {
        id: "s-unauth",
        userId: "u-unauth",
        token: "tok",
        expiresAt: new Date(),
      },
      user: {
        id: "u-unauth",
        name: "Standard Member",
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

    await expect(
      provisionMemberAccount(
        "mem-1",
        {
          email: "test@pemuda.local",
          password: "Password123!",
        },
        unauthorizedSession,
      ),
    ).rejects.toThrow(UnauthorizedError);

    await expect(
      resetMemberPassword(
        "mem-1",
        { newPassword: "Password123!" },
        unauthorizedSession,
      ),
    ).rejects.toThrow(UnauthorizedError);
  });
});
