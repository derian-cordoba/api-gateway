import type { Request } from "express";
import type { RequestKeyExtractor } from "./RequestKeyExtractor";
import { getHeaderValue } from "../../../../shared/http/getHeaderValue";

/** Extracts the value of a named request header. */
export class HeaderKeyExtractor implements RequestKeyExtractor {
  private readonly headerName: string;

  constructor(name: string) {
    this.headerName = name.toLowerCase();
  }

  extract(req: Request): string | null {
    return getHeaderValue(req.headers[this.headerName]) ?? null;
  }
}
