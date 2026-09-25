import { NextRequest, NextResponse } from "next/server";
import { StatusCodes as HttpStatus } from "http-status-codes";
import { ConfigurationService } from "@/server/configuration/ConfigurationService";
import { isDashboardRequestAuthorized } from "@/server/auth/authorize-dashboard-request";
import { unauthorizedResponse } from "@/server/auth/unauthorized-response";

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isDashboardRequestAuthorized(request)) return unauthorizedResponse();

  try {
    const body: unknown = await request.json();
    const result = new ConfigurationService().validate(body);
    return NextResponse.json(result, {
      status: result.success ? HttpStatus.OK : HttpStatus.UNPROCESSABLE_ENTITY,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { success: false, issues: [{ path: [], message: "Request body must be valid JSON." }] },
      { status: HttpStatus.BAD_REQUEST, headers: { "Cache-Control": "no-store" } },
    );
  }
}
