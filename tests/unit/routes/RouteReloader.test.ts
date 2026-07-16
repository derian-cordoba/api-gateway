import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import { EventEmitter } from "node:events";
import type { RequestHandler } from "express";
import type { Router as ExpressRouter } from "express";

// ── Hoisted mock state (accessible inside vi.mock factories) ─────────────────

const { mockBuild, mockWatch, mockWatcherEmitter } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { EventEmitter } = require("node:events") as typeof import("node:events");
  const emitter = Object.assign(new EventEmitter(), {
    close: vi.fn() as Mock,
  }) as EventEmitter & { close: Mock };

  const build = vi.fn();
  const watch = vi.fn(() => emitter);

  return { mockBuild: build, mockWatch: watch, mockWatcherEmitter: emitter };
});

vi.mock("../../../src/apps/api-gateway/routes/ProxyManager", () => ({
  ProxyManager: { build: mockBuild },
}));

vi.mock("node:fs", () => ({ watch: mockWatch }));

vi.mock("../../../src/apps/api-gateway/config/app-env", () => ({
  appEnv: { routes: { filePath: "/fake/routes.json" } },
}));

vi.mock("../../../src/apps/api-gateway/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Import after mocks ───────────────────────────────────────────────────────

import { RouteReloader } from "../../../src/apps/api-gateway/routes/RouteReloader";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRouter(id: string) {
  const fn = vi.fn((_req, _res, next: () => void) => next()) as unknown as ExpressRouter;
  (fn as unknown as { _id: string })._id = id;
  return fn;
}

function makeBuildResult(id = "router-a") {
  return { router: makeRouter(id), wsHandlers: [] };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("RouteReloader", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockBuild.mockResolvedValue(makeBuildResult());
    mockWatch.mockReturnValue(mockWatcherEmitter);
    mockWatcherEmitter.close.mockReset();
    mockWatcherEmitter.removeAllListeners();
    process.removeAllListeners("SIGHUP");
  });

  afterEach(() => {
    vi.useRealTimers();
    process.removeAllListeners("SIGHUP");
  });

  // ── start() ──────────────────────────────────────────────────────────────

  it("calls ProxyManager.build once on start()", async () => {
    const reloader = new RouteReloader();
    await reloader.start();

    expect(mockBuild).toHaveBeenCalledOnce();
    reloader.stop();
  });

  it("starts watching the routes file", async () => {
    const reloader = new RouteReloader();
    await reloader.start();

    expect(mockWatch).toHaveBeenCalledWith("/fake/routes.json", expect.any(Function));
    reloader.stop();
  });

  it("registers a SIGHUP listener", async () => {
    const reloader = new RouteReloader();
    const before = process.listenerCount("SIGHUP");
    await reloader.start();

    expect(process.listenerCount("SIGHUP")).toBe(before + 1);
    reloader.stop();
  });

  // ── getDelegatorMiddleware() ──────────────────────────────────────────────

  it("delegates requests to the current inner router", async () => {
    const result = makeBuildResult("router-a");
    mockBuild.mockResolvedValue(result);

    const reloader = new RouteReloader();
    await reloader.start();

    const delegator = reloader.getDelegatorMiddleware();
    const fakeReq = {} as Parameters<RequestHandler>[0];
    const fakeRes = {} as Parameters<RequestHandler>[1];
    const fakeNext = vi.fn();

    delegator(fakeReq, fakeRes, fakeNext);

    expect(result.router).toHaveBeenCalledWith(fakeReq, fakeRes, fakeNext);
    reloader.stop();
  });

  it("after SIGHUP reload the delegator uses the new inner router", async () => {
    const routerA = makeBuildResult("router-a");
    const routerB = makeBuildResult("router-b");
    mockBuild
      .mockResolvedValueOnce(routerA)
      .mockResolvedValueOnce(routerB);

    const reloader = new RouteReloader();
    await reloader.start();

    // Trigger reload via SIGHUP
    process.emit("SIGHUP");
    // Flush microtasks so the async reload promise resolves
    await vi.runAllTimersAsync();
    await Promise.resolve();
    await Promise.resolve(); // two ticks to cover promise chain depth

    const delegator = reloader.getDelegatorMiddleware();
    const fakeReq = {} as Parameters<RequestHandler>[0];
    const fakeRes = {} as Parameters<RequestHandler>[1];
    const fakeNext = vi.fn();

    delegator(fakeReq, fakeRes, fakeNext);

    expect(routerA.router).not.toHaveBeenCalled();
    expect(routerB.router).toHaveBeenCalledWith(fakeReq, fakeRes, fakeNext);
    reloader.stop();
  });

  // ── stop() ───────────────────────────────────────────────────────────────

  it("removes the SIGHUP listener on stop()", async () => {
    const reloader = new RouteReloader();
    await reloader.start();
    const before = process.listenerCount("SIGHUP");

    reloader.stop();

    expect(process.listenerCount("SIGHUP")).toBe(before - 1);
  });

  it("closes the file watcher on stop()", async () => {
    const reloader = new RouteReloader();
    await reloader.start();

    reloader.stop();

    expect(mockWatcherEmitter.close).toHaveBeenCalledOnce();
  });

  it("is safe to call stop() multiple times", async () => {
    const reloader = new RouteReloader();
    await reloader.start();

    reloader.stop();
    reloader.stop(); // should not throw

    expect(mockWatcherEmitter.close).toHaveBeenCalledOnce();
  });

  // ── debounce ─────────────────────────────────────────────────────────────

  it("debounces rapid file-change events into a single reload", async () => {
    mockBuild.mockResolvedValue(makeBuildResult());

    const reloader = new RouteReloader();
    await reloader.start();

    const callsBefore = mockBuild.mock.calls.length;

    // Simulate three rapid file-change events (fs.watch fires the callback)
    const watchCallback = mockWatch.mock.calls[0][1] as () => void;
    watchCallback();
    watchCallback();
    watchCallback();

    // Advance time past the debounce window
    await vi.advanceTimersByTimeAsync(400);

    expect(mockBuild.mock.calls.length - callsBefore).toBe(1);
    reloader.stop();
  });

  it("resets the debounce timer on each new file-change event", async () => {
    mockBuild.mockResolvedValue(makeBuildResult());

    const reloader = new RouteReloader();
    await reloader.start();

    const callsBefore = mockBuild.mock.calls.length;
    const watchCallback = mockWatch.mock.calls[0][1] as () => void;

    watchCallback();
    await vi.advanceTimersByTimeAsync(200); // before debounce fires (300ms window)
    watchCallback();                         // reset the timer
    await vi.advanceTimersByTimeAsync(200); // 200ms from second call — not yet fired

    expect(mockBuild.mock.calls.length - callsBefore).toBe(0);

    await vi.advanceTimersByTimeAsync(200); // now > 300ms from second call
    expect(mockBuild.mock.calls.length - callsBefore).toBe(1);
    reloader.stop();
  });

  // ── error resilience ─────────────────────────────────────────────────────

  it("keeps the current router when reload fails and does not throw", async () => {
    const good = makeBuildResult("router-good");
    mockBuild
      .mockResolvedValueOnce(good)
      .mockRejectedValueOnce(new Error("bad config"));

    const reloader = new RouteReloader();
    await reloader.start();

    // Trigger a failing reload via SIGHUP
    process.emit("SIGHUP");
    await vi.runAllTimersAsync();
    await Promise.resolve();
    await Promise.resolve();

    // Delegator should still use the original router
    const delegator = reloader.getDelegatorMiddleware();
    const fakeReq = {} as Parameters<RequestHandler>[0];
    const fakeRes = {} as Parameters<RequestHandler>[1];
    const fakeNext = vi.fn();

    delegator(fakeReq, fakeRes, fakeNext);

    expect(good.router).toHaveBeenCalledWith(fakeReq, fakeRes, fakeNext);
    reloader.stop();
  });
});
