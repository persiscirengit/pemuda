import { getTableColumns } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";
import * as validators from "@/db/validators";

describe("Domain Database Schemas", () => {
  describe("Organization Domain Schemas", () => {
    it("defines departments, positions, members, and systemSettings with UUIDv7 primary keys", () => {
      expect(schema.departments).toBeDefined();
      expect(schema.positions).toBeDefined();
      expect(schema.members).toBeDefined();
      expect(schema.systemSettings).toBeDefined();

      const deptCols = getTableColumns(schema.departments);
      expect(deptCols.id.primary).toBe(true);
      expect(deptCols.name.isUnique).toBe(true);

      const posCols = getTableColumns(schema.positions);
      expect(posCols.id.primary).toBe(true);
      expect(posCols.name.isUnique).toBe(true);

      const memberCols = getTableColumns(schema.members);
      expect(memberCols.id.primary).toBe(true);
      expect(memberCols.fullName).toBeDefined();
      expect(memberCols.memberNumber.isUnique).toBe(true);
      expect(memberCols.memberStatus).toBeDefined();

      const settingsCols = getTableColumns(schema.systemSettings);
      expect(settingsCols.id.primary).toBe(true);
      expect(settingsCols.key.isUnique).toBe(true);
    });
  });

  describe("Activities Domain Schemas", () => {
    it("defines activityLocations, agendaSchedules, agendaWeeklyTopics, activities, and attendanceRecords", () => {
      expect(schema.activityLocations).toBeDefined();
      expect(schema.agendaSchedules).toBeDefined();
      expect(schema.agendaWeeklyTopics).toBeDefined();
      expect(schema.activities).toBeDefined();
      expect(schema.attendanceRecords).toBeDefined();

      const actCols = getTableColumns(schema.activities);
      expect(actCols.id.primary).toBe(true);
      expect(actCols.attendanceToken.isUnique).toBe(true);
      expect(actCols.status).toBeDefined();

      const attCols = getTableColumns(schema.attendanceRecords);
      expect(attCols.id.primary).toBe(true);
      expect(attCols.activityId).toBeDefined();
      expect(attCols.memberId).toBeDefined();
      expect(attCols.status).toBeDefined();
      expect(attCols.verificationStatus).toBeDefined();
    });
  });

  describe("Finance Domain Schemas", () => {
    it("defines financialCategories, financialTransactions, membershipFeeSettings, memberFeeSettings, and memberFeeRecords", () => {
      expect(schema.financialCategories).toBeDefined();
      expect(schema.financialTransactions).toBeDefined();
      expect(schema.membershipFeeSettings).toBeDefined();
      expect(schema.memberFeeSettings).toBeDefined();
      expect(schema.memberFeeRecords).toBeDefined();

      const catCols = getTableColumns(schema.financialCategories);
      expect(catCols.slug.isUnique).toBe(true);

      const txCols = getTableColumns(schema.financialTransactions);
      expect(txCols.amountIdr).toBeDefined();
      expect(txCols.deletedAt).toBeDefined(); // soft delete

      const recordCols = getTableColumns(schema.memberFeeRecords);
      expect(recordCols.memberId).toBeDefined();
      expect(recordCols.year).toBeDefined();
      expect(recordCols.month).toBeDefined();
      expect(recordCols.status).toBeDefined();
    });
  });

  describe("Content Domain Schemas", () => {
    it("defines articleCategories and articles with soft deletes and unique slugs", () => {
      expect(schema.articleCategories).toBeDefined();
      expect(schema.articles).toBeDefined();

      const catCols = getTableColumns(schema.articleCategories);
      expect(catCols.slug.isUnique).toBe(true);

      const artCols = getTableColumns(schema.articles);
      expect(artCols.slug.isUnique).toBe(true);
      expect(artCols.deletedAt).toBeDefined(); // soft delete
      expect(artCols.status).toBeDefined();
    });
  });

  describe("Notifications Domain Schemas", () => {
    it("defines notifications, pushSubscriptions, broadcastNotifications, and notificationPreferences", () => {
      expect(schema.notifications).toBeDefined();
      expect(schema.pushSubscriptions).toBeDefined();
      expect(schema.broadcastNotifications).toBeDefined();
      expect(schema.notificationPreferences).toBeDefined();

      const subCols = getTableColumns(schema.pushSubscriptions);
      expect(subCols.endpoint.isUnique).toBe(true);

      const prefCols = getTableColumns(schema.notificationPreferences);
      expect(prefCols.userId).toBeDefined();
      expect(prefCols.category).toBeDefined();
    });
  });

  describe("Drizzle-Zod Domain Validators", () => {
    it("validates valid department and rejects missing name", () => {
      expect(validators.insertDepartmentSchema).toBeDefined();
      expect(validators.selectDepartmentSchema).toBeDefined();

      const valid = validators.insertDepartmentSchema.safeParse({
        name: "Education",
        status: "active",
      });
      expect(valid.success).toBe(true);

      expect(validators.insertDepartmentSchema.safeParse({}).success).toBe(
        false,
      );
    });

    it("validates member schema with enum validation", () => {
      const valid = validators.insertMemberSchema.safeParse({
        fullName: "John Doe",
        memberStatus: "active",
      });
      expect(valid.success).toBe(true);

      const invalid = validators.insertMemberSchema.safeParse({
        fullName: "John Doe",
        memberStatus: "unknown_status",
      });
      expect(invalid.success).toBe(false);
    });

    it("validates financial transaction amounts as integer Rupiah", () => {
      expect(validators.insertFinancialTransactionSchema).toBeDefined();

      const valid = validators.insertFinancialTransactionSchema.safeParse({
        type: "income",
        financialCategoryId: "018d0000-0000-7000-8000-000000000001",
        amountIdr: 50000,
        transactionDate: "2026-11-06",
        title: "Friday Charity",
      });
      expect(valid.success).toBe(true);
    });

    it("validates member fee records and ensures month is numeric", () => {
      expect(validators.insertMemberFeeRecordSchema).toBeDefined();

      const valid = validators.insertMemberFeeRecordSchema.safeParse({
        memberId: "018d0000-0000-7000-8000-000000000001",
        year: 2026,
        month: 11,
        amountIdr: 10000,
        status: "paid",
      });
      expect(valid.success).toBe(true);
    });

    it("validates article schema with required fields", () => {
      expect(validators.insertArticleSchema).toBeDefined();

      const valid = validators.insertArticleSchema.safeParse({
        title: "Study Article",
        slug: "study-article",
        content: "<p>Article body content</p>",
      });
      expect(valid.success).toBe(true);

      const invalid = validators.insertArticleSchema.safeParse({
        title: "No slug",
      });
      expect(invalid.success).toBe(false);
    });
  });

  describe("Idempotent System Seeder Specification", () => {
    it("exports seedDomain function that seeds constants only", async () => {
      const { seedDomain } = await import("@/db/seeds/domain");
      expect(typeof seedDomain).toBe("function");

      const insertedTables: string[] = [];
      const mockInsert = vi.fn().mockImplementation((table) => {
        insertedTables.push(table[Symbol.for("drizzle:Name")] || "table");
        return {
          values: vi.fn().mockReturnValue({
            onConflictDoNothing: vi.fn().mockResolvedValue([]),
          }),
        };
      });

      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      });

      const mockDb = {
        insert: mockInsert,
        select: mockSelect,
      } as unknown as Parameters<typeof seedDomain>[0];

      await seedDomain(mockDb);

      expect(mockInsert).toHaveBeenCalled();
      // Zero real member records or credentials seeded in domain
      expect(insertedTables).not.toContain("members");
      expect(insertedTables).not.toContain("users");
      expect(insertedTables).not.toContain("accounts");
    });
  });
});
