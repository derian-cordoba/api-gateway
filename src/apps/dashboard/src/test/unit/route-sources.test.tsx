// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { RouteSourcesCard } from "@/modules/route-sources/components/RouteSourcesCard";
import { routeSourcesService } from "@/modules/route-sources/services/route-sources";
import { configurationService } from "@/modules/configuration/services/configuration";

vi.mock("@/modules/configuration/hooks/useConfiguration", () => ({
  useConfiguration: () => ({ sourceId: "default", saving: false }),
}));
vi.mock("@/modules/configuration/services/configuration", () => ({
  configurationService: { selectSource: vi.fn() },
}));
vi.mock("@/modules/route-sources/services/route-sources", () => ({
  routeSourcesService: { list: vi.fn(), check: vi.fn(), activate: vi.fn() },
}));
const runtime = {
  instanceId: "test",
  desired: { sourceId: "default", version: 3 },
  applied: { sourceId: "default", version: 3 },
  revision: "a".repeat(16),
  status: "synchronized" as const,
  activationEnabled: true,
};
beforeEach(() => {
  vi.mocked(routeSourcesService.list).mockResolvedValue({
    sources: [
      { id: "default", name: "Default source", driver: "local-json", configurationKey: "default" },
      { id: "preview", name: "Preview", driver: "sqlite", configurationKey: "default" },
    ],
    runtime,
    runtimeError: null,
  });
  vi.mocked(routeSourcesService.check).mockResolvedValue({
    sourceId: "default",
    status: "ready",
    routeCount: 2,
    revision: "a".repeat(16),
  });
  vi.mocked(routeSourcesService.activate).mockResolvedValue(runtime);
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.open = true;
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.open = false;
  });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it("keeps selecting an editing source separate from confirming live activation", async () => {
  render(<RouteSourcesCard />);
  const selector = await screen.findByLabelText("Source to edit");
  expect(selector).toHaveClass("input", "select");
  expect(await screen.findByLabelText("Route storage driver")).toHaveClass("input", "select");
  expect(routeSourcesService.activate).not.toHaveBeenCalled();
  const activate = await screen.findByRole("button", { name: "Activate source…" });
  await waitFor(() => expect(activate).not.toBeDisabled());
  fireEvent.click(activate);
  expect(screen.getByRole("heading", { name: "Activate Default source?" })).toBeInTheDocument();
  expect(routeSourcesService.activate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Activate source" }));
  await waitFor(() =>
    expect(routeSourcesService.activate).toHaveBeenCalledWith("default", 3, "a".repeat(16)),
  );
});
it("does not offer activation when gateway status is unavailable", async () => {
  vi.mocked(routeSourcesService.list).mockResolvedValue({
    sources: [],
    runtime: null,
    runtimeError: "Gateway unavailable",
  });
  render(<RouteSourcesCard />);
  await screen.findByText("Gateway unavailable");
  expect(screen.queryByRole("button", { name: "Activate source…" })).not.toBeInTheDocument();
});

it("offers all storage drivers and switches editing to a configured driver", async () => {
  render(<RouteSourcesCard />);
  const driver = await screen.findByLabelText("Route storage driver");
  expect(screen.getByRole("option", { name: "Legacy — JSON file" })).toBeEnabled();
  expect(screen.getByRole("option", { name: "Database — SQLite" })).toBeEnabled();
  expect(
    screen.getByRole("option", { name: "Database — PostgreSQL (not configured)" }),
  ).toBeDisabled();
  expect(
    screen.getByRole("option", { name: "Database — MongoDB (not configured)" }),
  ).toBeDisabled();
  fireEvent.change(driver, { target: { value: "sqlite" } });
  expect(configurationService.selectSource).toHaveBeenCalledWith("preview");
  expect(routeSourcesService.activate).not.toHaveBeenCalled();
});

it("selects development before production when switching remote drivers", async () => {
  vi.mocked(routeSourcesService.list).mockResolvedValue({
    sources: [
      { id: "default", name: "Default", driver: "local-json", configurationKey: "default" },
      {
        id: "prod",
        name: "Production",
        driver: "postgres",
        environment: "production",
        configurationKey: "default",
      },
      {
        id: "dev",
        name: "Development",
        driver: "postgres",
        environment: "development",
        configurationKey: "default",
      },
    ],
    runtime,
    runtimeError: null,
  });
  render(<RouteSourcesCard />);
  fireEvent.change(await screen.findByLabelText("Route storage driver"), {
    target: { value: "postgres" },
  });
  expect(configurationService.selectSource).toHaveBeenCalledWith("dev");
});
