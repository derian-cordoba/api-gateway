// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { StatusCodes as HttpStatus } from "http-status-codes";
import { describe, expect, it, vi } from "vitest";
import { AuthenticationEditor } from "@/modules/authentication/components/AuthenticationEditor";
import { CircuitBreakerEditor } from "@/modules/circuit-breaker/components/CircuitBreakerEditor";
import { CorsEditor } from "@/modules/cors/components/CorsEditor";
import { HeadersEditor } from "@/modules/headers/components/HeadersEditor";
import { ProxyEditor } from "@/modules/proxy/components/ProxyEditor";
import { RetryEditor } from "@/modules/retry/components/RetryEditor";
import { WebhookEditor } from "@/modules/webhook/components/WebhookEditor";

describe("dashboard feature editors", () => {
  it("switches authentication strategy through its field component", () => {
    const onChange = vi.fn();
    render(
      <AuthenticationEditor
        value={{ enabled: true, strategy: "jwt", secret: "" }}
        onChange={onChange}
      />,
    );
    expect(screen.getByRole("group", { name: "Forward claims" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Strategy"), { target: { value: "apiKey" } });
    expect(onChange).toHaveBeenCalledWith({
      enabled: true,
      strategy: "apiKey",
      header: "x-api-key",
      keys: [""],
    });
  });

  it("switches proxy upstream mode", () => {
    const onChange = vi.fn();
    render(
      <ProxyEditor
        value={{ target: "http://localhost:4100" }}
        retryEnabled={false}
        onChange={onChange}
      />,
    );
    expect(screen.getByRole("button", { name: "Single target" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: "Load balanced" }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        strategy: "round-robin",
        targets: [{ url: "http://localhost:4001" }, { url: "http://localhost:4002" }],
      }),
    );
  });

  it("updates a load-balanced target through its row component", () => {
    const onChange = vi.fn();
    render(
      <ProxyEditor
        value={{
          targets: [{ url: "http://localhost:4001" }, { url: "http://localhost:4002" }],
          strategy: "round-robin",
        }}
        retryEnabled={false}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Target 1 URL" }), {
      target: { value: "http://localhost:5001" },
    });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        targets: [{ url: "http://localhost:5001" }, { url: "http://localhost:4002" }],
      }),
    );
  });

  it("updates a basic-auth credential through its row component", () => {
    const onChange = vi.fn();
    render(
      <AuthenticationEditor
        value={{
          enabled: true,
          strategy: "basicAuth",
          credentials: [{ username: "alice", password: "secret" }],
        }}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Username 1" }), {
      target: { value: "bob" },
    });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        credentials: [{ username: "bob", password: "secret" }],
      }),
    );
  });

  it("enables circuit-breaker health checks and retry fallback", () => {
    const onCircuitChange = vi.fn();
    const onRetryChange = vi.fn();
    render(
      <CircuitBreakerEditor value={{ threshold: 5, timeout: 30000 }} onChange={onCircuitChange} />,
    );
    fireEvent.click(screen.getByRole("switch", { name: "Use active health checks" }));
    expect(onCircuitChange).toHaveBeenCalledWith(
      expect.objectContaining({
        healthCheck: { url: "http://localhost:4000/health", intervalMs: 10000 },
      }),
    );

    render(<RetryEditor value={{ attempts: 3, delay: 250 }} onChange={onRetryChange} />);
    fireEvent.click(
      screen.getByRole("switch", {
        name: "Serve a fallback after retries are exhausted",
      }),
    );
    expect(onRetryChange).toHaveBeenCalledWith(
      expect.objectContaining({
        fallback: { status: HttpStatus.BAD_GATEWAY, body: { error: "Upstream unavailable" } },
      }),
    );
  });

  it("updates CORS origins, webhook providers, and header transforms", () => {
    const onCorsChange = vi.fn();
    const onWebhookChange = vi.fn();
    const onHeadersChange = vi.fn();
    render(<CorsEditor value={{ origin: "*" }} onChange={onCorsChange} />);
    fireEvent.change(screen.getByLabelText("Origin mode"), { target: { value: "multiple" } });
    expect(onCorsChange).toHaveBeenCalledWith({ origin: ["https://app.example.com"] });

    render(<WebhookEditor value={{ provider: "github", secret: "" }} onChange={onWebhookChange} />);
    fireEvent.change(screen.getByLabelText("Provider"), { target: { value: "custom" } });
    expect(onWebhookChange).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "custom",
        headerName: "x-webhook-signature",
        hashAlgorithm: "sha256",
      }),
    );

    render(<HeadersEditor value={{ request: { set: {} } }} onChange={onHeadersChange} />);
    fireEvent.click(screen.getByRole("switch", { name: "Response headers" }));
    expect(onHeadersChange).toHaveBeenCalledWith({
      request: { set: {} },
      response: { set: {} },
    });
  });
});
