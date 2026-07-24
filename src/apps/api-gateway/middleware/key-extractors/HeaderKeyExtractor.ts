import type { Request } from "express";
import type { RequestKeyExtractor } from "./RequestKeyExtractor";

/** Extracts the value of a named request header. */
export class HeaderKeyExtractor implements RequestKeyExtractor {
  private readonly headerName: string;

  constructor(name: string) {
    this.headerName = name.toLowerCase();
  }

  extract(req: Request): string | null {
    const val = req.headers[this.headerName];
    return (Array.isArray(val) ? val[0] : val) ?? null;
  }
}
