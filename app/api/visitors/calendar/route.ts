import { NextRequest } from "next/server";
import { createVisitorResponse, getVisitorResponse, updateVisitorResponse } from "@/lib/visitor-api";

// Shared Teams calendar intentionally works without personal keys or sessions.
export async function GET() {
  return getVisitorResponse();
}

export async function POST(request: NextRequest) {
  return createVisitorResponse(request);
}

export async function PATCH(request: NextRequest) {
  return updateVisitorResponse(request);
}
