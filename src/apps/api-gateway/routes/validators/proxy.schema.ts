import { z } from "zod";

const WeightedTargetSchema = z.object({
  url: z.url("Target URL must be a valid URL"),
  weight: z.number().int().positive("Target weight must be a positive integer").optional(),
});

const BalancerStrategySchema = z.enum(["round-robin", "weighted", "least-connections", "sticky"]);

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
        /^(cookie|header):[^:]+$/,
        'stickyKey must be "cookie:<name>" or "header:<name>"',
      )
      .optional(),
    isSecure: z.boolean().optional(),
    changeOrigin: z.boolean().optional(),
    pathRewrite: z.record(z.string(), z.string()).optional(),
    headers: z.record(z.string(), z.string()).optional(),
    method: z
      .enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"])
      .optional(),
    timeout: z.number().positive("Proxy timeout must be a positive number").optional(),
    ws: z.boolean().optional(),
  })
  .refine((d) => (d.target !== undefined) !== (d.targets !== undefined), {
    message: "Proxy must have exactly one of: target (single URL) or targets (load-balanced array)",
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
  });
