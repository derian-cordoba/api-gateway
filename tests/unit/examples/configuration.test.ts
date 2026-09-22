import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { GatewaysSchema } from "../../../src/apps/api-gateway/routes/validators/gateway.schema";

const services = require("../../../examples/shared/services.json") as Record<string, {
  file: string;
  ports: Record<string, number>;
  allPorts?: Record<string, number>;
}[]>;

describe("example configurations", () => {
  for (const name of [...Object.keys(services), "all"]) {
    it(`${name} has valid routes and matching declared upstreams`, () => {
      const file = resolve("examples", name === "all" ? "routes.json" : `${name}/routes.json`);
      const routes = GatewaysSchema.parse(JSON.parse(readFileSync(file, "utf8")));
      const selected = name === "all" ? Object.values(services).flat() : services[name];
      for (const service of selected) {
        expect(statSync(resolve("examples", service.file)).isFile()).toBe(true);
        if (name !== "all") expect(service.file.startsWith(`${name}/`)).toBe(true);
      }
      const ports = selected.flatMap(service => Object.values(name === "all" ? service.allPorts ?? service.ports : service.ports));
      expect(new Set(ports).size).toBe(ports.length);
      for (const route of routes) {
        const urls = [route.proxy.target, route.proxy.mirror?.target, ...(route.proxy.targets?.map(target => target.url) ?? [])];
        for (const url of urls.filter((value): value is string => !!value)) {
          expect(ports).toContain(Number(new URL(url).port));
        }
      }
    });
  }
});
