import type { NextRequest } from "next/server";

export function isDashboardRequestAuthorized(request: NextRequest): boolean {
  const expectedToken = process.env.DASHBOARD_TOKEN;
  if (!expectedToken) return process.env.NODE_ENV !== "production";

  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const headerToken = request.headers.get("x-dashboard-token");
  return bearer === expectedToken || headerToken === expectedToken;
}
