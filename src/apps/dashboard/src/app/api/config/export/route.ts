import { storageErrorResponse } from "@/server/errors/storage-error-response";
import { StatusCodes } from "http-status-codes";
import { NextRequest, NextResponse } from "next/server";
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
    return new NextResponse(`${JSON.stringify(config.routes, null, 2)}\n`, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": 'attachment; filename="routes.json"',
        "Content-Type": "application/json; charset=utf-8",
      },
    });
  } catch (error) {
    return (
      storageErrorResponse(error) ??
      NextResponse.json(
        { error: "Configuration export failed." },
        { status: StatusCodes.INTERNAL_SERVER_ERROR },
      )
    );
  }
}
