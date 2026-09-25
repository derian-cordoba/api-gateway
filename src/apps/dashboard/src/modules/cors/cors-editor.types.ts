import type { GatewayRoute } from "@/modules/configuration/types/configuration.types";

export type CorsConfig = NonNullable<GatewayRoute["cors"]>;
export type UpdateCors = (patch: Partial<CorsConfig>) => void;
