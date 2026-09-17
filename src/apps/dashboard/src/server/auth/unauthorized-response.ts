import { NextResponse } from "next/server";

export function unauthorizedResponse(): NextResponse {
  return NextResponse.json(
    { error: "Unauthorized", message: "A valid dashboard token is required." },
    { status: 401, headers: { "Cache-Control": "no-store" } },
  );
}
