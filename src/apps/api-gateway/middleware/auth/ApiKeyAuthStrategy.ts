import type { Request, Response, NextFunction } from "express";
import { StatusCodes as HttpStatus } from "http-status-codes";
import type { ApiKeyAuth } from "../../types/auth";
import type { AuthStrategy } from "./AuthStrategy";

export class ApiKeyAuthStrategy implements AuthStrategy {
  private readonly headerName: string;

  constructor(private readonly auth: ApiKeyAuth) {
    this.headerName = (auth.header ?? "x-api-key").toLowerCase();
  }

  handle(req: Request, res: Response, next: NextFunction): void {
    const provided = req.headers[this.headerName];

    if (typeof provided !== "string" || !this.auth.keys.includes(provided)) {
      res.status(HttpStatus.UNAUTHORIZED).json({ error: "Invalid or missing API key" });
      return;
    }

    next();
  }
}
