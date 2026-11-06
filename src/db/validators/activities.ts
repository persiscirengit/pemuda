import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import {
  activities,
  activityLocations,
  agendaSchedules,
  agendaWeeklyTopics,
  attendanceRecords,
} from "@/db/schema/activities";

export const insertActivityLocationSchema =
  createInsertSchema(activityLocations);
export const selectActivityLocationSchema =
  createSelectSchema(activityLocations);

export const insertAgendaScheduleSchema = createInsertSchema(agendaSchedules);
export const selectAgendaScheduleSchema = createSelectSchema(agendaSchedules);

export const insertAgendaWeeklyTopicSchema =
  createInsertSchema(agendaWeeklyTopics);
export const selectAgendaWeeklyTopicSchema =
  createSelectSchema(agendaWeeklyTopics);

export const insertActivitySchema = createInsertSchema(activities);
export const selectActivitySchema = createSelectSchema(activities);

export const insertAttendanceRecordSchema =
  createInsertSchema(attendanceRecords);
export const selectAttendanceRecordSchema =
  createSelectSchema(attendanceRecords);
