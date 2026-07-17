import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "node:events";
import { createTimeoutMiddleware } from "../../../src/apps/api-gateway/middleware/timeout";
import type { Request, Response } from "express";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRes(headersSent = false) {
  const emitter = new EventEmitter();
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  return Object.assign(emitter, {
    status,
    json,
    headersSent,
    _json: json,
    _status: status,
  });
}

function makeReq() {
  return {} as Request;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("createTimeoutMiddleware", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls next() immediately", () => {
    const next = vi.fn();
    const middleware = createTimeoutMiddleware(1000);
    middleware(makeReq(), makeRes() as unknown as Response, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("does not send a response before the timeout elapses", () => {
    const next = vi.fn();
    const res = makeRes();
    const middleware = createTimeoutMiddleware(500);

    middleware(makeReq(), res as unknown as Response, next);
    vi.advanceTimersByTime(499);

    expect(res.status).not.toHaveBeenCalled();
  });

  it("sends 504 Gateway Timeout when the timer fires", () => {
    const next = vi.fn();
    const res = makeRes();
    const middleware = createTimeoutMiddleware(500);

    middleware(makeReq(), res as unknown as Response, next);
    vi.advanceTimersByTime(500);

    expect(res.status).toHaveBeenCalledWith(504);
    const jsonCall = (res.status as ReturnType<typeof vi.fn>).mock.results[0].value.json;
    expect(jsonCall).toHaveBeenCalledWith(
      expect.objectContaining({ error: "Gateway Timeout" })
    );
  });

  it("includes the configured timeout duration in the message", () => {
    const next = vi.fn();
    const res = makeRes();
    createTimeoutMiddleware(3000)(makeReq(), res as unknown as Response, next);
    vi.advanceTimersByTime(3000);

    const jsonCall = (res.status as ReturnType<typeof vi.fn>).mock.results[0].value.json;
    const body = jsonCall.mock.calls[0][0] as { message: string };
    expect(body.message).toContain("3000ms");
  });

  it("does not send 504 if response headers were already sent", () => {
    const next = vi.fn();
    const res = makeRes(true /* headersSent */);
    const middleware = createTimeoutMiddleware(200);

    middleware(makeReq(), res as unknown as Response, next);
    vi.advanceTimersByTime(200);

    expect(res.status).not.toHaveBeenCalled();
  });

  it("clears the timer when the response emits 'finish' before timeout", () => {
    const next = vi.fn();
    const res = makeRes();
    const middleware = createTimeoutMiddleware(1000);

    middleware(makeReq(), res as unknown as Response, next);
    res.emit("finish");
    vi.advanceTimersByTime(1000);

    expect(res.status).not.toHaveBeenCalled();
  });

  it("clears the timer when the response emits 'close' before timeout", () => {
    const next = vi.fn();
    const res = makeRes();
    const middleware = createTimeoutMiddleware(1000);

    middleware(makeReq(), res as unknown as Response, next);
    res.emit("close");
    vi.advanceTimersByTime(1000);

    expect(res.status).not.toHaveBeenCalled();
  });
});
