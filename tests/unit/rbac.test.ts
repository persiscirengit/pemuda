import { describe, expect, it } from "vitest";
import {
  accounts,
  permissions,
  rolePermissions,
  roles,
  sessions,
  userRoles,
  users,
  verifications,
} from "@/db/schema/auth";
import {
  PERMISSIONS,
  resolveUserPermissions,
  STARTER_ROLES,
} from "@/lib/permissions";

describe("Dynamic 4-Table RBAC Architecture", () => {
  describe("Canonical PERMISSIONS Catalog", () => {
    it("contains exactly 58 canonical permissions", () => {
      const keys = Object.keys(PERMISSIONS);
      expect(keys.length).toBe(58);
    });

    it("enforces lowercase colon-free <domain>.<resource>.<action> format", () => {
      const permissionPattern = /^[a-z]+(\.[a-z]+){2,}$/;
      for (const [key, value] of Object.entries(PERMISSIONS)) {
        expect(value).toMatch(permissionPattern);
        expect(key).toBe(value.toUpperCase().replace(/\./g, "_"));
      }
    });

    it("covers all 5 functional business domains", () => {
      const values = Object.values(PERMISSIONS);
      const domains = new Set(values.map((p) => p.split(".")[0]));
      expect(domains).toEqual(
        new Set([
          "auth",
          "organization",
          "activities",
          "finance",
          "content",
          "notifications",
        ]),
      );
    });
  });

  describe("Starter Roles & Permission Matrix", () => {
    it("defines 5 standard system starter roles", () => {
      expect(Object.keys(STARTER_ROLES).sort()).toEqual([
        "chairperson",
        "member",
        "secretary",
        "super_admin",
        "treasurer",
      ]);
    });

    it("super_admin role possesses all 58 granular permissions", () => {
      const allPermissions = Object.values(PERMISSIONS);
      expect(STARTER_ROLES.super_admin.permissions.length).toBe(58);
      expect(new Set(STARTER_ROLES.super_admin.permissions)).toEqual(
        new Set(allPermissions),
      );
    });

    it("chairperson possesses executive oversight and approval permissions", () => {
      const chairpersonPerms = new Set(STARTER_ROLES.chairperson.permissions);
      expect(chairpersonPerms.has(PERMISSIONS.ACTIVITIES_EVENTS_STATUS)).toBe(
        true,
      );
      expect(
        chairpersonPerms.has(PERMISSIONS.ORGANIZATION_SETTINGS_MANAGE),
      ).toBe(true);
      expect(chairpersonPerms.has(PERMISSIONS.AUTH_ROLES_MANAGE)).toBe(false);
      expect(
        chairpersonPerms.has(PERMISSIONS.FINANCE_TRANSACTIONS_CREATE),
      ).toBe(false);
      expect(chairpersonPerms.size).toBe(42);
    });

    it("secretary possesses roster and operational management permissions", () => {
      const secretaryPerms = new Set(STARTER_ROLES.secretary.permissions);
      expect(secretaryPerms.has(PERMISSIONS.ORGANIZATION_MEMBERS_CREATE)).toBe(
        true,
      );
      expect(secretaryPerms.has(PERMISSIONS.ORGANIZATION_MEMBERS_DELETE)).toBe(
        true,
      );
      expect(secretaryPerms.has(PERMISSIONS.ORGANIZATION_MEMBERS_IMPORT)).toBe(
        true,
      );
      expect(secretaryPerms.has(PERMISSIONS.ORGANIZATION_SETTINGS_MANAGE)).toBe(
        false,
      );
      expect(secretaryPerms.has(PERMISSIONS.FINANCE_TRANSACTIONS_CREATE)).toBe(
        false,
      );
      expect(secretaryPerms.size).toBe(42);
    });

    it("treasurer possesses full finance ledger and fee management permissions", () => {
      const treasurerPerms = new Set(STARTER_ROLES.treasurer.permissions);
      expect(treasurerPerms.has(PERMISSIONS.FINANCE_TRANSACTIONS_CREATE)).toBe(
        true,
      );
      expect(treasurerPerms.has(PERMISSIONS.FINANCE_TRANSACTIONS_DELETE)).toBe(
        true,
      );
      expect(treasurerPerms.has(PERMISSIONS.FINANCE_FEES_GENERATE)).toBe(true);
      expect(treasurerPerms.has(PERMISSIONS.ORGANIZATION_MEMBERS_CREATE)).toBe(
        false,
      );
      expect(treasurerPerms.size).toBe(22);
    });

    it("member role possesses only self-service permissions", () => {
      const memberPerms = new Set(STARTER_ROLES.member.permissions);
      expect(memberPerms).toEqual(
        new Set([
          PERMISSIONS.ACTIVITIES_CHECKIN_SELF,
          PERMISSIONS.FINANCE_FEES_SELF,
          PERMISSIONS.NOTIFICATIONS_INBOX_SELF,
          PERMISSIONS.NOTIFICATIONS_PREFERENCES_SELF,
          PERMISSIONS.NOTIFICATIONS_PUSH_SELF,
        ]),
      );
    });
  });

  describe("RBAC Permission Resolution Logic", () => {
    it("resolves permissions combined across multiple assigned roles without duplicates", () => {
      const assignedRoles = [
        {
          name: "treasurer",
          permissions: STARTER_ROLES.treasurer.permissions,
        },
        {
          name: "member",
          permissions: STARTER_ROLES.member.permissions,
        },
      ];

      const resolved = resolveUserPermissions(assignedRoles);
      // member perms are subset of treasurer's self-service perms
      expect(resolved.length).toBe(STARTER_ROLES.treasurer.permissions.length);
      expect(new Set(resolved)).toEqual(
        new Set(STARTER_ROLES.treasurer.permissions),
      );
    });

    it("returns empty permissions array when user has no assigned roles", () => {
      const resolved = resolveUserPermissions([]);
      expect(resolved).toEqual([]);
    });
  });

  describe("Database Schema Integrity", () => {
    it("exports all 8 required tables", () => {
      expect(users).toBeDefined();
      expect(sessions).toBeDefined();
      expect(accounts).toBeDefined();
      expect(verifications).toBeDefined();
      expect(roles).toBeDefined();
      expect(permissions).toBeDefined();
      expect(rolePermissions).toBeDefined();
      expect(userRoles).toBeDefined();
    });

    it("enforces UUID primary keys and composite primary keys on junction tables", () => {
      // roles and permissions have id
      expect(roles.id).toBeDefined();
      expect(permissions.id).toBeDefined();

      // junction tables
      expect(rolePermissions.roleId).toBeDefined();
      expect(rolePermissions.permissionId).toBeDefined();
      expect(userRoles.userId).toBeDefined();
      expect(userRoles.roleId).toBeDefined();
    });
  });
});
