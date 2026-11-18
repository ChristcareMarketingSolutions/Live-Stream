import './styles/tokens.css';
import './styles/base.css';
import './styles/shell.css';
import './styles/views.css';
import './styles/performance.css';

import { createApp } from './app.js';
import { workspaceChanged } from './core/reducers/ui.js';
import { DEFAULT_WORKSPACE, isWorkspaceEnabled } from './core/workspaces.js';
import { detectCapabilities } from './core/capabilities.js';
import { createShell } from './ui/shell/shell.js';
import { createToasts } from './ui/components/toasts.js';
import { startHashRouter } from './ui/router.js';
import { isTypingTarget } from './midi/computer-keyboard.js';
import { renderLiveView } from './ui/views/live-view.js';
import { renderEditView } from './ui/views/edit-view.js';
import { renderLibraryView } from './ui/views/library-view.js';
import { renderSettingsView } from './ui/views/settings-view.js';
import { installDebugHook } from './debug.js';

const app = createApp();
const { store } = app;
const capabilities = detectCapabilities(window);
createToasts(app.bus);
const shell = createShell(document.getElementById('app'), app);

const views = {
  live: renderLiveView,
  edit: renderEditView,
  library: renderLibraryView,
  settings: renderSettingsView,
};
let cleanup = null;

store.select(
  (s) => s.ui.workspace,
  (workspace) => {
    cleanup?.();
    cleanup = null;
    shell.setActive(workspace);
    cleanup = views[workspace]?.(shell.main, { app, capabilities }) ?? null;
    document.title = `${workspace[0].toUpperCase()}${workspace.slice(1)} · STAGECRAFT`;
  },
  { immediate: true },
);

startHashRouter({
  isValid: isWorkspaceEnabled,
  fallback: DEFAULT_WORKSPACE,
  onChange: (id) => store.dispatch(workspaceChanged(id)),
});

// Global shortcuts (AUD-006, LIVE-030, STO-001).
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    app.panic();
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault();
    app.saveNow();
    return;
  }
  const t = e.target;
  if (isTypingTarget(t) || t?.tagName === 'INPUT' || e.altKey || e.ctrlKey || e.metaKey) return;
  if (e.key === 'ArrowRight' || e.key === 'PageDown') {
    e.preventDefault();
    app.stepPatch(1);
  } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
    e.preventDefault();
    app.stepPatch(-1);
  }
});

// Starting audio needs a user gesture: the first click or key anywhere counts.
const firstGesture = () => {
  app.startAudio().catch(() => {});
  window.removeEventListener('pointerdown', firstGesture, true);
  window.removeEventListener('keydown', firstGesture, true);
};
window.addEventListener('pointerdown', firstGesture, true);
window.addEventListener('keydown', firstGesture, true);

// Reconnect MIDI silently if the user already granted permission before.
(async () => {
  if (typeof navigator.requestMIDIAccess !== 'function') {
    app.midi.request();
    return;
  }
  try {
    const perm = await navigator.permissions?.query({ name: 'midi' });
    if (perm?.state === 'granted') app.midi.request();
  } catch {
    /* permissions API without "midi": wait for the user to click Connect */
  }
})();

app.init();

if (new URLSearchParams(location.search).has('debug')) installDebugHook(app);
