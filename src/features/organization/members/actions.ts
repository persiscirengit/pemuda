"use server";

import { format } from "date-fns";
import { z } from "zod";
import { PERMISSIONS } from "@/lib/permissions";
import { createPermissionActionClient } from "@/lib/safe-action";
import {
  exportMembersToCsv,
  generateMemberCsvTemplate,
  processMemberCsvImport,
} from "@/server/dal/organization/member-csv";
import {
  createMember,
  deleteMember,
  markMemberAgeLimitInactive,
  provisionMemberAccount,
  resetMemberPassword,
  updateMember,
} from "@/server/dal/organization/members";

const createMemberClient = createPermissionActionClient(
  PERMISSIONS.ORGANIZATION_MEMBERS_CREATE,
);

const updateMemberClient = createPermissionActionClient(
  PERMISSIONS.ORGANIZATION_MEMBERS_UPDATE,
);

const deleteMemberClient = createPermissionActionClient(
  PERMISSIONS.ORGANIZATION_MEMBERS_DELETE,
);

const accountsMemberClient = createPermissionActionClient(
  PERMISSIONS.ORGANIZATION_MEMBERS_ACCOUNTS,
);

const importMemberClient = createPermissionActionClient(
  PERMISSIONS.ORGANIZATION_MEMBERS_IMPORT,
);

const exportMemberClient = createPermissionActionClient(
  PERMISSIONS.ORGANIZATION_MEMBERS_EXPORT,
);

const memberIdSchema = z.object({
  id: z.string().uuid(),
});

const memberStatusEnum = z.enum(["active", "inactive", "alumni", "moved"]);
const inactiveReasonEnum = z.enum([
  "rarely_active",
  "resigned",
  "age_limit",
  "transferred_to_persis",
  "moved_domicile",
  "other",
]);

const createMemberSchema = z.object({
  fullName: z.string().min(1, { message: "Full name is required" }).max(150),
  memberNumber: z.string().max(50).optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  email: z.string().max(255).optional().nullable(),
  departmentId: z.string().uuid().optional().nullable(),
  positionId: z.string().uuid().optional().nullable(),
  address: z.string().optional().nullable(),
  profilePhoto: z.string().max(255).optional().nullable(),
  joinedAt: z.string().optional().nullable(),
  birthDate: z.string().optional().nullable(),
  memberStatus: memberStatusEnum.optional(),
  inactiveReason: inactiveReasonEnum.optional().nullable(),
  inactiveAt: z.string().optional().nullable(),
  statusNotes: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const updateMemberSchema = z.object({
  id: z.string().uuid(),
  fullName: z
    .string()
    .min(1, { message: "Full name is required" })
    .max(150)
    .optional(),
  memberNumber: z.string().max(50).optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  email: z.string().max(255).optional().nullable(),
  departmentId: z.string().uuid().optional().nullable(),
  positionId: z.string().uuid().optional().nullable(),
  address: z.string().optional().nullable(),
  profilePhoto: z.string().max(255).optional().nullable(),
  joinedAt: z.string().optional().nullable(),
  birthDate: z.string().optional().nullable(),
  memberStatus: memberStatusEnum.optional(),
  inactiveReason: inactiveReasonEnum.optional().nullable(),
  inactiveAt: z.string().optional().nullable(),
  statusNotes: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const provisionAccountSchema = z.object({
  memberId: z.string().uuid(),
  email: z.string().email().max(255),
  username: z.string().max(50).optional().nullable(),
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters" }),
  roleIds: z.array(z.string().uuid()).optional(),
});

const resetPasswordSchema = z.object({
  memberId: z.string().uuid(),
  newPassword: z
    .string()
    .min(8, { message: "Password must be at least 8 characters" }),
});

export const createMemberAction = createMemberClient
  .inputSchema(createMemberSchema)
  .action(async ({ parsedInput, ctx }) => {
    return await createMember(parsedInput, {
      session: ctx.session,
      user: ctx.user,
    });
  });

export const updateMemberAction = updateMemberClient
  .inputSchema(updateMemberSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { id, ...data } = parsedInput;
    return await updateMember(id, data, {
      session: ctx.session,
      user: ctx.user,
    });
  });

export const deleteMemberAction = deleteMemberClient
  .inputSchema(memberIdSchema)
  .action(async ({ parsedInput, ctx }) => {
    return await deleteMember(parsedInput.id, {
      session: ctx.session,
      user: ctx.user,
    });
  });

export const transitionAgeLimitAction = updateMemberClient
  .inputSchema(memberIdSchema)
  .action(async ({ parsedInput, ctx }) => {
    return await markMemberAgeLimitInactive(parsedInput.id, {
      session: ctx.session,
      user: ctx.user,
    });
  });

export const provisionAccountAction = accountsMemberClient
  .inputSchema(provisionAccountSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { memberId, ...input } = parsedInput;
    return await provisionMemberAccount(memberId, input, {
      session: ctx.session,
      user: ctx.user,
    });
  });

export const resetPasswordAction = accountsMemberClient
  .inputSchema(resetPasswordSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { memberId, ...input } = parsedInput;
    return await resetMemberPassword(memberId, input, {
      session: ctx.session,
      user: ctx.user,
    });
  });

const importMembersCsvSchema = z.object({
  csvContent: z.string().min(1, { message: "CSV content is required" }),
  dryRun: z.boolean().optional(),
});

export const importMembersCsvAction = importMemberClient
  .inputSchema(importMembersCsvSchema)
  .action(async ({ parsedInput, ctx }) => {
    return await processMemberCsvImport(parsedInput.csvContent, {
      dryRun: parsedInput.dryRun,
      sessionOverride: {
        session: ctx.session,
        user: ctx.user,
      },
    });
  });

export const getMemberCsvTemplateAction = importMemberClient.action(
  async () => {
    return generateMemberCsvTemplate();
  },
);

const exportMembersCsvSchema = z.object({
  search: z.string().optional(),
  departmentId: z.string().uuid().optional(),
  positionId: z.string().uuid().optional(),
  memberStatus: z.enum(["active", "inactive", "alumni", "moved"]).optional(),
  ageLimitDue: z.boolean().optional(),
});

export const exportMembersCsvAction = exportMemberClient
  .inputSchema(exportMembersCsvSchema)
  .action(async ({ parsedInput, ctx }) => {
    const csv = await exportMembersToCsv(parsedInput, {
      sessionOverride: {
        session: ctx.session,
        user: ctx.user,
      },
    });
    return {
      csv,
      filename: `members-export-${format(new Date(), "yyyy-MM-dd")}.csv`,
    };
  });
