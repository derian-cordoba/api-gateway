import { NextResponse } from "next/server";
import { StatusCodes } from "http-status-codes";
import { RouteStorageError } from "../../../../../modules/route-configuration/domain/errors";

export function storageErrorResponse(error: unknown): NextResponse | undefined {
  if (!(error instanceof RouteStorageError)) {
    return undefined;
  }

  const status =
    error.code === "precondition"
      ? StatusCodes.PRECONDITION_REQUIRED
      : error.code === "not-found"
        ? StatusCodes.NOT_FOUND
        : error.code === "configuration"
          ? StatusCodes.BAD_REQUEST
          : StatusCodes.SERVICE_UNAVAILABLE;

  return NextResponse.json(
    { error: "Route storage error", message: error.message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
