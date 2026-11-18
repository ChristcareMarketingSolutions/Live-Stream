/**
 * Workspaces of the app (APP-001). A workspace with `availableInPhase` is not
 * implemented yet: it is shown disabled with "Coming in Phase N" (CLAUDE.md §3).
 */

/** @typedef {{ id: string, label: string, icon: string, availableInPhase?: number }} Workspace */

/** @type {readonly Workspace[]} */
export const WORKSPACES = Object.freeze([
  { id: 'live', label: 'Live', icon: 'live' },
  { id: 'edit', label: 'Edit', icon: 'edit', availableInPhase: 4 },
  { id: 'mixer', label: 'Mixer', icon: 'mixer', availableInPhase: 6 },
  { id: 'library', label: 'Library', icon: 'library', availableInPhase: 3 },
  { id: 'synth', label: 'Synth', icon: 'synth', availableInPhase: 7 },
  { id: 'daw', label: 'DAW', icon: 'daw', availableInPhase: 8 },
  { id: 'settings', label: 'Settings', icon: 'settings' },
]);

export const DEFAULT_WORKSPACE = 'live';

/** @param {string} id */
export function isWorkspaceEnabled(id) {
  const ws = WORKSPACES.find((w) => w.id === id);
  return !!ws && ws.availableInPhase === undefined;
}
