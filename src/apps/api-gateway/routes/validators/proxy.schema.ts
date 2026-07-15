import { z } from "zod";

export const ProxySchema = z.object({
  target: z.url("Proxy target must be a valid URL"),
  isSecure: z.boolean().optional(),
  changeOrigin: z.boolean().optional(),
  pathRewrite: z.record(z.string(), z.string()).optional(),
  headers: z.record(z.string(), z.string()).optional(),
  method: z.string().optional(),
  timeout: z.number().positive("Proxy timeout must be a positive number").optional(),
});
