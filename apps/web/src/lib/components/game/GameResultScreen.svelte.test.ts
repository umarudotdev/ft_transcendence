import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-svelte";
import { page } from "vitest/browser";

import GameResultScreen from "./GameResultScreen.svelte";

describe("GameResultScreen", () => {
  const defaultProps = {
    won: true,
    score: 3,
    opponentScore: 1,
    matchResult: { won: true, ratingChange: 25, newRating: 1525 },
    onPlayAgain: vi.fn(),
    onBackToLobby: vi.fn(),
  };

  it("renders VICTORY when won is true", async () => {
    render(GameResultScreen, defaultProps);
    await expect.element(page.getByText("VICTORY")).toBeInTheDocument();
  });

  it("renders DEFEAT when won is false", async () => {
    render(GameResultScreen, {
      ...defaultProps,
      won: false,
      matchResult: { won: false, ratingChange: -20, newRating: 1480 },
    });
    await expect.element(page.getByText("DEFEAT")).toBeInTheDocument();
  });

  it("renders score", async () => {
    render(GameResultScreen, defaultProps);
    await expect.element(page.getByText(/3.*-.*1/)).toBeInTheDocument();
  });

  it("renders rating change with correct sign", async () => {
    render(GameResultScreen, defaultProps);
    await expect.element(page.getByText("+25")).toBeInTheDocument();
  });

  it("renders new rating", async () => {
    render(GameResultScreen, defaultProps);
    await expect.element(page.getByText("1525")).toBeInTheDocument();
  });

  it("Play Again button calls onPlayAgain", async () => {
    const onPlayAgain = vi.fn();
    render(GameResultScreen, { ...defaultProps, onPlayAgain });

    const btn = page.getByRole("button", { name: /play again/i });
    await btn.click();
    expect(onPlayAgain).toHaveBeenCalledOnce();
  });

  it("Back to Lobby button calls onBackToLobby", async () => {
    const onBackToLobby = vi.fn();
    render(GameResultScreen, { ...defaultProps, onBackToLobby });

    const btn = page.getByRole("button", { name: /back to lobby/i });
    await btn.click();
    expect(onBackToLobby).toHaveBeenCalledOnce();
  });
});
