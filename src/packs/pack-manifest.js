/**
 * Instrument pack manifest validation (INS-010, docs/05 §2). Pure.
 * @returns {{ ok: true, manifest: any } | { ok: false, errors: string[] }}
 */
export function validateManifest(m) {
  const errors = [];
  if (!m || typeof m !== 'object') return { ok: false, errors: ['Manifest is not an object'] };
  if (m.format !== 'stagecraft-pack') errors.push('format must be "stagecraft-pack"');
  if (m.schemaVersion !== 1) errors.push(`unsupported schemaVersion ${m.schemaVersion}`);
  if (typeof m.id !== 'string' || !/^[a-z0-9-]+$/.test(m.id)) errors.push('id must be kebab-case');
  if (!m.license?.name) errors.push('license.name is required');
  if (!Array.isArray(m.regions) || m.regions.length === 0)
    errors.push('regions must be a non-empty array');
  (m.regions ?? []).forEach((r, i) => {
    const where = `regions[${i}]`;
    if (typeof r.file !== 'string' || r.file.includes('..') || r.file.startsWith('/')) {
      errors.push(`${where}.file must be a relative path inside the pack`);
    }
    for (const k of ['root', 'lo', 'hi', 'velLo', 'velHi']) {
      if (!Number.isInteger(r[k]) || r[k] < 0 || r[k] > 127)
        errors.push(`${where}.${k} must be 0-127`);
    }
    if (r.lo > r.hi) errors.push(`${where}: lo > hi`);
    if (r.velLo > r.velHi) errors.push(`${where}: velLo > velHi`);
  });
  return errors.length ? { ok: false, errors } : { ok: true, manifest: m };
}

/** Decoded size estimate in bytes: frames × channels × 4 (Float32). */
export const decodedBytes = (buffer) => buffer.length * buffer.numberOfChannels * 4;
