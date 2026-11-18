import './styles/tokens.css';
import './styles/base.css';
import './styles/shell.css';
import './styles/views.css';

import { createEventBus } from './core/event-bus.js';
import { createStore, combineReducers } from './core/store.js';
import { uiReducer, workspaceChanged } from './core/reducers/ui.js';
import { DEFAULT_WORKSPACE, isWorkspaceEnabled } from './core/workspaces.js';
import { detectCapabilities } from './core/capabilities.js';
import { createShell } from './ui/shell/shell.js';
import { startHashRouter } from './ui/router.js';
import { renderLiveView } from './ui/views/live-view.js';
import { renderSettingsView } from './ui/views/settings-view.js';

const bus = createEventBus();
const store = createStore(combineReducers({ ui: uiReducer }), {}, { freeze: import.meta.env.DEV });
store.dispatch({ type: '@@init' });

bus.on('error', ({ message, detail }) => console.error(message, detail));

const capabilities = detectCapabilities(window);
const shell = createShell(document.getElementById('app'));

const views = {
  live: renderLiveView,
  settings: renderSettingsView,
};

store.select(
  (s) => s.ui.workspace,
  (workspace) => {
    shell.setActive(workspace);
    views[workspace]?.(shell.main, { capabilities, store, bus });
    document.title = `${workspace[0].toUpperCase()}${workspace.slice(1)} · STAGECRAFT`;
  },
  { immediate: true },
);

startHashRouter({
  isValid: isWorkspaceEnabled,
  fallback: DEFAULT_WORKSPACE,
  onChange: (id) => store.dispatch(workspaceChanged(id)),
});
