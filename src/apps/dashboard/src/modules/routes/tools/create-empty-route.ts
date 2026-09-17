import type { GatewayRoute } from "@/modules/configuration/types/configuration.types";

export function createEmptyRoute(): GatewayRoute {
  return {
    baseURL: "/new-route",
    proxy: {
      target: "http://localhost:4000",
      changeOrigin: true,
    },
  };
}
