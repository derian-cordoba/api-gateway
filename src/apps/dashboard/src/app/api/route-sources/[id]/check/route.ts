import type { NextRequest } from "next/server";
import { sourceResponse } from "@/server/route-sources/source-response";
import { getSourceManager } from "@/server/route-sources/source-manager";
export const dynamic = "force-dynamic";
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return sourceResponse(request, async () => {
    const { id } = await context.params;
    const snapshot = await getSourceManager().snapshot(id);
    return {
      sourceId: id,
      status: "ready",
      revision: snapshot.revision,
      routeCount: snapshot.routes.length,
    };
  });
}
