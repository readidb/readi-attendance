import { NextResponse } from "next/server";
import { apiError, unauthorized } from "@/lib/api";
import { requireActiveEmployee } from "@/lib/auth";
import { getEmployeeRequests, getPublishedNotices, publicEmployee } from "@/lib/data";

export async function GET() {
  try {
    const employee = await requireActiveEmployee();
    if (!employee) return unauthorized();
    const [requests, notices] = await Promise.all([
      getEmployeeRequests(employee.employeeNo),
      getPublishedNotices(),
    ]);
    return NextResponse.json({
      ok: true,
      data: { employee: publicEmployee(employee), requests, notices },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
