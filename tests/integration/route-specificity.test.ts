import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type Server as HttpServer } from "node:http";
import supertest from "supertest";
import { Server } from "../../src/apps/api-gateway/Server";

const GENERAL_PORT = 19_180;
const SPECIFIC_PORT = 19_181;

function upstream(port: number, name: string): Promise<HttpServer> {
  return new Promise((resolve) => {
    const server = createServer((_req, res) => {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ name }));
    });
    server.listen(port, () => resolve(server));
  });
}

describe("nested route matching", () => {
  let general: HttpServer;
  let specific: HttpServer;
  let gateway: Server;

  beforeAll(async () => {
    [general, specific] = await Promise.all([
      upstream(GENERAL_PORT, "general"),
      upstream(SPECIFIC_PORT, "specific"),
    ]);
    process.env.ROUTES = JSON.stringify([
      { baseURL: "/p2-match", proxy: { target: `http://localhost:${GENERAL_PORT}` } },
      { baseURL: "/p2-match/admin", proxy: { target: `http://localhost:${SPECIFIC_PORT}` } },
    ]);
    gateway = new Server();
    await gateway.init();
  });

  afterAll(async () => {
    delete process.env.ROUTES;
    await gateway?.stop();
    await Promise.all([
      new Promise<void>((resolve) => general.close(() => resolve())),
      new Promise<void>((resolve) => specific.close(() => resolve())),
    ]);
  });

  it("routes nested paths to the longer prefix regardless of file order", async () => {
    const request = supertest(gateway.getApp());
    const [nested, broad] = await Promise.all([
      request.get("/p2-match/admin/users"),
      request.get("/p2-match/users"),
    ]);
    expect(nested.body.name).toBe("specific");
    expect(broad.body.name).toBe("general");
  });
});
