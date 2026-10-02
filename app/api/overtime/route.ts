import { NextRequest, NextResponse } from "next/server";
import { ApiError, apiError, unauthorized } from "@/lib/api";
import { createRecord, formulaString, listRecords, selectName } from "@/lib/airtable";
import { requireActiveEmployee } from "@/lib/auth";
import { FIELDS, FLEXIBLE_SCHEDULES, STANDARD_SCHEDULE, TABLES } from "@/lib/constants";
import { calculateOvertimeHours, isIsoDate, isTime, weekBounds } from "@/lib/dates";

async function getOvertimeContext(employeeNo: number, date: string) {
  const employeeFilter = formulaString(String(employeeNo));
  const flexibleFormula = `AND(ARRAYJOIN({${FIELDS.flexible.employee}})=${employeeFilter},{${FIELDS.flexible.date}}=${formulaString(date)})`;
  const overtimeFormula = `ARRAYJOIN({${FIELDS.overtime.employee}})=${employeeFilter}`;
  const [flexibleRecords, overtimeRecords] = await Promise.all([
    listRecords(TABLES.flexible, { filterByFormula: flexibleFormula, fields: [FIELDS.flexible.schedule] }),
    listRecords(TABLES.overtime, { filterByFormula: overtimeFormula, fields: [FIELDS.overtime.date, FIELDS.overtime.hours] }),
  ]);
  const latestFlexible = flexibleRecords.toSorted((a, b) => b.createdTime.localeCompare(a.createdTime))[0];
  const selectedSchedule = selectName(latestFlexible?.fields[FIELDS.flexible.schedule]);
  const schedule = FLEXIBLE_SCHEDULES.some((item) => item === selectedSchedule)
    ? selectedSchedule
    : STANDARD_SCHEDULE;
  const bounds = weekBounds(date);
  const weeklyOvertime = bounds
    ? overtimeRecords.reduce((total, record) => {
        const recordDate = String(record.fields[FIELDS.overtime.date] ?? "");
        if (recordDate < bounds.start || recordDate > bounds.end) return total;
        return total + Number(record.fields[FIELDS.overtime.hours] ?? 0);
      }, 0)
    : 0;
  return { schedule, weeklyOvertime };
}

export async function GET(request: NextRequest) {
  try {
    const employee = await requireActiveEmployee();
    if (!employee) return unauthorized();
    const date = request.nextUrl.searchParams.get("date");
    if (!isIsoDate(date)) throw new ApiError("잔업 날짜를 확인해 주세요.");
    const context = await getOvertimeContext(employee.employeeNo, date);
    return NextResponse.json({ ok: true, ...context }, { headers: { "Cache-Control": "no-store" } });
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
    const endTime = body.endTime;
    if (body.weekendHoliday !== undefined && typeof body.weekendHoliday !== "boolean") {
      throw new ApiError("주말/공휴일 여부를 확인해 주세요.");
    }
    const weekendHoliday = body.weekendHoliday === true;
    if (body.mealChoice !== "internal" && body.mealChoice !== "external" && body.mealChoice !== "none") {
      throw new ApiError("식사 종류를 선택해 주세요.");
    }
    const internalMeal = body.mealChoice === "internal";
    const externalMeal = body.mealChoice === "external";
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";

    if (!isIsoDate(date)) throw new ApiError("잔업 날짜를 확인해 주세요.");
    if (body.schedule !== undefined && (typeof body.schedule !== "string" || !FLEXIBLE_SCHEDULES.some((item) => item === body.schedule))) {
      throw new ApiError("출근시간을 선택해 주세요.");
    }
    if (!isTime(endTime) || !/:(?:00|30)$/.test(endTime)) {
      throw new ApiError("퇴근시간은 30분 단위로 선택해 주세요.");
    }
    if (!reason) throw new ApiError("장소/사유를 입력해 주세요.");
    if (reason.length > 300) throw new ApiError("장소/사유는 300자 이내로 입력해 주세요.");

    const context = await getOvertimeContext(employee.employeeNo, date);
    const schedule = typeof body.schedule === "string" ? body.schedule : context.schedule;
    const weeklyOvertime = context.weeklyOvertime;
    const requestedHours = calculateOvertimeHours(schedule, endTime, externalMeal, internalMeal, weekendHoliday);
    if (requestedHours <= 0) throw new ApiError("계산되는 잔업시간이 있어야 합니다.");
    if (weeklyOvertime + requestedHours > 12) {
      const available = Math.max(0, 12 - weeklyOvertime);
      throw new ApiError(`주간 잔업 가능시간을 초과합니다. 현재 신청 가능시간은 ${available}시간입니다.`, 409);
    }

    const duplicateFormula = `AND(ARRAYJOIN({${FIELDS.overtime.employee}})=${formulaString(String(employee.employeeNo))},{${FIELDS.overtime.date}}=${formulaString(date)})`;
    const duplicate = await listRecords(TABLES.overtime, { filterByFormula: duplicateFormula, maxRecords: 1 });
    if (duplicate.length) throw new ApiError("해당 날짜에 이미 등록된 잔업 신청이 있습니다.", 409);

    await createRecord(TABLES.overtime, {
      [FIELDS.overtime.employee]: [employee.recordId],
      [FIELDS.overtime.schedule]: schedule,
      [FIELDS.overtime.date]: date,
      [FIELDS.overtime.endAt]: `${date}T${endTime}:00+09:00`,
      [FIELDS.overtime.internalMeal]: internalMeal,
      [FIELDS.overtime.externalMeal]: externalMeal,
      [FIELDS.overtime.weekendHoliday]: weekendHoliday,
      [FIELDS.overtime.reason]: reason,
      [FIELDS.overtime.createdAt]: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true, message: `${requestedHours}시간 잔업 신청이 등록되었습니다.` }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
