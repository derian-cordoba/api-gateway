import { NextResponse } from "next/server";
import { StatusCodes as HttpStatus } from "http-status-codes";
import { GatewayManagementClient } from "@/server/gateway/GatewayManagementClient";
import { gatewayUnavailableResponse } from "@/server/gateway/gateway-error-response";
import {
  DEFAULT_EVENT_LIMIT,
  isValidEventLimit,
} from "@/modules/overview/event-limit";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const rawLimit = new URL(request.url).searchParams.get("limit");
  const limit = rawLimit === null ? DEFAULT_EVENT_LIMIT : Number(rawLimit);

  if (
    !isValidEventLimit(limit) ||
    (rawLimit !== null && !/^\d+$/.test(rawLimit))
  ) {
    return NextResponse.json(
      {
        error: "Invalid limit",
        message: "limit must be an integer between 1 and 100.",
      },
      {
        status: HttpStatus.BAD_REQUEST,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  try {
    return NextResponse.json(
      await new GatewayManagementClient().events(limit),
      {
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    return gatewayUnavailableResponse(error);
  }
}
