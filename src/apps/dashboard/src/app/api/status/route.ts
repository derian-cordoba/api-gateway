import { storageErrorResponse } from "@/server/errors/storage-error-response";
import { NextRequest, NextResponse } from "next/server";
import { StatusCodes as HttpStatus } from "http-status-codes";
import { ConfigurationService } from "@/server/configuration/ConfigurationService";
import { isDashboardRequestAuthorized } from "@/server/auth/authorize-dashboard-request";
import { unauthorizedResponse } from "@/server/auth/unauthorized-response";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isDashboardRequestAuthorized(request)) return unauthorizedResponse();

  try {
    const config = await new ConfigurationService(
      undefined,
      request.nextUrl.searchParams.get("source") ?? "default",
    ).read();
    return NextResponse.json(
      {
        status: "ready",
        storage: config.storage?.driver ?? "local-json",
        environment: config.storage?.environment,
        configurationKey: config.storage?.configurationKey,
        routeCount: config.routes.length,
        revision: config.revision,
        updatedAt: config.updatedAt,
        filePath: config.filePath,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const storageResponse = storageErrorResponse(error);

    if (storageResponse) {
      return storageResponse;
    }

    return NextResponse.json(
      { status: "error", message: error instanceof Error ? error.message : "Unexpected error" },
      { status: HttpStatus.INTERNAL_SERVER_ERROR, headers: { "Cache-Control": "no-store" } },
    );
  }
}
