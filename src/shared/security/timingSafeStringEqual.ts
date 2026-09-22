import { createHash, timingSafeEqual } from "node:crypto";

export function timingSafeStringEqual(first: string, second: string): boolean {
  const digest = (value: string): Buffer =>
    createHash("sha256").update(value, "utf8").digest();
  return timingSafeEqual(digest(first), digest(second));
}
