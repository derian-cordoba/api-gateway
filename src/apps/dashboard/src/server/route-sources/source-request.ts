import { NextRequest } from "next/server";

export function sourceRequest(request: NextRequest, id: string): NextRequest {
  const url = new URL(request.url);
  url.searchParams.set("source", id);
  return new NextRequest(url, request);
}
