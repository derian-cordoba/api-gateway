import { StatusCodes as HttpStatus } from "http-status-codes";
import { NextResponse } from "next/server";
import { toError } from "@shared/errors/toError";
import { GatewayManagementError } from "./GatewayManagementClient";

export function gatewayUnavailableResponse(error: unknown): NextResponse {
  const status =
    error instanceof GatewayManagementError &&
    error.status === HttpStatus.UNAUTHORIZED
      ? HttpStatus.BAD_GATEWAY
      : HttpStatus.SERVICE_UNAVAILABLE;

  return NextResponse.json(
    {
      error: "Gateway unavailable",
      message: toError(error).message,
    },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
