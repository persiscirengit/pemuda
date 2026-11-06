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

const { mockLifecycleMembersState } = vi.hoisted(() => ({
  mockLifecycleMembersState: { items: [] as MockMember[] },
}));

vi.mock("@/db", () => {
  return {
    db: {
      select: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockImplementation(() => {
          const getItems = () => mockLifecycleMembersState.items;
          const p = Promise.resolve(getItems());
          return Object.assign(p, {
            leftJoin: vi.fn().mockReturnThis(),
            orderBy: () => Promise.resolve(getItems()),
            where: vi.fn().mockImplementation(() => {
              const pSub = Promise.resolve(mockLifecycleMembersState.items);
              return Object.assign(pSub, {
                limit: (n: number) =>
                  Promise.resolve(mockLifecycleMembersState.items.slice(0, n)),
                orderBy: () => Promise.resolve(mockLifecycleMembersState.items),
              });
            }),
          });
        }),
      })),
      update: vi.fn().mockImplementation(() => ({
        set: vi.fn().mockImplementation((values) => ({
          where: vi.fn().mockImplementation(() => {
            const target = mockLifecycleMembersState.items[0];
            const updated = { ...target, ...values, updatedAt: new Date() };
            mockLifecycleMembersState.items[0] = updated;
            const p = Promise.resolve([updated]);
            return Object.assign(p, {
              returning: vi.fn().mockResolvedValue([updated]),
            });
          }),
        })),
      })),
    },
  };
});

import {
  calculateAge,
  isAgeLimitDue,
  markMemberAgeLimitInactive,
} from "@/server/dal/organization/members";

describe("Member Lifecycle & 41-Year Age-Limit Transitions", () => {
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
            PERMISSIONS.ORGANIZATION_MEMBERS_UPDATE,
          ],
        },
      ],
    },
  };

  beforeEach(() => {
    mockLifecycleMembersState.items = [
      {
        id: "mem-senior",
        departmentId: null,
        positionId: null,
        fullName: "Senior Member",
        memberNumber: "10.05.099",
        phone: "+6281234567899",
        email: "senior@pemuda.local",
        address: null,
        profilePhoto: null,
        joinedAt: "2010-01-01",
        birthDate: "1985-05-15", // 41 in 2026
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

  describe("Dynamic Age Calculation & Flagging", () => {
    const referenceDate = new Date("2026-11-06");

    it("calculates member age correctly in years", () => {
      expect(calculateAge("1985-05-15", referenceDate)).toBe(41);
      expect(calculateAge("1986-12-01", referenceDate)).toBe(39);
      expect(calculateAge("1985-11-07", referenceDate)).toBe(40);
      expect(calculateAge("1985-11-05", referenceDate)).toBe(41);
      expect(calculateAge(null, referenceDate)).toBeNull();
    });

    it("flags ageLimitDue true for age >= 41 and false otherwise", () => {
      // 41 years old -> true
      expect(isAgeLimitDue("1985-05-15", referenceDate)).toBe(true);
      // 40 years old -> false
      expect(isAgeLimitDue("1985-11-07", referenceDate)).toBe(false);
      // 25 years old -> false
      expect(isAgeLimitDue("2001-01-01", referenceDate)).toBe(false);
      // Missing birth date -> false
      expect(isAgeLimitDue(null, referenceDate)).toBe(false);
    });
  });

  describe("markMemberAgeLimitInactive Workflow", () => {
    it("transitions member to inactive with 'age_limit' reason and inactive date", async () => {
      const updated = await markMemberAgeLimitInactive(
        "mem-senior",
        adminSession,
      );

      expect(updated.memberStatus).toBe("inactive");
      expect(updated.inactiveReason).toBe("age_limit");
      expect(updated.inactiveAt).toBeDefined();
    });

    it("enforces requirePermission(PERMISSIONS.ORGANIZATION_MEMBERS_UPDATE)", async () => {
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

      await expect(
        markMemberAgeLimitInactive("mem-senior", unauthorizedSession),
      ).rejects.toThrow(UnauthorizedError);
    });
  });
});
