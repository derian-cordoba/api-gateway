import type { HttpQuery } from "./contracts";
import { HttpError } from "./HttpError";

export function buildURL(
  path: string,
  baseURL?: string,
  query?: HttpQuery,
): string {
  const absolute = /^[a-z][a-z\d+.-]*:/i.test(path);
  if (
    path !== path.trim() ||
    /[\u0000-\u001f\u007f]/.test(path) ||
    path.startsWith("//") ||
    path.includes("\\") ||
    (baseURL && absolute)
  ) {
    throw new HttpError(
      "Use a relative API path with a configured base URL.",
      "configuration",
    );
  }

  const base = baseURL ? new URL(baseURL) : undefined;
  if (base) {
    if (base.search || base.hash) {
      throw new HttpError(
        "The base URL cannot contain a query or fragment.",
        "configuration",
      );
    }

    if (!base.pathname.endsWith("/")) {
      base.pathname += "/";
    }
  }

  const url = base
    ? new URL(path.replace(/^\/+/, ""), base)
    : new URL(path, "http://relative.local");

  if (
    !/^https?:$/.test(url.protocol) ||
    url.username ||
    url.password ||
    (base && base.origin !== url.origin)
  ) {
    throw new HttpError(
      "HTTP URLs must use HTTP or HTTPS without embedded credentials.",
      "configuration",
    );
  }

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null) {
      continue;
    }

    url.searchParams.delete(key);

    for (const item of Array.isArray(value) ? value : [value]) {
      if (item !== undefined && item !== null) {
        url.searchParams.append(key, String(item));
      }
    }
  }

  return base || absolute ? url.toString() : `${url.pathname}${url.search}`;
}
