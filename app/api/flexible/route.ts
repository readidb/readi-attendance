import { NextRequest, NextResponse } from "next/server";
import { ApiError, apiError, unauthorized } from "@/lib/api";
import { createRecord, formulaString, listRecords, selectName } from "@/lib/airtable";
import { requireActiveEmployee } from "@/lib/auth";
import { FIELDS, FLEXIBLE_SCHEDULES, TABLES } from "@/lib/constants";
import { isIsoDate } from "@/lib/dates";

export async function GET(request: NextRequest) {
  try {
    const employee = await requireActiveEmployee();
    if (!employee) return unauthorized();
    const date = request.nextUrl.searchParams.get("date");
    if (!isIsoDate(date)) throw new ApiError("신청 날짜를 확인해 주세요.");

    const filterByFormula = `AND(FIND(${formulaString(String(employee.employeeNo))},ARRAYJOIN({${FIELDS.flexible.employee}})),{${FIELDS.flexible.date}}=${formulaString(date)})`;
    const records = await listRecords(TABLES.flexible, {
      filterByFormula,
      fields: [FIELDS.flexible.schedule],
      maxRecords: 1,
    });
    const schedule = records.length ? selectName(records[0].fields[FIELDS.flexible.schedule]) : "08:00 ~ 17:00";
    if (!FLEXIBLE_SCHEDULES.some((item) => item === schedule)) {
      throw new ApiError("등록된 유연근무 시간을 확인해 주세요.");
    }
    return NextResponse.json({ ok: true, schedule }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const employee = await requireActiveEmployee();
    if (!employee) return unauthorized();
    const body = (await request.json()) as Record<string, unknown>;
    const date = body.date;
    const schedule = body.schedule;
    const note = typeof body.note === "string" ? body.note.trim() : "";

    if (!isIsoDate(date)) throw new ApiError("신청 날짜를 확인해 주세요.");
    if (typeof schedule !== "string" || !FLEXIBLE_SCHEDULES.some((item) => item === schedule)) {
      throw new ApiError("유연근무 시간을 선택해 주세요.");
    }
    if (note.length > 300) throw new ApiError("비고는 300자 이내로 입력해 주세요.");

    const duplicateFormula = `AND(FIND(${formulaString(String(employee.employeeNo))},ARRAYJOIN({${FIELDS.flexible.employee}})),{${FIELDS.flexible.date}}=${formulaString(date)})`;
    const duplicate = await listRecords(TABLES.flexible, { filterByFormula: duplicateFormula, maxRecords: 1 });
    if (duplicate.length) throw new ApiError("해당 날짜에 이미 등록된 유연근무 신청이 있습니다.", 409);

    await createRecord(TABLES.flexible, {
      [FIELDS.flexible.employee]: [employee.recordId],
      [FIELDS.flexible.createdAt]: new Date().toISOString(),
      [FIELDS.flexible.date]: date,
      [FIELDS.flexible.schedule]: schedule,
      [FIELDS.flexible.note]: note,
    });
    return NextResponse.json({ ok: true, message: "유연근무 신청이 등록되었습니다." }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
