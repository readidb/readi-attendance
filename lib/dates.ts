import { FLEXIBLE_SCHEDULES } from "@/lib/constants";

export function todayInSeoul(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().startsWith(value);
}

export function isTime(value: unknown): value is string {
  return typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function calculateOvertimeHours(
  schedule: string,
  endTime: string,
  meal: boolean,
): number {
  const matched = FLEXIBLE_SCHEDULES.find((item) => item === schedule);
  if (!matched || !isTime(endTime)) return 0;
  const scheduleEnd = matched.slice(-5);
  const [baseHour, baseMinute] = scheduleEnd.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);
  const minutes = endHour * 60 + endMinute - (baseHour * 60 + baseMinute) - (meal ? 60 : 0);
  return Math.max(0, Math.floor(minutes / 60));
}

export function countWeekdays(start: string, end: string): number {
  if (!isIsoDate(start) || !isIsoDate(end) || start > end) return 0;
  let days = 0;
  const cursor = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (cursor <= last) {
    const weekday = cursor.getUTCDay();
    if (weekday !== 0 && weekday !== 6) days += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

export function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}
