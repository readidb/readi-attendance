import { NextRequest, NextResponse } from "next/server";
import { clearEmployeeSession, findActiveEmployeeByKey, setEmployeeSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key")?.trim();
  if (!key || key.length > 200) {
    await clearEmployeeSession();
    return NextResponse.redirect(new URL("/?error=invalid-key", request.url));
  }

  try {
    const employee = await findActiveEmployeeByKey(key);
    if (!employee) {
      await clearEmployeeSession();
      return NextResponse.redirect(new URL("/?error=invalid-key", request.url));
    }
    await setEmployeeSession(employee.recordId);
    return NextResponse.redirect(new URL("/", request.url));
  } catch (error) {
    console.error(error);
    return NextResponse.redirect(new URL("/?error=server", request.url));
  }
}
