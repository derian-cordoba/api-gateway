import type { Request, Response, NextFunction } from "express";

export interface AuthStrategy {
  handle(req: Request, res: Response, next: NextFunction): void;
}
