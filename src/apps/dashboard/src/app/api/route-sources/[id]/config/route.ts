import type { NextRequest } from "next/server";
import { GET as read, PUT as write } from "@/app/api/config/route";
import { sourceRequest } from "@/server/route-sources/source-request";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: NextRequest, context: Context) {
  return read(sourceRequest(request, (await context.params).id));
}
export async function PUT(request: NextRequest, context: Context) {
  return write(sourceRequest(request, (await context.params).id));
}
