import { NextRequest, NextResponse } from "next/server";
import { apiError, unauthorized } from "@/lib/api";
import { requireActiveEmployee } from "@/lib/auth";
import { getEmployeeRequests } from "@/lib/data";
import { getEmployeeVisitorRequests } from "@/lib/visitors";

export async function GET(request: NextRequest) {
  try {
    const employee = await requireActiveEmployee();
    if (!employee) return unauthorized();
    const data = request.nextUrl.searchParams.get("category") === "visitors"
      ? await getEmployeeVisitorRequests(employee.employeeNo)
      : await getEmployeeRequests(employee.employeeNo);
    return NextResponse.json({ ok: true, data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
