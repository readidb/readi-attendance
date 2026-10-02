import { FLEXIBLE_SCHEDULES, SEOUL_TIME_ZONE } from "@/lib/constants";

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
  externalMeal: boolean,
  internalMeal = false,
  weekendHoliday = false,
): number {
  const matched = FLEXIBLE_SCHEDULES.find((item) => item === schedule);
  if (!matched || !isTime(endTime)) return 0;
  const baseTime = weekendHoliday ? matched.slice(0, 5) : matched.slice(-5);
  const [baseHour, baseMinute] = baseTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);
  const minutes = endHour * 60 + endMinute - (baseHour * 60 + baseMinute);
  const roundedHours = Math.floor(Math.max(0, minutes) / 60);
  return Math.max(0, roundedHours - (externalMeal ? 1 : internalMeal ? 0.5 : 0));
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

export function weekBounds(isoDate: string): { start: string; end: string } | null {
  if (!isIsoDate(isoDate)) return null;
  const date = new Date(`${isoDate}T00:00:00Z`);
  const mondayOffset = (date.getUTCDay() + 6) % 7;
  const monday = new Date(date);
  monday.setUTCDate(date.getUTCDate() - mondayOffset);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return {
    start: monday.toISOString().slice(0, 10),
    end: sunday.toISOString().slice(0, 10),
  };
}

export function nearestFlexibleSchedule(date = new Date()): string {
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: SEOUL_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  const [hour, minute] = time.split(":").map(Number);
  const currentMinutes = hour * 60 + minute;
  return FLEXIBLE_SCHEDULES.reduce((closest, schedule) => {
    const [scheduleHour, scheduleMinute] = schedule.slice(0, 5).split(":").map(Number);
    const [closestHour, closestMinute] = closest.slice(0, 5).split(":").map(Number);
    const scheduleDistance = Math.abs(scheduleHour * 60 + scheduleMinute - currentMinutes);
    const closestDistance = Math.abs(closestHour * 60 + closestMinute - currentMinutes);
    return scheduleDistance < closestDistance ? schedule : closest;
  }, FLEXIBLE_SCHEDULES[0]);
}
