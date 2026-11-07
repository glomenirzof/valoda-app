import { describe, expect, it } from 'vitest';
import { judgeSpeech, pickMime } from '../src/core/voice';

const p = { text: 'Es dzīvoju Rīgā.', accept: [] };

describe('judgeSpeech', () => {
  it('said right → Good, with letters opened → Hard', () => {
    expect(judgeSpeech('es dzīvoju rīgā', p)).toMatchObject({ kind: 'ok', grade: 'good', weak: [] });
    expect(judgeSpeech('Es dzīvoju Rīgā.', p, 2).grade).toBe('hard');
  });

  it('a mistake only in long vowels or marks is not a wrong answer: soft note, still Good', () => {
    const v = judgeSpeech('Es dzivoju Riga', p);
    expect(v).toMatchObject({ kind: 'marks', grade: 'good' });
    expect(v.result.verdict).toBe('almost');
  });

  it('wrong endings only → Hard, and those words count as weak', () => {
    const v = judgeSpeech('Es dzīvoju Rīgas', p);
    expect(v).toMatchObject({ kind: 'ending', grade: 'hard', weak: [2] });
  });

  it('another word, a missing or an extra word → Again', () => {
    expect(judgeSpeech('Es strādāju Rīgā', p)).toMatchObject({ kind: 'bad', grade: 'again' });
    expect(judgeSpeech('Es dzīvoju', p).kind).toBe('bad');
    expect(judgeSpeech('Es dzīvoju Rīgā tagad', p).kind).toBe('bad');
  });

  it('takes accepted variants as right', () => {
    expect(judgeSpeech('Sveiks', { text: 'Sveiki!', accept: ['Sveiks'] }).kind).toBe('ok');
  });
});

describe('pickMime', () => {
  it('records mp4 on Safari and webm/opus on Chrome', () => {
    expect(pickMime((t) => t === 'audio/mp4')).toBe('audio/mp4');
    expect(pickMime((t) => t.startsWith('audio/webm'))).toBe('audio/webm;codecs=opus');
    expect(pickMime(() => false)).toBeUndefined();
  });
});
