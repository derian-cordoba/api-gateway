"use client";

import { useEffect } from "react";
import type { GatewayRoute } from "@/modules/configuration/types/configuration.types";
import { isRecord } from "@shared/guards/isRecord";

type ToolDefinition = {
  name: string;
  title: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (input: unknown) => unknown | Promise<unknown>;
};

type ModelContext = {
  registerTool: (tool: ToolDefinition, options?: { signal?: AbortSignal }) => void | Promise<void>;
};

export function useRouteTools(
  routes: GatewayRoute[],
  save: (routes: GatewayRoute[]) => Promise<unknown>,
): void {
  useEffect(() => {
    const context = (document as Document & { modelContext?: ModelContext }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();

    const register = (tool: ToolDefinition) => {
      try {
        void Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(
          () => undefined,
        );
      } catch {
        // WebMCP is progressive enhancement; the dashboard remains fully usable without it.
      }
    };

    register({
      name: "list_gateway_routes",
      title: "List gateway routes",
      description: "Read the active file-backed gateway route summaries shown in this dashboard.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute: () => ({
        count: routes.length,
        routes: routes.map((route) => ({
          baseURL: route.baseURL,
          target: route.proxy.target,
          targetCount: route.proxy.targets?.length,
          method: route.proxy.method ?? "ANY",
        })),
      }),
    });

    register({
      name: "create_gateway_route",
      title: "Create gateway route",
      description: "Create and immediately apply a basic single-upstream gateway route.",
      inputSchema: {
        type: "object",
        properties: {
          baseURL: { type: "string", pattern: "^/", description: "Client-facing route prefix." },
          target: { type: "string", format: "uri", description: "Upstream HTTP or HTTPS URL." },
        },
        required: ["baseURL", "target"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: async (input) => {
        if (!isCreateRouteInput(input)) throw new Error("baseURL and target are required.");
        if (routes.some((route) => route.baseURL === input.baseURL)) {
          throw new Error(`A route already uses ${input.baseURL}.`);
        }
        await save([
          ...routes,
          { baseURL: input.baseURL, proxy: { target: input.target, changeOrigin: true } },
        ]);
        return { created: true, baseURL: input.baseURL, routeCount: routes.length + 1 };
      },
    });

    return () => lifecycle.abort();
  }, [routes, save]);
}

function isCreateRouteInput(input: unknown): input is { baseURL: string; target: string } {
  if (!isRecord(input)) return false;
  if (typeof input.baseURL !== "string" || !input.baseURL.startsWith("/")) return false;
  if (typeof input.target !== "string") return false;
  try {
    const url = new URL(input.target);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
