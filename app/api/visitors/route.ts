import { NextRequest, NextResponse } from "next/server";
import { ApiError, apiError, unauthorized } from "@/lib/api";
import { createRecord, getRecord, updateRecord } from "@/lib/airtable";
import { requireActiveEmployee } from "@/lib/auth";
import {
  VISITOR_BASE_ID,
  VISITOR_FIELDS,
  VISITOR_TABLES,
} from "@/lib/constants";
import { isIsoDate, isTime, todayInSeoul } from "@/lib/dates";
import { getVisitorHosts, getVisitorReservations, visitorAirtableToken } from "@/lib/visitors";

type ReservationInput = {
  visitDate: string;
  visitTime: string;
  location: string;
  hostRecordId: string;
  company: string;
  vehicleNo: string;
  headcount: number;
  purpose: string;
  note: string;
};

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function parseInput(body: Record<string, unknown>): ReservationInput {
  const visitDate = body.visitDate;
  const visitTime = body.visitTime;
  const location = cleanText(body.location, 100);
  const hostRecordId = cleanText(body.hostRecordId, 40);
  const company = cleanText(body.company, 150);
  const vehicleNo = cleanText(body.vehicleNo, 50);
  const purpose = cleanText(body.purpose, 500);
  const note = cleanText(body.note, 300);
  const headcount = Number(body.headcount);

  if (!isIsoDate(visitDate)) throw new ApiError("방문일자를 확인해 주세요.");
  if (!isTime(visitTime)) throw new ApiError("방문시간을 확인해 주세요.");
  if (!location) throw new ApiError("방문장소를 입력해 주세요.");
  if (!hostRecordId) throw new ApiError("담당자를 선택해 주세요.");
  if (!company) throw new ApiError("방문업체를 입력해 주세요.");
  if (!Number.isInteger(headcount) || headcount < 1 || headcount > 100) {
    throw new ApiError("방문인원은 1명 이상 100명 이하로 입력해 주세요.");
  }
  if (!purpose) throw new ApiError("방문목적을 입력해 주세요.");
  return { visitDate, visitTime, location, hostRecordId, company, vehicleNo, headcount, purpose, note };
}

async function validateHost(hostRecordId: string) {
  const host = await getRecord(VISITOR_TABLES.master, hostRecordId, VISITOR_BASE_ID, visitorAirtableToken());
  if (!host) throw new ApiError("선택한 담당자를 확인할 수 없습니다.");
}

function toFields(input: ReservationInput): Record<string, unknown> {
  return {
    [VISITOR_FIELDS.reservations.visitAt]: `${input.visitDate}T${input.visitTime}:00+09:00`,
    [VISITOR_FIELDS.reservations.location]: input.location,
    [VISITOR_FIELDS.reservations.host]: [input.hostRecordId],
    [VISITOR_FIELDS.reservations.company]: input.company,
    [VISITOR_FIELDS.reservations.vehicleNo]: input.vehicleNo,
    [VISITOR_FIELDS.reservations.headcount]: input.headcount,
    [VISITOR_FIELDS.reservations.purpose]: input.purpose,
    [VISITOR_FIELDS.reservations.note]: input.note,
  };
}

export async function GET() {
  try {
    const employee = await requireActiveEmployee();
    if (!employee) return unauthorized();
    const hosts = await getVisitorHosts();
    const reservations = await getVisitorReservations(hosts);
    return NextResponse.json({
      ok: true,
      data: {
        reservations,
        hosts,
        currentHostRecordId: hosts.find((host) => host.employeeNo === employee.employeeNo)?.recordId || "",
      },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const employee = await requireActiveEmployee();
    if (!employee) return unauthorized();
    const input = parseInput((await request.json()) as Record<string, unknown>);
    await validateHost(input.hostRecordId);
    await createRecord(VISITOR_TABLES.reservations, {
      ...toFields(input),
      [VISITOR_FIELDS.reservations.appliedDate]: todayInSeoul(),
    }, VISITOR_BASE_ID, visitorAirtableToken());
    return NextResponse.json({ ok: true, message: "방문 예약이 등록되었습니다." }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const employee = await requireActiveEmployee();
    if (!employee) return unauthorized();
    const body = (await request.json()) as Record<string, unknown>;
    const id = cleanText(body.id, 40);
    if (!id) throw new ApiError("수정할 예약을 확인할 수 없습니다.");
    const existing = await getRecord(VISITOR_TABLES.reservations, id, VISITOR_BASE_ID, visitorAirtableToken());
    if (!existing) throw new ApiError("예약을 찾을 수 없습니다.", 404);
    const input = parseInput(body);
    await validateHost(input.hostRecordId);
    await updateRecord(VISITOR_TABLES.reservations, id, toFields(input), VISITOR_BASE_ID, visitorAirtableToken());
    return NextResponse.json({ ok: true, message: "방문 예약이 수정되었습니다." });
  } catch (error) {
    return apiError(error);
  }
}
