// Keyboard + mouse input. Keys are read as a held set every frame; single
// presses (E, Space, R, P, M, Enter) are consumed as one-shot actions.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER_CAR = 4;
export const ACTION_PUNCH = 8;
export const ACTION_RELOAD = 16;
export const ACTION_MISSION = 32;

export function createInput(canvas) {
  const held = new Set();
  const queue = [];
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;
  let mouseClicked = false;

  function key(e) {
    return e.code;
  }

  window.addEventListener('keydown', (e) => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    if (!e.repeat) {
      held.add(key(e));
      if (e.code === 'Enter' || e.code === 'Space') queue.push(ACTION_CONFIRM);
      if (e.code === 'KeyP' || e.code === 'Escape') queue.push(ACTION_PAUSE);
      if (e.code === 'KeyE') queue.push(ACTION_ENTER_CAR);
      if (e.code === 'KeyR') queue.push(ACTION_RELOAD);
      if (e.code === 'KeyM') queue.push(ACTION_MISSION);
      if (e.code === 'Space') queue.push(ACTION_PUNCH);
    }
  });
  window.addEventListener('keyup', (e) => held.delete(key(e)));
  window.addEventListener('blur', () => held.clear());

  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouseX = e.clientX - r.left;
    mouseY = e.clientY - r.top;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      mouseDown = true;
      mouseClicked = true;
    }
  });
  window.addEventListener('mouseup', () => {
    mouseDown = false;
  });

  return {
    // Normalised WASD / arrow movement vector.
    move() {
      let x = 0;
      let y = 0;
      if (held.has('KeyA') || held.has('ArrowLeft')) x -= 1;
      if (held.has('KeyD') || held.has('ArrowRight')) x += 1;
      if (held.has('KeyW') || held.has('ArrowUp')) y -= 1;
      if (held.has('KeyS') || held.has('ArrowDown')) y += 1;
      if (x !== 0 && y !== 0) {
        x *= Math.SQRT1_2;
        y *= Math.SQRT1_2;
      }
      return { x, y };
    },
    running() {
      return held.has('ShiftLeft') || held.has('ShiftRight');
    },
    takeActions() {
      let a = 0;
      while (queue.length) a |= queue.shift();
      return a;
    },
    mouse() {
      return { x: mouseX, y: mouseY, down: mouseDown, clicked: mouseClicked };
    },
    takeClick() {
      const c = mouseClicked;
      mouseClicked = false;
      return c;
    },
    // For scripted play-tests: pretend a key is held.
    press(code) {
      held.add(code);
    },
    release(code) {
      held.delete(code);
    },
  };
}
