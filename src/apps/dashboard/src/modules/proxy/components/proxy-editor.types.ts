import type { GatewayRoute } from "@/modules/configuration/types/configuration.types";

export type ProxyConfig = GatewayRoute["proxy"];
export type UpdateProxy = (patch: Partial<ProxyConfig>) => void;
