import { describe, expect, it } from "vitest";
import {
  formatDate,
  formatDateTime,
  formatTime,
  getJakartaNow,
  parseJakartaDateTime,
} from "@/lib/date";

describe("Jakarta Date & Time Presentation Utilities", () => {
  it("formats UTC ISO string into Jakarta date representation (UTC+7)", () => {
    // 2026-11-05 at 18:00 UTC is 2026-11-06 at 01:00 in Asia/Jakarta
    const utcIso = "2026-11-05T18:00:00.000Z";
    expect(formatDate(utcIso)).toBe("2026-11-06");
  });

  it("supports custom date patterns in formatDate", () => {
    const utcIso = "2026-11-05T18:00:00.000Z";
    expect(formatDate(utcIso, "dd/MM/yyyy")).toBe("06/11/2026");
  });

  it("formats UTC ISO string into Jakarta datetime representation", () => {
    // 2026-11-05 at 08:30:45 UTC is 15:30:45 in Asia/Jakarta
    const utcIso = "2026-11-05T08:30:45.000Z";
    expect(formatDateTime(utcIso)).toBe("2026-11-05 15:30:45");
  });

  it("formats UTC ISO string into Jakarta time representation", () => {
    // 2026-11-05 at 00:00:00 UTC is 07:00:00 in Asia/Jakarta
    const utcIso = "2026-11-05T00:00:00.000Z";
    expect(formatTime(utcIso)).toBe("07:00:00");
  });

  it("works with native Date objects", () => {
    const date = new Date("2026-11-05T00:00:00.000Z");
    expect(formatDate(date)).toBe("2026-11-05");
    expect(formatTime(date)).toBe("07:00:00");
  });

  it("parses local Jakarta input strings into UTC Date objects (24-hour formats)", () => {
    // 14:30 Jakarta is 07:30 UTC
    const parsed = parseJakartaDateTime("2026-11-05", "14:30");
    expect(parsed.toISOString()).toBe("2026-11-05T07:30:00.000Z");
  });

  it("handles seamless day transitions across midnight in 24-hour parsing", () => {
    // 02:00 Jakarta on Nov 5 is 19:00 UTC on Nov 4
    const parsedMidnight = parseJakartaDateTime("2026-11-05", "02:00");
    expect(parsedMidnight.toISOString()).toBe("2026-11-04T19:00:00.000Z");

    // 23:59:59 Jakarta on Nov 5 is 16:59:59 UTC on Nov 5
    const parsedLate = parseJakartaDateTime("2026-11-05", "23:59:59");
    expect(parsedLate.toISOString()).toBe("2026-11-05T16:59:59.000Z");
  });

  it("throws descriptive error on invalid date or time input strings", () => {
    expect(() => parseJakartaDateTime("invalid-date", "14:00")).toThrow();
    expect(() => parseJakartaDateTime("2026-11-05", "invalid-time")).toThrow();
  });

  it("getJakartaNow returns a valid Date instance", () => {
    const now = getJakartaNow();
    expect(now).toBeInstanceOf(Date);
    expect(Number.isNaN(now.getTime())).toBe(false);
  });
});
