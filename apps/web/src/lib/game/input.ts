export interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  fire: boolean;
  focus: boolean;
  aimAngle: number;
}

type BooleanKey = "up" | "down" | "left" | "right" | "fire" | "focus";

const KEY_MAP: Record<string, BooleanKey> = {
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
  onAbility: (slot: number) => void,
  canvas: HTMLCanvasElement,
  getMyPosition: () => { x: number; y: number } | null
) {
  const state: InputState = {
    up: false,
    down: false,
    left: false,
    right: false,
    fire: false,
    focus: false,
    aimAngle: 0,
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

  function handleMouseMove(e: MouseEvent) {
    const pos = getMyPosition();
    if (!pos) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const cursorX = (e.clientX - rect.left) * scaleX;
    const cursorY = (e.clientY - rect.top) * scaleY;

    const dx = cursorX - pos.x;
    const dy = cursorY - pos.y;

    const newAngle = Math.atan2(dx, -dy);
    if (newAngle !== state.aimAngle) {
      state.aimAngle = newAngle;
      onInputChange({ ...state });
    }
  }

  function attach() {
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    canvas.addEventListener("mousemove", handleMouseMove);
  }

  function detach() {
    window.removeEventListener("keydown", handleKeyDown);
    window.removeEventListener("keyup", handleKeyUp);
    canvas.removeEventListener("mousemove", handleMouseMove);
    state.up = false;
    state.down = false;
    state.left = false;
    state.right = false;
    state.fire = false;
    state.focus = false;
    state.aimAngle = 0;
  }

  return { attach, detach, state };
}
