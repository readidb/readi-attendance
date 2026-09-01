import { NextRequest, NextResponse } from "next/server";
import { ApiError, apiError, unauthorized } from "@/lib/api";
import { createRecord, formulaString, listRecords } from "@/lib/airtable";
import { requireActiveEmployee } from "@/lib/auth";
import { FIELDS, FLEXIBLE_SCHEDULES, TABLES } from "@/lib/constants";
import { calculateOvertimeHours, isIsoDate, isTime } from "@/lib/dates";

export async function POST(request: NextRequest) {
  try {
    const employee = await requireActiveEmployee();
    if (!employee) return unauthorized();
    const body = (await request.json()) as Record<string, unknown>;
    const date = body.date;
    const schedule = body.schedule;
    const endTime = body.endTime;
    const meal = body.meal === true;
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";

    if (!isIsoDate(date)) throw new ApiError("잔업 날짜를 확인해 주세요.");
    if (typeof schedule !== "string" || !FLEXIBLE_SCHEDULES.some((item) => item === schedule)) {
      throw new ApiError("유연근무 유형을 선택해 주세요.");
    }
    if (!isTime(endTime) || !/:(?:00|30)$/.test(endTime)) {
      throw new ApiError("퇴근시간은 30분 단위로 선택해 주세요.");
    }
    if (!reason) throw new ApiError("장소/사유를 입력해 주세요.");
    if (reason.length > 300) throw new ApiError("장소/사유는 300자 이내로 입력해 주세요.");

    const requestedHours = calculateOvertimeHours(schedule, endTime, meal);
    if (requestedHours < 1) throw new ApiError("계산되는 잔업시간이 1시간 이상이어야 합니다.");
    if (employee.weeklyOvertime + requestedHours > 12) {
      const available = Math.max(0, 12 - employee.weeklyOvertime);
      throw new ApiError(`주간 잔업 가능시간을 초과합니다. 현재 신청 가능시간은 ${available}시간입니다.`, 409);
    }

    const duplicateFormula = `AND(FIND(${formulaString(String(employee.employeeNo))},ARRAYJOIN({${FIELDS.overtime.employee}})),{${FIELDS.overtime.date}}=${formulaString(date)})`;
    const duplicate = await listRecords(TABLES.overtime, { filterByFormula: duplicateFormula, maxRecords: 1 });
    if (duplicate.length) throw new ApiError("해당 날짜에 이미 등록된 잔업 신청이 있습니다.", 409);

    await createRecord(TABLES.overtime, {
      [FIELDS.overtime.employee]: [employee.recordId],
      [FIELDS.overtime.schedule]: schedule,
      [FIELDS.overtime.date]: date,
      [FIELDS.overtime.endAt]: `${date}T${endTime}:00+09:00`,
      [FIELDS.overtime.meal]: meal,
      [FIELDS.overtime.reason]: reason,
    });
    return NextResponse.json({ ok: true, message: `${requestedHours}시간 잔업 신청이 등록되었습니다.` }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
