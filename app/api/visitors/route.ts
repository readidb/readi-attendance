import { NextRequest } from "next/server";
import { apiError, unauthorized } from "@/lib/api";
import { requireActiveEmployee } from "@/lib/auth";
import { createVisitorResponse, getVisitorResponse, updateVisitorResponse } from "@/lib/visitor-api";

// Personal attendance endpoints retain their existing session requirement.
export async function GET() {
  try {
    const employee = await requireActiveEmployee();
    return employee ? getVisitorResponse(employee.employeeNo) : unauthorized();
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const employee = await requireActiveEmployee();
    return employee ? createVisitorResponse(request) : unauthorized();
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const employee = await requireActiveEmployee();
    return employee ? updateVisitorResponse(request) : unauthorized();
  } catch (error) {
    return apiError(error);
  }
}
