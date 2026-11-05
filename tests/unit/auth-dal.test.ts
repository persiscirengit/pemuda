import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { PERMISSIONS } from "@/lib/permissions";
import {
  publicQuery,
  requirePermission,
  UnauthenticatedError,
  UnauthorizedError,
} from "@/server/dal/auth";

describe("Data Access Layer (DAL) & Authorization Guard", () => {
  it("enforces 'server-only' import in src/server/dal/auth.ts", () => {
    const filePath = path.resolve(process.cwd(), "src/server/dal/auth.ts");
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toMatch(/import\s+['"]server-only['"]/);
  });

  it("publicQuery succeeds without throwing for unauthenticated caller", async () => {
    await expect(publicQuery()).resolves.toBeUndefined();
  });

  it("requirePermission throws UnauthenticatedError when session is missing", async () => {
    await expect(
      requirePermission(PERMISSIONS.ACTIVITIES_ATTENDANCE_READ, null),
    ).rejects.toThrow(UnauthenticatedError);
  });

  it("requirePermission throws UnauthorizedError when user lacks the permission", async () => {
    const mockSession = {
      session: {
        id: "session-1",
        userId: "user-1",
        token: "tok-1",
        expiresAt: new Date(Date.now() + 60000),
        createdAt: new Date(),
        updatedAt: new Date(),
        ipAddress: null,
        userAgent: null,
      },
      user: {
        id: "user-1",
        name: "Test Member",
        email: "member@pemuda.local",
        emailVerified: true,
        image: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        roles: [
          {
            name: "member",
            permissions: [PERMISSIONS.ACTIVITIES_CHECKIN_SELF],
          },
        ],
      },
    };

    await expect(
      requirePermission(PERMISSIONS.FINANCE_TRANSACTIONS_CREATE, mockSession),
    ).rejects.toThrow(UnauthorizedError);
  });

  it("requirePermission returns user session when user possesses the required permission", async () => {
    const mockSession = {
      session: {
        id: "session-2",
        userId: "user-2",
        token: "tok-2",
        expiresAt: new Date(Date.now() + 60000),
        createdAt: new Date(),
        updatedAt: new Date(),
        ipAddress: null,
        userAgent: null,
      },
      user: {
        id: "user-2",
        name: "Test Treasurer",
        email: "treasurer@pemuda.local",
        emailVerified: true,
        image: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        roles: [
          {
            name: "treasurer",
            permissions: [
              PERMISSIONS.FINANCE_TRANSACTIONS_CREATE,
              PERMISSIONS.FINANCE_TRANSACTIONS_READ,
            ],
          },
        ],
      },
    };

    const resolved = await requirePermission(
      PERMISSIONS.FINANCE_TRANSACTIONS_CREATE,
      mockSession,
    );
    expect(resolved).toEqual(mockSession);
  });
});
