import { NextResponse } from "next/server";

export class ApiError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export function apiError(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
  }
  console.error(error);
  return NextResponse.json(
    { ok: false, message: "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." },
    { status: 500 },
  );
}

export function unauthorized(): NextResponse {
  return NextResponse.json(
    { ok: false, message: "접속 권한이 만료되었거나 유효하지 않습니다. 개인 접속 링크로 다시 접속해 주세요." },
    { status: 401 },
  );
}
