import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-svelte";
import { page } from "vitest/browser";

import MatchFoundScreen from "./MatchFoundScreen.svelte";

describe("MatchFoundScreen", () => {
  const defaultProps = {
    playerName: "TestPlayer",
    playerRating: 1500,
    playerTier: "Gold",
    opponent: {
      id: 2,
      displayName: "Rival42",
      rating: 1650,
      tier: "Gold",
    },
  };

  it("renders player name", async () => {
    render(MatchFoundScreen, defaultProps);
    await expect.element(page.getByText("TestPlayer")).toBeInTheDocument();
  });

  it("renders player rating", async () => {
    render(MatchFoundScreen, defaultProps);
    await expect.element(page.getByText("1500")).toBeInTheDocument();
  });

  it("renders player tier badge", async () => {
    render(MatchFoundScreen, defaultProps);
    await expect.element(page.getByText("Gold").first()).toBeInTheDocument();
  });

  it("renders opponent name", async () => {
    render(MatchFoundScreen, defaultProps);
    await expect.element(page.getByText("Rival42")).toBeInTheDocument();
  });

  it("renders opponent rating", async () => {
    render(MatchFoundScreen, defaultProps);
    await expect.element(page.getByText("1650")).toBeInTheDocument();
  });

  it("renders opponent tier badge", async () => {
    render(MatchFoundScreen, {
      ...defaultProps,
      opponent: { ...defaultProps.opponent, tier: "Platinum" },
    });
    await expect.element(page.getByText("Platinum")).toBeInTheDocument();
  });

  it("renders VS text", async () => {
    render(MatchFoundScreen, defaultProps);
    await expect.element(page.getByText("VS")).toBeInTheDocument();
  });

  it("renders connecting text", async () => {
    render(MatchFoundScreen, defaultProps);
    await expect
      .element(page.getByText(/connecting to game/i))
      .toBeInTheDocument();
  });
});
