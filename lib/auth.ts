import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { FIELDS, TABLES } from "@/lib/constants";
import { formulaString, getRecord, listRecords, selectName } from "@/lib/airtable";
import type { Employee } from "@/lib/types";

const COOKIE_NAME = "readi_session";
const SESSION_SECONDS = 60 * 60 * 24 * 14;

interface SessionPayload {
  employeeRecordId: string;
  expiresAt: number;
}

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("SESSION_SECRET은 32자 이상이어야 합니다.");
  return value;
}

function sign(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

function encodeSession(payload: SessionPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

function decodeSession(value: string): SessionPayload | null {
  const [encoded, signature] = value.split(".");
  if (!encoded || !signature) return null;
  const expected = Buffer.from(sign(encoded));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString()) as SessionPayload;
    if (!payload.employeeRecordId || payload.expiresAt <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function findActiveEmployeeByKey(key: string): Promise<Employee | null> {
  const formula = `AND({${FIELDS.master.mobileKey}}=${formulaString(key)},{${FIELDS.master.status}}='재직중')`;
  const records = await listRecords(TABLES.master, { filterByFormula: formula, maxRecords: 1 });
  return records[0] ? mapEmployee(records[0]) : null;
}

export async function setEmployeeSession(employeeRecordId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, encodeSession({
    employeeRecordId,
    expiresAt: Date.now() + SESSION_SECONDS * 1000,
  }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
}

export async function clearEmployeeSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function requireActiveEmployee(): Promise<Employee | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const session = token ? decodeSession(token) : null;
  if (!session) return null;
  const record = await getRecord(TABLES.master, session.employeeRecordId);
  if (!record || selectName(record.fields[FIELDS.master.status]) !== "재직중") return null;
  return mapEmployee(record);
}

function mapEmployee(record: { id: string; fields: Record<string, unknown> }): Employee {
  const fields = record.fields;
  return {
    recordId: record.id,
    employeeNo: Number(fields[FIELDS.master.employeeNo] ?? 0),
    name: String(fields[FIELDS.master.name] ?? ""),
    department: selectName(fields[FIELDS.master.department]),
    position: selectName(fields[FIELDS.master.position]),
    weeklyOvertime: Number(fields[FIELDS.master.weeklyOvertime] ?? 0),
    remainingOvertimeLabel: String(fields[FIELDS.master.remainingOvertimeLabel] ?? "🟢 12h 남음"),
    remainingLeave: Number(fields[FIELDS.master.remainingLeave] ?? 0),
  };
}
