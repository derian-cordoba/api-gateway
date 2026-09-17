import { z } from "zod";

const IPV4_PATTERN = /^(\d{1,3}\.){3}\d{1,3}(\/([0-9]|[1-2][0-9]|3[0-2]))?$/;
const IPV6_PATTERN = /^[0-9a-fA-F:]+(%[a-zA-Z0-9]+)?(\/\d{1,3})?$/;

const IpOrCidrSchema = z.string().refine(
  (entry) => IPV4_PATTERN.test(entry) || IPV6_PATTERN.test(entry),
  { message: "Must be a valid IPv4, IPv6, or CIDR range (e.g. 192.168.1.1, 10.0.0.0/8, 2001:db8::1, 2001:db8::/32)" },
);

const IpListSchema = z.array(IpOrCidrSchema).min(1, "IP list must contain at least one entry");

export const IpFilterSchema = z
  .object({
    allow: IpListSchema.optional(),
    deny: IpListSchema.optional(),
  })
  .refine((data) => data.allow !== undefined || data.deny !== undefined, {
    message: "ipFilter must specify at least one of: allow, deny",
  });
