import { NextRequest, NextResponse } from "next/server";
import { ConfigurationService } from "@/server/configuration/ConfigurationService";
import { isDashboardRequestAuthorized } from "@/server/auth/authorize-dashboard-request";
import { unauthorizedResponse } from "@/server/auth/unauthorized-response";

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isDashboardRequestAuthorized(request)) return unauthorizedResponse();

  try {
    const body: unknown = await request.json();
    const result = new ConfigurationService().validate(body);
    return NextResponse.json(result, {
      status: result.success ? 200 : 422,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { success: false, issues: [{ path: [], message: "Request body must be valid JSON." }] },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
}

