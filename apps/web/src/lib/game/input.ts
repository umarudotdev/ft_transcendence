export interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  fire: boolean;
  focus: boolean;
}

const KEY_MAP: Record<string, keyof InputState> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  KeyW: "up",
  KeyS: "down",
  KeyA: "left",
  KeyD: "right",
  Space: "fire",
  ShiftLeft: "focus",
  ShiftRight: "focus",
};

export function createInputHandler(
  onInputChange: (input: InputState) => void,
  onAbility: (slot: number) => void
) {
  const state: InputState = {
    up: false,
    down: false,
    left: false,
    right: false,
    fire: false,
    focus: false,
  };

  function handleKeyDown(e: KeyboardEvent) {
    if (e.repeat) return;

    const field = KEY_MAP[e.code];
    if (field && !state[field]) {
      state[field] = true;
      onInputChange({ ...state });
      e.preventDefault();
    }

    if (e.code === "KeyQ") {
      onAbility(1);
      e.preventDefault();
    }
    if (e.code === "KeyE") {
      onAbility(2);
      e.preventDefault();
    }
    if (e.code === "KeyR") {
      onAbility(3);
      e.preventDefault();
    }
  }

  function handleKeyUp(e: KeyboardEvent) {
    const field = KEY_MAP[e.code];
    if (field && state[field]) {
      state[field] = false;
      onInputChange({ ...state });
      e.preventDefault();
    }
  }

  function attach() {
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
  }

  function detach() {
    window.removeEventListener("keydown", handleKeyDown);
    window.removeEventListener("keyup", handleKeyUp);
    state.up = false;
    state.down = false;
    state.left = false;
    state.right = false;
    state.fire = false;
    state.focus = false;
  }

  return { attach, detach, state };
}
