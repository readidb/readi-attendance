import { NextRequest, NextResponse } from "next/server";
import { ApiError, apiError, unauthorized } from "@/lib/api";
import { createRecord, formulaString, listRecords, selectName } from "@/lib/airtable";
import { requireActiveEmployee } from "@/lib/auth";
import { FIELDS, LEAVE_TYPES, TABLES } from "@/lib/constants";
import { countWeekdays, isIsoDate, rangesOverlap, todayInSeoul } from "@/lib/dates";

export async function POST(request: NextRequest) {
  try {
    const employee = await requireActiveEmployee();
    if (!employee) return unauthorized();
    const body = (await request.json()) as Record<string, unknown>;
    const type = body.type;
    const startDate = body.startDate;
    const requestedEnd = body.endDate;
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";

    if (typeof type !== "string" || !LEAVE_TYPES.some((item) => item === type)) {
      throw new ApiError("연차 유형을 선택해 주세요.");
    }
    if (!isIsoDate(startDate)) throw new ApiError("시작일을 확인해 주세요.");
    const endDate = type === "연차" ? requestedEnd : startDate;
    if (!isIsoDate(endDate) || startDate > endDate) throw new ApiError("종료일을 확인해 주세요.");
    if (!reason) throw new ApiError("연차 사유를 입력해 주세요.");
    if (reason.length > 300) throw new ApiError("사유는 300자 이내로 입력해 주세요.");

    const days = type === "연차" ? countWeekdays(startDate, endDate) : 0.5;
    if (days <= 0) throw new ApiError("연차 기간에 평일이 포함되어야 합니다.");
    if (days > employee.remainingLeave) {
      throw new ApiError(`잔여 연차가 부족합니다. 현재 잔여 연차는 ${employee.remainingLeave}일입니다.`, 409);
    }

    const employeeFormula = `ARRAYJOIN({${FIELDS.leave.employee}})=${formulaString(String(employee.employeeNo))}`;
    const existing = await listRecords(TABLES.leave, { filterByFormula: employeeFormula });
    const overlap = existing.some((record) => {
      const existingStart = String(record.fields[FIELDS.leave.startDate] ?? "");
      const existingEnd = String(record.fields[FIELDS.leave.endDate] ?? existingStart);
      const existingType = selectName(record.fields[FIELDS.leave.type]);
      if (!existingStart || !existingEnd) return false;
      if (!rangesOverlap(startDate, endDate, existingStart, existingEnd)) return false;
      if (type === "연차" || existingType === "연차") return true;
      return type === existingType;
    });
    if (overlap) throw new ApiError("선택한 날짜와 겹치는 연차 신청이 있습니다.", 409);

    await createRecord(TABLES.leave, {
      [FIELDS.leave.employee]: [employee.recordId],
      [FIELDS.leave.type]: type,
      [FIELDS.leave.startDate]: startDate,
      [FIELDS.leave.endDate]: endDate,
      [FIELDS.leave.reason]: reason,
      [FIELDS.leave.createdAt]: todayInSeoul(),
    });
    return NextResponse.json({ ok: true, message: `${type} 신청이 등록되었습니다.` }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

