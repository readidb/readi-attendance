import "server-only";

import { FIELDS, TABLES } from "@/lib/constants";
import { formulaString, listRecords, selectName } from "@/lib/airtable";
import { todayInSeoul } from "@/lib/dates";
import { getTodayVisitorCount } from "@/lib/visitors";
import type { DashboardData, Employee, Notice, RequestItem } from "@/lib/types";

function employeeFormula(employeeNo: number, fieldId: string): string {
  return `ARRAYJOIN({${fieldId}})=${formulaString(String(employeeNo))}`;
}

function text(value: unknown): string {
  return value == null ? "" : String(value);
}

export async function getEmployeeRequests(employeeNo: number): Promise<RequestItem[]> {
  const [flexible, overtime, leave] = await Promise.all([
    listRecords(TABLES.flexible, {
      filterByFormula: employeeFormula(employeeNo, FIELDS.flexible.employee),
      fields: [FIELDS.flexible.requestNo, FIELDS.flexible.date, FIELDS.flexible.schedule, FIELDS.flexible.note],
    }),
    listRecords(TABLES.overtime, {
      filterByFormula: employeeFormula(employeeNo, FIELDS.overtime.employee),
      fields: [FIELDS.overtime.requestNo, FIELDS.overtime.date, FIELDS.overtime.hours, FIELDS.overtime.reason, FIELDS.overtime.validationStatus],
    }),
    listRecords(TABLES.leave, {
      filterByFormula: employeeFormula(employeeNo, FIELDS.leave.employee),
      fields: [FIELDS.leave.requestNo, FIELDS.leave.type, FIELDS.leave.startDate, FIELDS.leave.endDate, FIELDS.leave.days, FIELDS.leave.reason],
    }),
  ]);

  const items: RequestItem[] = [
    ...flexible.map((record) => ({
      id: record.id,
      createdAt: record.createdTime,
      requestNo: text(record.fields[FIELDS.flexible.requestNo]),
      category: "flexible" as const,
      typeLabel: "유연근무",
      dateLabel: text(record.fields[FIELDS.flexible.date]),
      detail: [selectName(record.fields[FIELDS.flexible.schedule]), text(record.fields[FIELDS.flexible.note])]
        .filter(Boolean)
        .join(" · "),
    })),
    ...overtime.map((record) => ({
      id: record.id,
      createdAt: record.createdTime,
      requestNo: text(record.fields[FIELDS.overtime.requestNo]),
      category: "overtime" as const,
      typeLabel: "잔업",
      dateLabel: text(record.fields[FIELDS.overtime.date]),
      detail: `${Number(record.fields[FIELDS.overtime.hours] ?? 0)}h · ${text(record.fields[FIELDS.overtime.reason])}`,
      status: text(record.fields[FIELDS.overtime.validationStatus]),
    })),
    ...leave.map((record) => {
      const start = text(record.fields[FIELDS.leave.startDate]);
      const end = text(record.fields[FIELDS.leave.endDate]);
      const days = Number(record.fields[FIELDS.leave.days] ?? 0);
      return {
        id: record.id,
        createdAt: record.createdTime,
        requestNo: text(record.fields[FIELDS.leave.requestNo]),
        category: "leave" as const,
        typeLabel: selectName(record.fields[FIELDS.leave.type]) || "연차",
        dateLabel: start === end || !end ? start : `${start} ~ ${end}`,
        detail: `${days}일 · ${text(record.fields[FIELDS.leave.reason])}`,
      };
    }),
  ];

  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 100);
}

export async function getPublishedNotices(): Promise<Notice[]> {
  const formula = `{${FIELDS.notices.published}}=1`;
  const records = await listRecords(TABLES.notices, {
    filterByFormula: formula,
    maxRecords: 20,
    sortField: FIELDS.notices.publishDate,
  });
  return records.map((record) => ({
    id: record.id,
    title: text(record.fields[FIELDS.notices.title]),
    content: text(record.fields[FIELDS.notices.content]),
    important: Boolean(record.fields[FIELDS.notices.important]),
    publishDate: text(record.fields[FIELDS.notices.publishDate]),
    attachments: Array.isArray(record.fields[FIELDS.notices.attachments])
      ? (record.fields[FIELDS.notices.attachments] as Array<Record<string, unknown>>).map((file) => ({
          id: text(file.id),
          filename: text(file.filename),
          url: text(file.url),
        }))
      : [],
  }));
}

export function publicEmployee(employee: Employee): Omit<Employee, "recordId"> {
  const { recordId: _recordId, ...safeEmployee } = employee;
  void _recordId;
  return safeEmployee;
}

export async function getDashboardData(employee: Employee, today = todayInSeoul()): Promise<DashboardData> {
  const [requests, notices, todayVisitorCount] = await Promise.all([
    getEmployeeRequests(employee.employeeNo),
    getPublishedNotices(),
    getTodayVisitorCount(employee.employeeNo, today).catch((error) => {
      console.error("Visitor notification load failed", error);
      return 0;
    }),
  ]);
  return { employee: publicEmployee(employee), requests, notices, todayVisitorCount };
}

