import { describe, it, expect } from 'vitest';
import { parseHash, hrefFor } from '../../src/ui/router.js';
import { isWorkspaceEnabled, WORKSPACES, DEFAULT_WORKSPACE } from '../../src/core/workspaces.js';

describe('parseHash', () => {
  const parse = (hash) => parseHash(hash, isWorkspaceEnabled, DEFAULT_WORKSPACE);

  it.each([
    ['#/live', 'live'],
    ['#/settings', 'settings'],
    ['#settings', 'settings'],
    ['#/SETTINGS', 'settings'],
    ['#/settings/midi', 'settings'],
    ['#/settings?x=1', 'settings'],
  ])('%s -> %s', (hash, expected) => expect(parse(hash)).toBe(expected));

  it.each(['', '#', '#/', '#/nope', undefined])('falls back for %s', (hash) => {
    expect(parse(hash)).toBe('live');
  });

  it('falls back for workspaces not built yet', () => {
    expect(parse('#/daw')).toBe('live');
  });

  it('builds hrefs', () => expect(hrefFor('live')).toBe('#/live'));
});

describe('workspaces', () => {
  it('Live, Edit, Library and Settings are enabled after Phase 4', () => {
    expect(WORKSPACES.filter((w) => isWorkspaceEnabled(w.id)).map((w) => w.id)).toEqual([
      'live',
      'edit',
      'library',
      'settings',
    ]);
  });

  it('every disabled workspace names the phase that delivers it', () => {
    for (const w of WORKSPACES.filter((x) => !isWorkspaceEnabled(x.id))) {
      expect(w.availableInPhase).toBeGreaterThan(0);
    }
  });
});
