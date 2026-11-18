/**
 * Hash router (ADR-0003): routes look like "#/live". Hash routes never hit
 * the server, so refreshing a nested view on GitHub Pages cannot 404.
 */

/**
 * Pure: turn a location hash into a route id.
 * @param {string} hash e.g. "#/settings"
 * @param {(id: string) => boolean} isValid
 * @param {string} fallback
 */
export function parseHash(hash, isValid, fallback) {
  const id = (hash ?? '').replace(/^#\/?/, '').split(/[/?]/)[0].toLowerCase();
  return id && isValid(id) ? id : fallback;
}

/** @param {string} id */
export const hrefFor = (id) => `#/${id}`;

/**
 * @param {{ isValid: (id: string) => boolean, fallback: string, onChange: (id: string) => void, win?: Window }} opts
 */
export function startHashRouter({ isValid, fallback, onChange, win = window }) {
  const sync = () => {
    const id = parseHash(win.location.hash, isValid, fallback);
    // Normalise unknown or disabled routes so the address bar matches the view.
    if (win.location.hash !== hrefFor(id)) {
      win.history.replaceState(null, '', hrefFor(id));
    }
    onChange(id);
  };
  win.addEventListener('hashchange', sync);
  sync();
  return () => win.removeEventListener('hashchange', sync);
}
