// Keyboard and mouse input. Held keys give a movement direction; one-shot
// presses (confirm, pause, sneak toggle is held instead) are queued as bit
// flags and taken once by the loop, so a press between two frames is never
// lost and never counted twice. Clicking the canvas throws a pebble at that
// point; the world decides whether the throw is legal.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const SNEAK = new Set(['ShiftLeft', 'ShiftRight']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const MUTE = new Set(['KeyM']);

export function createInput(target) {
  const held = new Set();
  let actions = 0;
  let click = null;

  function keyDown(event) {
    if (
      UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) ||
      RIGHT.has(event.code) || SNEAK.has(event.code)
    ) {
      held.add(event.code);
      event.preventDefault();
      return;
    }
    if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
      event.preventDefault();
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
      event.preventDefault();
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    }
  }

  function keyUp(event) {
    held.delete(event.code);
  }

  window.addEventListener('keydown', keyDown);
  window.addEventListener('keyup', keyUp);
  // A key released while the tab is hidden never sends keyup: let go on blur.
  window.addEventListener('blur', () => held.clear());
  target.addEventListener('pointerdown', (event) => {
    const rect = target.getBoundingClientRect();
    click = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  });

  function hasAny(codes) {
    for (const code of codes) if (held.has(code)) return true;
    return false;
  }

  return {
    /** Normalised movement direction from the held keys, or {x:0, y:0}. */
    direction() {
      const x = (hasAny(RIGHT) ? 1 : 0) - (hasAny(LEFT) ? 1 : 0);
      const y = (hasAny(DOWN) ? 1 : 0) - (hasAny(UP) ? 1 : 0);
      if (x === 0 && y === 0) return { x: 0, y: 0 };
      const length = Math.hypot(x, y);
      return { x: x / length, y: y / length };
    },
    /** True while either Shift key is held: the player sneaks. */
    sneaking() {
      return hasAny(SNEAK);
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** The canvas click since the last call, in canvas pixels, or null. */
    takeClick() {
      const taken = click;
      click = null;
      return taken;
    },
  };
}
