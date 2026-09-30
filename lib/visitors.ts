import "server-only";

import { listRecords, selectName } from "@/lib/airtable";
import {
  VISITOR_BASE_ID,
  VISITOR_FIELDS,
  VISITOR_TABLES,
} from "@/lib/constants";
import type { AirtableRecord, VisitorHost, VisitorReservation } from "@/lib/types";

export function visitorAirtableToken(): string {
  const token = process.env.VISITOR_AIRTABLE_TOKEN || process.env.AIRTABLE_TOKEN;
  if (!token) throw new Error("방문자 Airtable 토큰이 설정되지 않았습니다.");
  return token;
}

function text(value: unknown): string {
  return value == null ? "" : String(value);
}

function linkedRecordIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item === "string") return item ? [item] : [];
    if (item && typeof item === "object" && "id" in item) {
      const id = String((item as { id?: unknown }).id || "");
      return id ? [id] : [];
    }
    return [];
  });
}

function dateTimeParts(value: unknown): { date: string; time: string } {
  if (typeof value !== "string" || !value) return { date: "", time: "" };
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return { date: "", time: "" };
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value || "";
  return {
    date: `${part("year")}-${part("month")}-${part("day")}`,
    time: `${part("hour")}:${part("minute")}`,
  };
}

function mapHost(record: AirtableRecord): VisitorHost {
  const fields = record.fields;
  return {
    recordId: record.id,
    employeeNo: Number(fields[VISITOR_FIELDS.master.employeeNo] || 0),
    name: text(fields[VISITOR_FIELDS.master.name]),
    department: selectName(fields[VISITOR_FIELDS.master.department]),
    position: selectName(fields[VISITOR_FIELDS.master.position]),
    phone: text(fields[VISITOR_FIELDS.master.phone]),
  };
}

function mapReservation(
  record: AirtableRecord,
  hostsById: Map<string, VisitorHost>,
): VisitorReservation {
  const fields = record.fields;
  const hostRecordIds = linkedRecordIds(fields[VISITOR_FIELDS.reservations.host]);
  const hosts = hostRecordIds.flatMap((id) => {
    const host = hostsById.get(id);
    return host ? [host] : [];
  });
  const { date, time } = dateTimeParts(fields[VISITOR_FIELDS.reservations.visitAt]);
  return {
    id: record.id,
    reservationNo: text(fields[VISITOR_FIELDS.reservations.reservationNo]),
    visitDate: date,
    visitTime: time,
    location: text(fields[VISITOR_FIELDS.reservations.location]),
    department: text(fields[VISITOR_FIELDS.reservations.department]),
    hostRecordIds,
    hostNames: hosts.map((host) => host.name),
    hostPhones: hosts.map((host) => host.phone).filter(Boolean),
    company: text(fields[VISITOR_FIELDS.reservations.company]),
    vehicleNo: text(fields[VISITOR_FIELDS.reservations.vehicleNo]),
    headcount: Number(fields[VISITOR_FIELDS.reservations.headcount] || 0),
    purpose: text(fields[VISITOR_FIELDS.reservations.purpose]),
    note: text(fields[VISITOR_FIELDS.reservations.note]),
    appliedDate: text(fields[VISITOR_FIELDS.reservations.appliedDate]),
    cancelled: fields[VISITOR_FIELDS.reservations.cancelled] === true,
  };
}

export async function getVisitorHosts(): Promise<VisitorHost[]> {
  const records = await listRecords(VISITOR_TABLES.master, {
    baseId: VISITOR_BASE_ID,
    token: visitorAirtableToken(),
    maxRecords: 200,
    sortField: VISITOR_FIELDS.master.name,
    sortDirection: "asc",
  });
  return records.map(mapHost).filter((host) => host.employeeNo && host.name);
}

export async function getVisitorReservations(hosts?: VisitorHost[]): Promise<VisitorReservation[]> {
  const resolvedHosts = hosts || await getVisitorHosts();
  const hostsById = new Map(resolvedHosts.map((host) => [host.recordId, host]));
  const records = await listRecords(VISITOR_TABLES.reservations, {
    baseId: VISITOR_BASE_ID,
    token: visitorAirtableToken(),
    sortField: VISITOR_FIELDS.reservations.visitAt,
    sortDirection: "asc",
  });
  return records.map((record) => mapReservation(record, hostsById));
}

export async function getTodayVisitorCount(employeeNo: number, today: string): Promise<number> {
  const hosts = await getVisitorHosts();
  const currentHost = hosts.find((host) => host.employeeNo === employeeNo);
  if (!currentHost) return 0;
  const reservations = await getVisitorReservations(hosts);
  return reservations.filter((item) => !item.cancelled && item.hostRecordIds.includes(currentHost.recordId) && item.visitDate === today).length;
}
