// Shared across Home, Study Time Tracker, and Dashboard.
// Pairs with the tiny inline anti-flash script in each page's <head>,
// which resolves and applies the theme before first paint. This file
// wires up the Light/Dark/System control and keeps "System" live-synced
// to OS-level changes without needing a page reload.

window.STTTheme = (function () {
  const KEY = 'stt-theme-mode'; // 'light' | 'dark' | 'system'
  const mql = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function getMode() {
    try { return localStorage.getItem(KEY) || 'system'; } catch (e) { return 'system'; }
  }

  function resolve(mode) {
    if (mode === 'system') return (mql && mql.matches) ? 'dark' : 'light';
    return mode;
  }

  function applyResolved() {
    document.documentElement.setAttribute('data-theme', resolve(getMode()));
    updateUI();
  }

  function setMode(mode) {
    try { localStorage.setItem(KEY, mode); } catch (e) { /* ignore */ }
    applyResolved();
  }

  function updateUI() {
    const mode = getMode();
    document.querySelectorAll('.theme-mode-btn').forEach((btn) => {
      const isActive = btn.dataset.mode === mode;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }

  function mountToggle() {
    document.querySelectorAll('.theme-mode-btn').forEach((btn) => {
      btn.addEventListener('click', () => setMode(btn.dataset.mode));
    });
    updateUI();

    // If the person is on "System", keep the applied theme in sync with
    // OS-level changes made while the page is already open.
    if (mql) {
      mql.addEventListener('change', () => {
        if (getMode() === 'system') applyResolved();
      });
    }
  }

  return { getMode, setMode, mountToggle };
})();
