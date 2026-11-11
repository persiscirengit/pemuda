import { z } from "zod";

export const checkInSchema = z.object({
  token: z.string().min(10).max(64),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  locationAccuracy: z.number().nonnegative().optional().nullable(),
  method: z.enum(["qr", "link", "manual"]).default("link"),
});

export type CheckInInput = z.infer<typeof checkInSchema>;

export const leaveRequestSchema = z.object({
  token: z.string().min(10).max(64),
  reason: z
    .string()
    .trim()
    .min(1, "Absence reason is required")
    .max(500, "Maximum 500 characters"),
});

export type LeaveRequestFormInput = z.infer<typeof leaveRequestSchema>;
