import { validateConcert } from '../performance/concert-model.js';

/** Export/import .stagecraft.json files (STO-003). */

export function concertFileName(concert) {
  const safe =
    concert.name
      .replace(/[^\w\- ]+/g, '')
      .trim()
      .replace(/\s+/g, '-') || 'concert';
  return `${safe}.stagecraft.json`;
}

export function downloadConcert(concert) {
  const blob = new Blob([JSON.stringify(concert, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = concertFileName(concert);
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Read and validate a user-chosen file. Never throws.
 * @param {File} file
 * @returns {Promise<{ ok: true, concert: any } | { ok: false, errors: string[] }>}
 */
export async function readConcertFile(file) {
  if (file.size > 5 * 1024 * 1024)
    return { ok: false, errors: ['The file is too large to be a concert (over 5 MB).'] };
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    return {
      ok: false,
      errors: [
        'The file is not valid JSON. Choose a .stagecraft.json file exported from STAGECRAFT.',
      ],
    };
  }
  return validateConcert(data);
}
