// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { JsonValueInput } from "@/modules/shared/components/JsonValueInput";
import { RouteCard } from "@/modules/routes/components/RouteCard";
import { ValidationEditor } from "@/modules/validation/components/ValidationEditor";
import {
  KeyValueEditor,
  NumberListInput,
  StringListInput,
} from "@/modules/shared/components/FormControls";
import type { GatewayRoute } from "@/modules/configuration/types/configuration.types";

describe("dashboard React components", () => {
  it("renders route capabilities and delegates route actions", () => {
    const onDuplicate = vi.fn();
    const onDelete = vi.fn();
    const route: GatewayRoute = {
      baseURL: "/events",
      proxy: {
        target: "http://localhost:4100",
        upstreamAuth: { type: "hmac-sha256", secret: "secret" },
        mirror: { target: "http://localhost:4200", percentage: 25 },
      },
      validation: { allowedContentTypes: ["application/json"] },
      webhook: { provider: "github", secret: "webhook-secret" },
    };

    render(<RouteCard route={route} index={2} onDuplicate={onDuplicate} onDelete={onDelete} />);

    expect(screen.getByRole("heading", { name: "/events" })).toBeInTheDocument();
    expect(screen.getByText("Validation")).toBeInTheDocument();
    expect(screen.getByText("Webhook")).toBeInTheDocument();
    expect(screen.getByText("Signed upstream")).toBeInTheDocument();
    expect(screen.getByText("Mirroring")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Edit /events" })).toHaveAttribute(
      "href",
      "/routes/edit?index=2",
    );

    fireEvent.click(screen.getByRole("button", { name: "Duplicate /events" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete /events" }));
    expect(onDuplicate).toHaveBeenCalledOnce();
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it("parses JSON values and reports malformed input", () => {
    const onChange = vi.fn();
    render(<JsonValueInput value={{ ready: true }} onChange={onChange} />);
    const input = screen.getByRole("textbox");

    fireEvent.change(input, { target: { value: "{" } });
    expect(screen.getByText("Enter valid JSON before saving.")).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: '{"ready":false}' } });
    expect(screen.queryByText("Enter valid JSON before saving.")).not.toBeInTheDocument();
    expect(onChange).toHaveBeenLastCalledWith({ ready: false });

    fireEvent.change(input, { target: { value: "" } });
    expect(onChange).toHaveBeenLastCalledWith(undefined);
  });

  it("enables request validation with safe defaults", () => {
    const onChange = vi.fn();
    render(<ValidationEditor onChange={onChange} />);

    expect(screen.queryByText("Required body fields")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("switch", { name: "Enable Request validation" }));

    expect(onChange).toHaveBeenCalledWith({ allowedContentTypes: ["application/json"] });
  });

  it("adds a key-value row and keeps it editable until its key is committed", () => {
    const onChange = vi.fn();
    const { rerender } = render(<KeyValueEditor onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Add entry" }));
    const key = screen.getByRole("textbox", { name: "Header or pattern 1" });
    const value = screen.getByRole("textbox", { name: "Value 1" });
    expect(key).toBeInTheDocument();
    fireEvent.change(key, { target: { value: "X-Trace" } });
    fireEvent.change(value, { target: { value: "enabled" } });
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.blur(value, { relatedTarget: null });
    expect(onChange).toHaveBeenLastCalledWith({ "X-Trace": "enabled" });
    rerender(<KeyValueEditor value={{ "X-Trace": "enabled" }} onChange={onChange} />);
    expect(screen.getByRole("textbox", { name: "Header or pattern 1" })).toHaveValue("X-Trace");
  });

  it("does not turn an empty number-list segment into zero", () => {
    const onChange = vi.fn();
    const { container } = render(<NumberListInput onChange={onChange} />);
    fireEvent.change(container.querySelector("input")!, { target: { value: "2," } });
    expect(onChange).toHaveBeenCalledWith([2]);
    expect(container.querySelector("input")).toHaveValue("2,");
    fireEvent.change(container.querySelector("input")!, { target: { value: "2,3" } });
    expect(onChange).toHaveBeenLastCalledWith([2, 3]);
  });

  it("keeps a trailing newline while editing a string list", () => {
    const onChange = vi.fn();
    const { container } = render(<StringListInput onChange={onChange} />);
    const input = container.querySelector("textarea")!;
    fireEvent.change(input, { target: { value: "GET\n" } });
    expect(input).toHaveValue("GET\n");
    expect(onChange).toHaveBeenLastCalledWith(["GET"]);
    fireEvent.change(input, { target: { value: "GET\nPOST" } });
    expect(onChange).toHaveBeenLastCalledWith(["GET", "POST"]);
  });
});
