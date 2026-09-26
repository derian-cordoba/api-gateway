import { HttpMethod } from "../../src/shared/http/HttpMethod";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StatusCodes } from "http-status-codes";
import {
  createHttpManager,
  HttpManager,
  type HttpTransport,
} from "../../src/shared/services/networking";

function fixture(
  response: () => Response | Promise<Response> = () =>
    Response.json({ ok: true }),
) {
  const send = vi.fn<HttpTransport["send"]>(async () => response());
  return { http: new HttpManager({ transport: { send } }), send };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("HttpManager", () => {
  it("preserves a base path, encodes query arrays, and merges headers case-insensitively", async () => {
    const { send } = fixture();
    let token = "first";
    const http = new HttpManager({
      baseURL: "https://gateway.test/management",
      headers: () => ({ Authorization: `Bearer ${token}`, "X-App": "test" }),
      transport: { send },
    });
    token = "current";
    await http.get("/v1/events?limit=50", {
      query: {
        limit: 25,
        tag: ["a b", "c"],
        enabled: false,
        missing: undefined,
      },
      headers: [["x-app", "override"]],
    });
    const [url, init] = send.mock.calls[0];
    expect(url).toBe(
      "https://gateway.test/management/v1/events?limit=25&tag=a+b&tag=c&enabled=false",
    );
    const headers = new Headers(init.headers);
    expect(headers.get("authorization")).toBe("Bearer current");
    expect(headers.get("x-app")).toBe("override");
    expect(init.cache).toBe("no-store");
  });

  it("serializes JSON and preserves raw body content types", async () => {
    const { http, send } = fixture();
    await http.post("/api/items", { json: { name: "example" } });
    expect(send.mock.calls[0][1].body).toBe('{"name":"example"}');
    expect(new Headers(send.mock.calls[0][1].headers).get("content-type")).toBe(
      "application/json",
    );
    const form = new FormData();
    form.append("name", "example");
    await http.post("/api/items", { body: form });
    expect(send.mock.calls[1][1].body).toBe(form);
    expect(new Headers(send.mock.calls[1][1].headers).has("content-type")).toBe(
      false,
    );
  });

  it("fails before sending ambiguous bodies or invalid timeout values", async () => {
    const { http, send } = fixture();
    await expect(
      http.post("/api", { json: {}, body: "other" }),
    ).rejects.toMatchObject({ kind: "configuration" });
    await expect(http.get("/api", { body: "invalid" })).rejects.toMatchObject({
      kind: "configuration",
    });
    await expect(http.get("/api", { timeoutMs: NaN })).rejects.toMatchObject({
      kind: "configuration",
    });
    expect(send).not.toHaveBeenCalled();
  });

  it.each([
    "https://other.test/secret",
    "//other.test/secret",
    "\\\\other.test/secret",
  ])(
    "rejects authority overrides when a base URL has configured credentials: %s",
    async (path) => {
      const { send } = fixture();
      const http = new HttpManager({
        baseURL: "https://gateway.test",
        transport: { send },
      });
      await expect(http.get(path)).rejects.toMatchObject({
        kind: "configuration",
      });
      expect(send).not.toHaveBeenCalled();
    },
  );

  it("retains structured HTTP errors and does not retry writes", async () => {
    const payload = {
      message: "Validation failed",
      issues: [{ path: ["name"], message: "Required" }],
    };
    const { http, send } = fixture(() =>
      Response.json(payload, { status: StatusCodes.UNPROCESSABLE_ENTITY }),
    );
    await expect(http.post("/api/items", { json: {} })).rejects.toMatchObject({
      kind: "http",
      status: StatusCodes.UNPROCESSABLE_ENTITY,
      message: payload.message,
      payload,
    });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("classifies HTML error responses as HTTP failures without displaying HTML", async () => {
    const { http } = fixture(
      () =>
        new Response("<h1>Unavailable</h1>", {
          status: StatusCodes.BAD_GATEWAY,
        }),
    );
    await expect(http.get("/api")).rejects.toMatchObject({
      kind: "http",
      status: StatusCodes.BAD_GATEWAY,
      message: "HTTP request failed (502).",
    });
  });

  it("retains malformed JSON causes and supports runtime validation", async () => {
    const { http } = fixture(() => new Response("{invalid"));
    await expect(http.get("/api")).rejects.toMatchObject({
      kind: "decode",
      cause: expect.any(SyntaxError),
    });
    const valid = fixture();
    const cause = new Error("Invalid schema");
    await expect(
      valid.http.get("/api", {
        decode: () => {
          throw cause;
        },
      }),
    ).rejects.toMatchObject({ kind: "decode", cause });
  });

  it.each([StatusCodes.NO_CONTENT, StatusCodes.RESET_CONTENT])(
    "handles empty status %s",
    async (status) => {
      const { http } = fixture(() => new Response(null, { status }));
      await expect(http.delete("/api")).resolves.toBeUndefined();
    },
  );

  it("handles HEAD and empty JSON success responses", async () => {
    const { http } = fixture(() => new Response(null));
    await expect(
      http.request("/api", { method: HttpMethod.HEAD }),
    ).resolves.toBeUndefined();
    await expect(http.get("/api")).resolves.toBeUndefined();
  });

  it("supports text, blob and array-buffer downloads", async () => {
    const { http } = fixture(() => new Response("content"));
    await expect(http.get("/api", { responseType: "text" })).resolves.toBe(
      "content",
    );
    const blob = await http.get<Blob>("/api", { responseType: "blob" });
    expect(await blob.text()).toBe("content");
    const bytes = await http.get<ArrayBuffer>("/api", {
      responseType: "arrayBuffer",
    });
    expect(new TextDecoder().decode(bytes)).toBe("content");
  });

  it("preserves network error causes", async () => {
    const cause = new TypeError("offline");
    const { http } = fixture(() => Promise.reject(cause));
    await expect(http.get("/api")).rejects.toMatchObject({
      kind: "network",
      cause,
    });
  });

  it("does not send an already cancelled request", async () => {
    const { http, send } = fixture();
    const controller = new AbortController();
    controller.abort("user cancellation");
    await expect(
      http.get("/api", { signal: controller.signal }),
    ).rejects.toMatchObject({ kind: "aborted", cause: "user cancellation" });
    expect(send).not.toHaveBeenCalled();
  });

  it("cancels pending requests even when a transport ignores the signal", async () => {
    const { http, send } = fixture(() => new Promise(() => {}));
    const controller = new AbortController();
    const pending = http.get("/api", { signal: controller.signal });
    const assertion = expect(pending).rejects.toMatchObject({
      kind: "aborted",
    });
    await vi.waitFor(() => expect(send).toHaveBeenCalled());
    controller.abort();
    await assertion;
    expect(send.mock.calls[0][1].signal?.aborted).toBe(true);
  });

  it("times out body consumption and cleans up the timer", async () => {
    vi.useFakeTimers();
    const response = new Response("pending");
    vi.spyOn(response, "text").mockImplementation(() => new Promise(() => {}));
    const { http } = fixture(() => response);
    const assertion = expect(
      http.get("/api", { timeoutMs: 50 }),
    ).rejects.toMatchObject({ kind: "timeout" });
    await vi.advanceTimersByTimeAsync(50);
    await assertion;
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cleans up the deadline after success", async () => {
    vi.useFakeTimers();
    const { http } = fixture();
    await http.get("/api");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("switches between live and mock transports without changing callers", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(Response.json({ source: "live" }));
    vi.stubGlobal("fetch", fetcher);
    await expect(createHttpManager().get("/api/events")).resolves.toEqual({
      source: "live",
    });
    fetcher.mockClear();
    const mock = createHttpManager({
      mode: "mock",
      routes: [
        {
          method: HttpMethod.GET,
          path: "/api/events",
          respond: ({ url }) =>
            Response.json({ limit: url.searchParams.get("limit") }),
        },
      ],
    });
    await expect(
      mock.get("/api/events", { query: { limit: 25 } }),
    ).resolves.toEqual({ limit: "25" });
    await expect(
      mock.get("/api/events", { query: { limit: 10 } }),
    ).resolves.toEqual({ limit: "10" });
    await expect(mock.get("/unmatched")).rejects.toMatchObject({
      kind: "configuration",
    });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
