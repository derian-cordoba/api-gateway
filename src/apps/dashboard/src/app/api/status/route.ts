import { NextRequest, NextResponse } from "next/server";
import { ConfigurationService } from "@/server/configuration/ConfigurationService";
import { isDashboardRequestAuthorized } from "@/server/auth/authorize-dashboard-request";
import { unauthorizedResponse } from "@/server/auth/unauthorized-response";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isDashboardRequestAuthorized(request)) return unauthorizedResponse();

  try {
    const config = await new ConfigurationService().read();
    return NextResponse.json(
      {
        status: "ready",
        storage: "local-json",
        routeCount: config.routes.length,
        revision: config.revision,
        updatedAt: config.updatedAt,
        filePath: config.filePath,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      { status: "error", message: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

