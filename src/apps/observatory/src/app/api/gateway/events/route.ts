import { NextResponse } from "next/server";
import { GatewayManagementClient } from "@/server/gateway/GatewayManagementClient";
import { gatewayUnavailableResponse } from "@/server/gateway/gateway-error-response";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    return NextResponse.json(await new GatewayManagementClient().events(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return gatewayUnavailableResponse(error);
  }
}
