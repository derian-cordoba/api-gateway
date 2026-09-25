import type { GatewayRoute } from "@/modules/configuration/types/configuration.types";

export type RetryConfig = NonNullable<GatewayRoute["retry"]>;
export type UpdateRetry = (patch: Partial<RetryConfig>) => void;
