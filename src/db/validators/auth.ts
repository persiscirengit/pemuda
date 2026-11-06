import { createInsertSchema, createSelectSchema } from "drizzle-zod";
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

export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);

export const insertSessionSchema = createInsertSchema(sessions);
export const selectSessionSchema = createSelectSchema(sessions);

export const insertAccountSchema = createInsertSchema(accounts);
export const selectAccountSchema = createSelectSchema(accounts);

export const insertVerificationSchema = createInsertSchema(verifications);
export const selectVerificationSchema = createSelectSchema(verifications);

export const insertRoleSchema = createInsertSchema(roles);
export const selectRoleSchema = createSelectSchema(roles);

export const insertPermissionSchema = createInsertSchema(permissions);
export const selectPermissionSchema = createSelectSchema(permissions);

export const insertRolePermissionSchema = createInsertSchema(rolePermissions);
export const selectRolePermissionSchema = createSelectSchema(rolePermissions);

export const insertUserRoleSchema = createInsertSchema(userRoles);
export const selectUserRoleSchema = createSelectSchema(userRoles);
