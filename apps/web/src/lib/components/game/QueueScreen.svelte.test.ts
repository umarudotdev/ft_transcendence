import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-svelte";
import { page } from "vitest/browser";

import QueueScreen from "./QueueScreen.svelte";

describe("QueueScreen", () => {
  const defaultProps = {
    elapsedSeconds: 65,
    queuePosition: 3,
    estimatedWait: 30,
    mode: "ranked" as const,
    onCancel: vi.fn(),
  };

  it("renders queue timer text", async () => {
    render(QueueScreen, defaultProps);
    await expect.element(page.getByText("1:05")).toBeInTheDocument();
  });

  it("renders RANKED badge when mode is ranked", async () => {
    render(QueueScreen, defaultProps);
    await expect.element(page.getByText("RANKED")).toBeInTheDocument();
  });

  it("renders CASUAL badge when mode is casual", async () => {
    render(QueueScreen, { ...defaultProps, mode: "casual" as const });
    await expect.element(page.getByText("CASUAL")).toBeInTheDocument();
  });

  it("renders queue position when > 0", async () => {
    render(QueueScreen, defaultProps);
    await expect.element(page.getByText(/Position.*3/)).toBeInTheDocument();
  });

  it("renders estimated wait time", async () => {
    render(QueueScreen, defaultProps);
    await expect.element(page.getByText(/30s/)).toBeInTheDocument();
  });

  it("cancel button calls onCancel when clicked", async () => {
    const onCancel = vi.fn();
    render(QueueScreen, { ...defaultProps, onCancel });

    const cancelButton = page.getByRole("button", { name: /cancel/i });
    await cancelButton.click();
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("contains animated ring elements", async () => {
    render(QueueScreen, defaultProps);
    const rings = page.getByRole("presentation");
    await expect.element(rings.first()).toBeInTheDocument();
  });
});
