import type { NextRequest } from "next/server";
import { GET as history, POST as restore } from "@/app/api/config/history/route";
import { sourceRequest } from "@/server/route-sources/source-request";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: NextRequest, context: Context) {
  return history(sourceRequest(request, (await context.params).id));
}
export async function POST(request: NextRequest, context: Context) {
  return restore(sourceRequest(request, (await context.params).id));
}
