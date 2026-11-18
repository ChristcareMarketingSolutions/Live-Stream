import { DEFAULT_WORKSPACE } from '../workspaces.js';

export const UI_WORKSPACE_CHANGED = 'ui/workspaceChanged';

/** @param {string} workspace */
export const workspaceChanged = (workspace) => ({ type: UI_WORKSPACE_CHANGED, workspace });

const initialState = { workspace: DEFAULT_WORKSPACE };

/** @param {{workspace: string}} state */
export function uiReducer(state = initialState, action) {
  switch (action.type) {
    case UI_WORKSPACE_CHANGED:
      return state.workspace === action.workspace
        ? state
        : { ...state, workspace: action.workspace };
    default:
      return state;
  }
}
