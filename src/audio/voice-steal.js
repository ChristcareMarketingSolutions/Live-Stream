/**
 * Pure voice-stealing policy (AUD-005, docs/04 §3).
 * Order: oldest released voice → oldest sustained voice → oldest held voice.
 * A voice whose id is `protectId` is never chosen.
 *
 * @typedef {{ id: number, state: 'held'|'sustained'|'released', startedAt: number, releasedAt?: number }} VoiceInfo
 * @param {VoiceInfo[]} voices
 * @param {number} [protectId]
 * @returns {VoiceInfo | null}
 */
export function chooseVoiceToSteal(voices, protectId) {
  let best = null;
  let bestRank = Infinity;
  let bestTime = Infinity;
  for (const v of voices) {
    if (v.id === protectId) continue;
    const rank = v.state === 'released' ? 0 : v.state === 'sustained' ? 1 : 2;
    const time = v.state === 'released' ? (v.releasedAt ?? v.startedAt) : v.startedAt;
    if (rank < bestRank || (rank === bestRank && time < bestTime)) {
      best = v;
      bestRank = rank;
      bestTime = time;
    }
  }
  return best;
}
