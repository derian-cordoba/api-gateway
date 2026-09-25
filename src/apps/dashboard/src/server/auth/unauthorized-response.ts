import { NextResponse } from "next/server";
import { StatusCodes as HttpStatus } from "http-status-codes";

export function unauthorizedResponse(): NextResponse {
  return NextResponse.json(
    { error: "Unauthorized", message: "A valid dashboard token is required." },
    { status: HttpStatus.UNAUTHORIZED, headers: { "Cache-Control": "no-store" } },
  );
}
