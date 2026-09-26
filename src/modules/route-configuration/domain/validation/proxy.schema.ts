import { z } from "zod";

const UpstreamAuthSchema = z.object({
  type: z.literal("hmac-sha256"),
  secret: z.string().min(1, "upstreamAuth.secret must not be empty"),
  header: z.string().optional(),
});

const MirrorSchema = z.object({
  target: z.url("mirror.target must be a valid URL"),
  percentage: z.number().min(0).max(100).optional(),
});

const WeightedTargetSchema = z.object({
  url: z.url("Target URL must be a valid URL"),
  weight: z
    .number()
    .int()
    .positive("Target weight must be a positive integer")
    .optional(),
});

const BalancerStrategySchema = z.enum([
  "round-robin",
  "weighted",
  "least-connections",
  "sticky",
]);

export const ProxySchema = z
  .object({
    target: z.url("Proxy target must be a valid URL").optional(),
    targets: z
      .array(WeightedTargetSchema)
      .min(2, "Load balancer requires at least two targets")
      .optional(),
    strategy: BalancerStrategySchema.optional(),
    stickyKey: z
      .string()
      .regex(
        /^(ip|query:[^:]+|header:[^:]+|jwt:[^:]+|cookie:[^:]+)$/,
        'stickyKey must be "ip", "header:<name>", "jwt:<claim>", "cookie:<name>", or "query:<name>"',
      )
      .optional(),
    isSecure: z.boolean().optional(),
    changeOrigin: z.boolean().optional(),
    pathRewrite: z.record(z.string(), z.string()).optional(),
    headers: z.record(z.string(), z.string()).optional(),
    method: z
      .enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"])
      .optional(),
    timeout: z
      .number()
      .positive("Proxy timeout must be a positive number")
      .optional(),
    ws: z.boolean().optional(),
    maxConnections: z.number().int().positive().optional(),
    idleTimeoutMs: z.number().int().positive().optional(),
    upstreamAuth: UpstreamAuthSchema.optional(),
    mirror: MirrorSchema.optional(),
  })
  .refine((d) => (d.target !== undefined) !== (d.targets !== undefined), {
    message:
      "Proxy must have exactly one of: target (single URL) or targets (load-balanced array)",
    path: ["target"],
  })
  .refine((d) => d.strategy === undefined || d.targets !== undefined, {
    message: "strategy is only valid when targets is set",
    path: ["strategy"],
  })
  .refine((d) => d.stickyKey === undefined || d.strategy === "sticky", {
    message: 'stickyKey is only valid when strategy is "sticky"',
    path: ["stickyKey"],
  })
  .refine((d) => d.strategy !== "sticky" || d.stickyKey !== undefined, {
    message: 'strategy "sticky" requires stickyKey to be set',
    path: ["stickyKey"],
  })
  .refine(
    (d) =>
      d.ws || (d.maxConnections === undefined && d.idleTimeoutMs === undefined),
    {
      message: "maxConnections and idleTimeoutMs require ws to be enabled",
      path: ["ws"],
    },
  );
