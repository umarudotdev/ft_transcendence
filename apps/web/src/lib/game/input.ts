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

  function updateAimAngle(clientX: number, clientY: number) {
    const pos = getMyPosition();
    if (!pos) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const cursorX = (clientX - rect.left) * scaleX;
    const cursorY = (clientY - rect.top) * scaleY;

    const dx = cursorX - pos.x;
    const dy = cursorY - pos.y;

    const newAngle = Math.atan2(dx, -dy);
    if (newAngle !== state.aimAngle) {
      state.aimAngle = newAngle;
      onInputChange({ ...state });
    }
  }

  function handleMouseMove(e: MouseEvent) {
    updateAimAngle(e.clientX, e.clientY);
  }

  function handleMouseDown(e: MouseEvent) {
    if (e.button === 0) {
      // Left-click: fire
      if (!state.fire) {
        state.fire = true;
        onInputChange({ ...state });
      }
      e.preventDefault();
    } else if (e.button === 2) {
      // Right-click: dash
      onAbility(1);
      e.preventDefault();
    }
  }

  function handleMouseUp(e: MouseEvent) {
    if (e.button === 0 && state.fire) {
      state.fire = false;
      onInputChange({ ...state });
      e.preventDefault();
    }
  }

  function handleContextMenu(e: Event) {
    e.preventDefault();
  }

  function attach() {
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mouseup", handleMouseUp);
    canvas.addEventListener("contextmenu", handleContextMenu);
  }

  function detach() {
    window.removeEventListener("keydown", handleKeyDown);
    window.removeEventListener("keyup", handleKeyUp);
    canvas.removeEventListener("mousemove", handleMouseMove);
    canvas.removeEventListener("mousedown", handleMouseDown);
    canvas.removeEventListener("mouseup", handleMouseUp);
    canvas.removeEventListener("contextmenu", handleContextMenu);
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
