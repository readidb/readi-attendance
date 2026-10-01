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
    listRecords(TABLES.flexible, { filterByFormula: flexibleFormula }),
    listRecords(TABLES.overtime, { filterByFormula: overtimeFormula }),
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
    for (const key of ["internalMeal", "externalMeal", "meal"] as const) {
      if (body[key] !== undefined && typeof body[key] !== "boolean") {
        throw new ApiError("식사 종류 선택값을 확인해 주세요.");
      }
    }
    const internalMeal = body.internalMeal === true;
    // 배포 전에 열린 화면의 기존 meal 요청은 외부식사로 처리합니다.
    const externalMeal = body.externalMeal === undefined ? body.meal === true : body.externalMeal === true;
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";

    if (!isIsoDate(date)) throw new ApiError("잔업 날짜를 확인해 주세요.");
    if (!isTime(endTime) || !/:(?:00|30)$/.test(endTime)) {
      throw new ApiError("퇴근시간은 30분 단위로 선택해 주세요.");
    }
    if (!reason) throw new ApiError("장소/사유를 입력해 주세요.");
    if (reason.length > 300) throw new ApiError("장소/사유는 300자 이내로 입력해 주세요.");

    const { schedule, weeklyOvertime } = await getOvertimeContext(employee.employeeNo, date);
    const requestedHours = calculateOvertimeHours(schedule, endTime, externalMeal, internalMeal);
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
      [FIELDS.overtime.reason]: reason,
      [FIELDS.overtime.createdAt]: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true, message: `${requestedHours}시간 잔업 신청이 등록되었습니다.` }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
