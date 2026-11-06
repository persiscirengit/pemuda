import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import {
  departments,
  members,
  positions,
  systemSettings,
} from "@/db/schema/organization";

export const insertDepartmentSchema = createInsertSchema(departments);
export const selectDepartmentSchema = createSelectSchema(departments);

export const insertPositionSchema = createInsertSchema(positions);
export const selectPositionSchema = createSelectSchema(positions);

export const insertMemberSchema = createInsertSchema(members);
export const selectMemberSchema = createSelectSchema(members);

export const insertSystemSettingSchema = createInsertSchema(systemSettings);
export const selectSystemSettingSchema = createSelectSchema(systemSettings);
