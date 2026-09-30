import { NextResponse } from "next/server";
import { apiError, unauthorized } from "@/lib/api";
import { requireActiveEmployee } from "@/lib/auth";
import { getEmployeeRequests, getPublishedNotices, publicEmployee } from "@/lib/data";
import { todayInSeoul } from "@/lib/dates";
import { getTodayVisitorCount } from "@/lib/visitors";

export async function GET() {
  try {
    const employee = await requireActiveEmployee();
    if (!employee) return unauthorized();
    const [requests, notices, todayVisitorCount] = await Promise.all([
      getEmployeeRequests(employee.employeeNo),
      getPublishedNotices(),
      getTodayVisitorCount(employee.employeeNo, todayInSeoul()).catch((error) => {
        console.error("Visitor notification load failed", error);
        return 0;
      }),
    ]);
    return NextResponse.json({
      ok: true,
      data: { employee: publicEmployee(employee), requests, notices, todayVisitorCount },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
