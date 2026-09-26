import type { NextRequest } from "next/server";
import { sourceResponse } from "@/server/route-sources/source-response";
import { getSourceManager } from "@/server/route-sources/source-manager";
import { GatewaySourceClient } from "@/server/route-sources/GatewaySourceClient";

export const dynamic = "force-dynamic";
export function GET(request: NextRequest) {
  return sourceResponse(request, async () => {
    const sources = getSourceManager().registry.list();
    try {
      return { sources, runtime: await new GatewaySourceClient().status(), runtimeError: null };
    } catch {
      return {
        sources,
        runtime: null,
        runtimeError:
          "Live source status is unavailable. Check the gateway management connection and source-management configuration.",
      };
    }
  });
}
