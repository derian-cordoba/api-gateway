import { z } from "zod";

const IPV4_OR_CIDR = /^(\d{1,3}\.){3}\d{1,3}(\/([0-9]|[1-2][0-9]|3[0-2]))?$/;

const IpListSchema = z
  .array(z.string().regex(IPV4_OR_CIDR, "Must be a valid IPv4 address or CIDR range (e.g. 192.168.1.1 or 10.0.0.0/8)"))
  .min(1, "IP list must contain at least one entry");

export const IpFilterSchema = z
  .object({
    allow: IpListSchema.optional(),
    deny: IpListSchema.optional(),
  })
  .refine((data) => data.allow !== undefined || data.deny !== undefined, {
    message: "ipFilter must specify at least one of: allow, deny",
  });
