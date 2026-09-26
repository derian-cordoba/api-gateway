import type { NextRequest } from "next/server";
import { z } from "zod";
import { sourceResponse } from "@/server/route-sources/source-response";
import { getSourceManager } from "@/server/route-sources/source-manager";
import { GatewaySourceClient } from "@/server/route-sources/GatewaySourceClient";
import { RouteStorageError } from "../../../../../../../../modules/route-configuration/domain/errors";
export const dynamic = "force-dynamic";
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return sourceResponse(request, async () => {
    const { id } = await context.params;
    getSourceManager().registry.resolve(id);
    const raw = await request.json().catch(() => null);
    const parsed = z
      .object({
        expectedVersion: z.number().int().nonnegative(),
        expectedRevision: z.string().regex(/^(?:[a-f0-9]{16}|[a-f0-9]{32})$/),
      })
      .strict()
      .safeParse(raw);
    if (!parsed.success)
      throw new RouteStorageError(
        "Expected activation version and source revision are required.",
        "configuration",
      );
    return new GatewaySourceClient().activate(
      id,
      parsed.data.expectedVersion,
      parsed.data.expectedRevision,
    );
  });
}
