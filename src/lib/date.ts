import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";

export const DEFAULT_TIMEZONE = "Asia/Jakarta";

function toJakartaDate(date: Date | string): TZDate {
  return typeof date === "string"
    ? new TZDate(date, DEFAULT_TIMEZONE)
    : new TZDate(date, DEFAULT_TIMEZONE);
}

export function formatDate(
  date: Date | string,
  pattern = "yyyy-MM-dd",
): string {
  const tzDate = toJakartaDate(date);
  return format(tzDate, pattern);
}

export function formatDateTime(
  date: Date | string,
  pattern = "yyyy-MM-dd HH:mm:ss",
): string {
  const tzDate = toJakartaDate(date);
  return format(tzDate, pattern);
}

export function formatTime(date: Date | string, pattern = "HH:mm:ss"): string {
  const tzDate = toJakartaDate(date);
  return format(tzDate, pattern);
}

export function parseJakartaDateTime(dateStr: string, timeStr: string): Date {
  const [yearStr, monthStr, dayStr] = dateStr.trim().split(/[-/]/);
  const [hourStr, minuteStr, secondStr] = timeStr.trim().split(":");

  if (!yearStr || !monthStr || !dayStr || !hourStr) {
    throw new Error(
      `Invalid date or time string: date="${dateStr}", time="${timeStr}"`,
    );
  }

  const year = Number.parseInt(yearStr, 10);
  const month = Number.parseInt(monthStr, 10);
  const day = Number.parseInt(dayStr, 10);
  const hour = Number.parseInt(hourStr, 10);
  const minute = minuteStr ? Number.parseInt(minuteStr, 10) : 0;
  const second = secondStr ? Number.parseInt(secondStr, 10) : 0;

  if (
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    Number.isNaN(day) ||
    Number.isNaN(hour) ||
    Number.isNaN(minute) ||
    Number.isNaN(second)
  ) {
    throw new Error(
      `Invalid date or time string: date="${dateStr}", time="${timeStr}"`,
    );
  }

  const tzDate = new TZDate(
    year,
    month - 1,
    day,
    hour,
    minute,
    second,
    DEFAULT_TIMEZONE,
  );

  return new Date(tzDate.getTime());
}

export function getJakartaNow(): Date {
  return new TZDate(new Date(), DEFAULT_TIMEZONE);
}
