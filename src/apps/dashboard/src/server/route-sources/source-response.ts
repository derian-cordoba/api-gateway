import { NextResponse, type NextRequest } from "next/server";
import { StatusCodes } from "http-status-codes";
import { isDashboardRequestAuthorized } from "../auth/authorize-dashboard-request";
import { unauthorizedResponse } from "../auth/unauthorized-response";
import { storageErrorResponse } from "../errors/storage-error-response";
import { ConfigurationConflictError } from "../../../../../modules/route-configuration/domain/errors";

export async function sourceResponse(request: NextRequest, work: () => Promise<unknown>) {
  if (!isDashboardRequestAuthorized(request)) {
    return unauthorizedResponse();
  }

  try {
    return NextResponse.json(await work(), { headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    if (cause instanceof ConfigurationConflictError) {
      return NextResponse.json(
        { message: "The source changed. Refresh before trying again." },
        { status: StatusCodes.CONFLICT },
      );
    }

    return (
      storageErrorResponse(cause) ??
      NextResponse.json(
        { message: "Route source operation failed." },
        { status: StatusCodes.SERVICE_UNAVAILABLE },
      )
    );
  }
}
