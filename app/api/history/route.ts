import { NextResponse } from "next/server";
import { apiError, unauthorized } from "@/lib/api";
import { requireActiveEmployee } from "@/lib/auth";
import { getEmployeeRequests } from "@/lib/data";

export async function GET() {
  try {
    const employee = await requireActiveEmployee();
    if (!employee) return unauthorized();
    return NextResponse.json({ ok: true, data: await getEmployeeRequests(employee.employeeNo) });
  } catch (error) {
    return apiError(error);
  }
}
