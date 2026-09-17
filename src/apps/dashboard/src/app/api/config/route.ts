import { NextRequest, NextResponse } from "next/server";
import { ConfigurationService } from "@/server/configuration/ConfigurationService";
import { ConfigurationConflictError } from "@/server/errors/ConfigurationConflictError";
import { isDashboardRequestAuthorized } from "@/server/auth/authorize-dashboard-request";
import { unauthorizedResponse } from "@/server/auth/unauthorized-response";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isDashboardRequestAuthorized(request)) return unauthorizedResponse();

  try {
    const config = await new ConfigurationService().read();
    return NextResponse.json(config, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: "Configuration read failed", message: toMessage(error) },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  if (!isDashboardRequestAuthorized(request)) return unauthorizedResponse();

  try {
    const body = (await request.json()) as { routes?: unknown; expectedRevision?: unknown };
    const service = new ConfigurationService();
    const validation = service.validate(body.routes);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: validation.issues },
        { status: 422, headers: { "Cache-Control": "no-store" } },
      );
    }

    const expectedRevision =
      typeof body.expectedRevision === "string" ? body.expectedRevision : undefined;
    const saved = await service.write(validation.routes, expectedRevision);
    return NextResponse.json(saved, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ConfigurationConflictError) {
      return NextResponse.json(
        {
          error: "Revision conflict",
          message: error.message,
          expectedRevision: error.expectedRevision,
          currentRevision: error.currentRevision,
        },
        { status: 409, headers: { "Cache-Control": "no-store" } },
      );
    }

    return NextResponse.json(
      { error: "Configuration save failed", message: toMessage(error) },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected error";
}

