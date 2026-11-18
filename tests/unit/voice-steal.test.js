import { describe, it, expect } from 'vitest';
import { chooseVoiceToSteal } from '../../src/audio/voice-steal.js';

const v = (id, state, startedAt, releasedAt) => ({ id, state, startedAt, releasedAt });

describe('voice stealing order [AUD-005, T-103]', () => {
  it('prefers the oldest released voice', () => {
    const voices = [
      v(1, 'held', 0),
      v(2, 'released', 1, 5),
      v(3, 'released', 2, 3),
      v(4, 'sustained', 0),
    ];
    expect(chooseVoiceToSteal(voices).id).toBe(3);
  });

  it('then the oldest sustained voice', () => {
    const voices = [v(1, 'held', 0), v(2, 'sustained', 3), v(3, 'sustained', 1)];
    expect(chooseVoiceToSteal(voices).id).toBe(3);
  });

  it('then the oldest held voice', () => {
    expect(chooseVoiceToSteal([v(1, 'held', 4), v(2, 'held', 2)]).id).toBe(2);
  });

  it('never steals the protected voice', () => {
    expect(chooseVoiceToSteal([v(1, 'released', 0, 0), v(2, 'held', 1)], 1).id).toBe(2);
    expect(chooseVoiceToSteal([v(1, 'held', 0)], 1)).toBeNull();
  });
});
