import { describe, expect, it, vi } from "vitest";
import { RetryExecutor } from "../../../../src/apps/api-gateway/middleware/retry/RetryExecutor";
import type {
  UpstreamHttpClient,
  UpstreamResponse,
} from "../../../../src/apps/api-gateway/middleware/retry/UpstreamHttpClient";
import type { TargetSelector } from "../../../../src/apps/api-gateway/middleware/retry/TargetSelector";
import type { BackoffStrategy } from "../../../../src/apps/api-gateway/middleware/retry/BackoffStrategy";

function request(method = "GET") {
  return { method, url: "/resource", headers: {} } as never;
}

function selector(): TargetSelector {
  return { select: () => "http://upstream", onComplete: vi.fn() };
}

describe("RetryExecutor", () => {
  it("does not retry transport failures for methods excluded by retryMethods", async () => {
    let calls = 0;
    const client: UpstreamHttpClient = {
      send: async () => {
        calls++;
        throw new Error("connection reset");
      },
    };

    await expect(new RetryExecutor(
      { attempts: 3, delay: 0, retryMethods: ["GET"] },
      client,
      selector(),
      null,
    ).execute(request("POST"), Buffer.from("{}"), new AbortController().signal)).rejects.toThrow();

    expect(calls).toBe(1);
  });

  it("uses the supplied backoff strategy for retry delays", async () => {
    const computeDelay = vi.fn((attempt: number, base: number) => base + attempt * 10);
    const backoff: BackoffStrategy = { computeDelay };
    let calls = 0;
    const client: UpstreamHttpClient = {
      send: async () => {
        calls++;
        if (calls < 3) return { statusCode: 503, headers: {}, body: Buffer.alloc(0) };
        return { statusCode: 200, headers: {}, body: Buffer.from("ok") };
      },
    };

    const result = await new RetryExecutor(
      { attempts: 2, delay: 1 },
      client,
      selector(),
      null,
      backoff,
    ).execute(request(), Buffer.alloc(0), new AbortController().signal);

    expect(result.statusCode).toBe(200);
    expect(calls).toBe(3);
    expect(computeDelay).toHaveBeenNthCalledWith(1, 0, 1);
    expect(computeDelay).toHaveBeenNthCalledWith(2, 1, 1);
  });

  it("isolates collapsed callers when one client disconnects", async () => {
    let resolveUpstream!: (response: UpstreamResponse) => void;
    const client: UpstreamHttpClient = {
      send: vi.fn(
        (): Promise<UpstreamResponse> => new Promise((resolve) => {
          resolveUpstream = resolve;
        }),
      ),
    };
    const config = { attempts: 0, delay: 0, collapseRequests: true };
    const executor = new RetryExecutor(config, client, selector(), null);
    const firstController = new AbortController();
    const secondController = new AbortController();

    const first = executor.execute(request(), Buffer.alloc(0), firstController.signal);
    const second = executor.execute(request(), Buffer.alloc(0), secondController.signal);
    firstController.abort();
    resolveUpstream({ statusCode: 200, headers: {}, body: Buffer.from("ok") });

    await expect(first).rejects.toMatchObject({ name: "AbortError" });
    await expect(second).resolves.toMatchObject({ statusCode: 200 });
    expect(client.send).toHaveBeenCalledTimes(1);
  });
});
