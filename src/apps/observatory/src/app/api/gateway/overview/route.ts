import { NextResponse } from "next/server";
import { GatewayManagementClient } from "@/server/gateway/GatewayManagementClient";
import { gatewayUnavailableResponse } from "@/server/gateway/gateway-error-response";
import { sampleStore } from "@/server/sampling/SampleStore";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const overview = await new GatewayManagementClient().overview();
    sampleStore.add(overview);
    return NextResponse.json(overview, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return gatewayUnavailableResponse(error);
  }
}
