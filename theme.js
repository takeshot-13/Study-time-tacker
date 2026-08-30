// Shared across Home, Study Time Tracker, and Dashboard.
// Pairs with the tiny inline anti-flash script in each page's <head>,
// which sets the data-theme attribute before first paint. This file only
// wires up the toggle button and keeps it in sync with the current theme.

window.STTTheme = (function () {
  const KEY = 'stt-theme';

  function getStored() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }

  function current() {
    return document.documentElement.getAttribute('data-theme') || 'light';
  }

  function apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem(KEY, theme); } catch (e) { /* ignore */ }
    updateToggleUI();
  }

  function toggle() {
    apply(current() === 'dark' ? 'light' : 'dark');
  }

  function updateToggleUI() {
    const label = document.getElementById('themeToggleLabel');
    if (label) label.textContent = current() === 'dark' ? 'Dark mode' : 'Light mode';
  }

  function mountToggle() {
    const btn = document.getElementById('themeToggle');
    if (!btn) return;
    btn.addEventListener('click', toggle);
    updateToggleUI();
  }

  return { current, apply, toggle, mountToggle };
})();
