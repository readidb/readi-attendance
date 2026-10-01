import { NextResponse } from "next/server";
import { apiError, unauthorized } from "@/lib/api";
import { requireActiveEmployee } from "@/lib/auth";
import { getDashboardData } from "@/lib/data";

export async function GET() {
  try {
    const employee = await requireActiveEmployee();
    if (!employee) return unauthorized();
    return NextResponse.json({
      ok: true,
      data: await getDashboardData(employee),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
