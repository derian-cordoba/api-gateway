import { NextRequest, NextResponse } from "next/server";
import { ConfigurationService } from "@/server/configuration/ConfigurationService";
import { ConfigurationConflictError } from "@/server/errors/ConfigurationConflictError";
import { isDashboardRequestAuthorized } from "@/server/auth/authorize-dashboard-request";
import { unauthorizedResponse } from "@/server/auth/unauthorized-response";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isDashboardRequestAuthorized(request)) return unauthorizedResponse();
  try {
    return NextResponse.json(
      { entries: await new ConfigurationService().listHistory() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: "Configuration history failed", message: toMessage(error) },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isDashboardRequestAuthorized(request)) return unauthorizedResponse();
  try {
    const body = (await request.json()) as { revision?: unknown; expectedRevision?: unknown };
    if (typeof body.revision !== "string" || !/^[a-f0-9]{16}$/.test(body.revision)) {
      return NextResponse.json({ error: "Invalid revision" }, { status: 400 });
    }
    const expectedRevision =
      typeof body.expectedRevision === "string" ? body.expectedRevision : undefined;
    const restored = await new ConfigurationService().restore(body.revision, expectedRevision);
    return NextResponse.json(restored, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ConfigurationConflictError) {
      return NextResponse.json(
        { error: "Revision conflict", message: error.message },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "Configuration restore failed", message: toMessage(error) },
      { status: 500 },
    );
  }
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected error";
}
