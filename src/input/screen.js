// Fullscreen, keyboard lock, and the "don't close my tab mid-run" guard.
//
// The problem this file exists to solve: sprint is Ctrl and forward is W, so
// running while sprinting IS Ctrl+W - which closes the tab on Windows and
// Linux. (On a Mac close-tab is Cmd+W, which is why it never happens there.)
//
// A page is NOT allowed to cancel Ctrl+W with preventDefault; browsers ignore
// it on purpose so a page can't trap you. The one real escape hatch is the
// Keyboard Lock API, which only works while fullscreen and only in Chrome and
// Edge. So we do both: lock the keys when we can, and keep a leave-guard as
// the net for every other browser.

// WASD are the keys worth locking: Ctrl+W closes the tab, Ctrl+S saves the
// page, Ctrl+D bookmarks it, Ctrl+A selects everything. All four are reachable
// while sprinting.
const GAME_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD'];

export const isFullscreen = () => !!document.fullscreenElement;

export const fullscreenSupported = () =>
  !!(document.documentElement.requestFullscreen && document.exitFullscreen);

async function lockKeys() {
  // Chrome/Edge only. Absent in Firefox and Safari, where the leave-guard
  // below is what saves the run instead.
  if (!navigator.keyboard?.lock) return false;
  try {
    await navigator.keyboard.lock(GAME_KEYS);
    return true;
  } catch {
    return false;                       // not allowed here; not fatal
  }
}

function unlockKeys() {
  try { navigator.keyboard?.unlock?.(); } catch { /* ignore */ }
}

/**
 * Toggle fullscreen, grabbing the browser's own keyboard shortcuts while we
 * are in it. Resolves to { ok, on, locked }: `ok` false means the browser
 * refused, `locked` false means it allowed fullscreen but not Keyboard Lock
 * (Firefox and Safari), so Ctrl+W is still live there.
 */
export async function toggleFullscreen(el = document.documentElement) {
  try {
    if (isFullscreen()) {
      unlockKeys();
      await document.exitFullscreen();
      return { ok: true, on: false, locked: false };
    }
    await el.requestFullscreen();
    return { ok: true, on: true, locked: await lockKeys() };
  } catch {
    // Some embedders refuse fullscreen outright. Say so rather than claiming
    // we left a fullscreen we never entered.
    return { ok: false, on: isFullscreen(), locked: false };
  }
}

// Leaving fullscreen by any route (Esc, F11, the browser's own button) has to
// drop the key lock too, or the shortcuts stay swallowed.
document.addEventListener('fullscreenchange', () => {
  if (!isFullscreen()) unlockKeys();
});

/**
 * Ask the browser to confirm before closing the tab while a run is going.
 *
 * `isRunActive` is called at close time and should return true only when
 * there's something to lose - otherwise quitting from the menu nags for no
 * reason. The browser shows its own wording; the returned string is ignored by
 * modern browsers but is still required to trigger the prompt.
 */
export function installLeaveGuard(isRunActive) {
  window.addEventListener('beforeunload', (e) => {
    if (!isRunActive()) return;
    e.preventDefault();
    e.returnValue = '';                 // required for the prompt to appear
  });
}
