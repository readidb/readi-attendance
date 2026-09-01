import { NextResponse } from "next/server";
import { apiError, unauthorized } from "@/lib/api";
import { requireActiveEmployee } from "@/lib/auth";
import { publicEmployee } from "@/lib/data";

export async function GET() {
  try {
    const employee = await requireActiveEmployee();
    if (!employee) return unauthorized();
    return NextResponse.json({ ok: true, data: publicEmployee(employee) });
  } catch (error) {
    return apiError(error);
  }
}
