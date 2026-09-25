import type { GatewayRoute } from "@/modules/configuration/types/configuration.types";

export type CircuitBreakerConfig = NonNullable<GatewayRoute["circuitBreaker"]>;
export type UpdateCircuitBreaker = (patch: Partial<CircuitBreakerConfig>) => void;
