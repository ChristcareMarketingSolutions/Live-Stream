/**
 * Tiny DOM helper: h('div', { class: 'x', onclick: fn }, child, 'text').
 * Attributes starting with "on" become event listeners; `false`/`null`
 * attribute values are omitted; children may be nested arrays.
 */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs ?? {})) {
    if (value === false || value === null || value === undefined) continue;
    if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2), value);
    } else if (key === 'html') {
      el.innerHTML = value; // only used with trusted, static markup (icons)
    } else {
      el.setAttribute(key, value === true ? '' : String(value));
    }
  }
  appendChildren(el, children);
  return el;
}

function appendChildren(el, children) {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    if (Array.isArray(child)) appendChildren(el, child);
    else el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

/** replaceChildren that skips null/false entries (conditional sections). */
export function replace(el, ...children) {
  el.replaceChildren(
    ...children.flat().filter((c) => c !== null && c !== undefined && c !== false),
  );
}
