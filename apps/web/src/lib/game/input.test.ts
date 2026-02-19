// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createInputHandler } from "./input";

describe("createInputHandler", () => {
  let onInputChange: ReturnType<typeof vi.fn<(input: unknown) => void>>;
  let onAbility: ReturnType<typeof vi.fn<(slot: number) => void>>;
  let handler: ReturnType<typeof createInputHandler>;
  let mockCanvas: HTMLCanvasElement;

  beforeEach(() => {
    onInputChange = vi.fn<(input: unknown) => void>();
    onAbility = vi.fn<(slot: number) => void>();
    mockCanvas = document.createElement("canvas");
    handler = createInputHandler(
      onInputChange,
      onAbility,
      mockCanvas,
      () => null
    );
    handler.attach();
  });

  afterEach(() => {
    handler.detach();
  });

  function fireKeyDown(code: string, repeat = false) {
    window.dispatchEvent(
      new KeyboardEvent("keydown", { code, repeat, bubbles: true })
    );
  }

  function fireKeyUp(code: string) {
    window.dispatchEvent(new KeyboardEvent("keyup", { code, bubbles: true }));
  }

  it("calls onInputChange with up: true on W keydown", () => {
    fireKeyDown("KeyW");
    expect(onInputChange).toHaveBeenCalledWith(
      expect.objectContaining({ up: true })
    );
  });

  it("calls onInputChange with down: true on S keydown", () => {
    fireKeyDown("KeyS");
    expect(onInputChange).toHaveBeenCalledWith(
      expect.objectContaining({ down: true })
    );
  });

  it("calls onInputChange with left: true on A keydown", () => {
    fireKeyDown("KeyA");
    expect(onInputChange).toHaveBeenCalledWith(
      expect.objectContaining({ left: true })
    );
  });

  it("calls onInputChange with right: true on D keydown", () => {
    fireKeyDown("KeyD");
    expect(onInputChange).toHaveBeenCalledWith(
      expect.objectContaining({ right: true })
    );
  });

  it("calls onAbility(1) on Q keypress", () => {
    fireKeyDown("KeyQ");
    expect(onAbility).toHaveBeenCalledWith(1);
  });

  it("calls onAbility(2) on E keypress", () => {
    fireKeyDown("KeyE");
    expect(onAbility).toHaveBeenCalledWith(2);
  });

  it("calls onAbility(3) on R keypress", () => {
    fireKeyDown("KeyR");
    expect(onAbility).toHaveBeenCalledWith(3);
  });

  it("ignores repeated key events", () => {
    fireKeyDown("KeyW");
    onInputChange.mockClear();
    fireKeyDown("KeyW", true);
    expect(onInputChange).not.toHaveBeenCalled();
  });

  it("sets fire: true on Space keydown, fire: false on Space keyup", () => {
    fireKeyDown("Space");
    expect(onInputChange).toHaveBeenCalledWith(
      expect.objectContaining({ fire: true })
    );

    onInputChange.mockClear();
    fireKeyUp("Space");
    expect(onInputChange).toHaveBeenCalledWith(
      expect.objectContaining({ fire: false })
    );
  });

  it("resets all state on detach()", () => {
    fireKeyDown("KeyW");
    fireKeyDown("Space");
    handler.detach();

    expect(handler.state.up).toBe(false);
    expect(handler.state.down).toBe(false);
    expect(handler.state.left).toBe(false);
    expect(handler.state.right).toBe(false);
    expect(handler.state.fire).toBe(false);
    expect(handler.state.focus).toBe(false);
  });

  it("supports arrow keys for movement", () => {
    fireKeyDown("ArrowUp");
    expect(onInputChange).toHaveBeenCalledWith(
      expect.objectContaining({ up: true })
    );
  });

  it("sets focus: true on Shift keydown", () => {
    fireKeyDown("ShiftLeft");
    expect(onInputChange).toHaveBeenCalledWith(
      expect.objectContaining({ focus: true })
    );
  });
});
