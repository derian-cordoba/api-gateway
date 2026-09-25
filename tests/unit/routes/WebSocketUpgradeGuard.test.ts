import { describe, expect, it, vi } from "vitest";
import { PassThrough } from "node:stream";
import { createProtectedUpgradeHandler } from "../../../src/apps/api-gateway/routes/WebSocketUpgradeGuard";

describe("WebSocketUpgradeGuard", () => {
  it("rejects an unauthenticated upgrade before invoking the proxy", () => {
    const socket = new PassThrough();
    const chunks: Buffer[] = [];
    socket.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    const proxy = vi.fn();
    const handler = createProtectedUpgradeHandler(
      "/secure-ws",
      "/",
      { enabled: true, strategy: "apiKey", keys: ["expected"] },
      proxy,
    );

    handler({ url: "/secure-ws", headers: {} } as never, socket, Buffer.alloc(0));

    expect(proxy).not.toHaveBeenCalled();
    expect(Buffer.concat(chunks).toString()).toContain("401 Unauthorized");
  });

  it("authenticates a matching upgrade and invokes the proxy", () => {
    const socket = new PassThrough();
    const proxy = vi.fn();
    const handler = createProtectedUpgradeHandler(
      "/secure-ws",
      "/",
      { enabled: true, strategy: "apiKey", keys: ["expected"] },
      proxy,
    );

    handler(
      { url: "/secure-ws?room=1", headers: { "x-api-key": "expected" } } as never,
      socket,
      Buffer.alloc(0),
    );

    expect(proxy).toHaveBeenCalledOnce();
  });
});
