// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { newCard, review } from '../src/core/srs';
import { DEFAULT_SETTINGS, type Phrase } from '../src/core/types';

vi.mock('../src/data/db', () => ({
  graduate: vi.fn(async () => {}),
  saveAcquaint: vi.fn(async () => {}),
  saveLog: vi.fn(async () => {}),
  saveReview: vi.fn(async () => {}),
}));
vi.mock('../src/data/audio', () => ({
  playPhrase: vi.fn(async () => true),
  playPhraseTwice: vi.fn(async () => {}),
  playWord: vi.fn(async () => true),
  wordKey: (t: { s: string }) => t.s.toLowerCase(),
}));

const { Session } = await import('../src/ui/Session');
const phrases = (JSON.parse(readFileSync('public/data/lv/phrases.json', 'utf8')) as { phrases: Phrase[] }).phrases;
const p1 = phrases.find((p) => p.text === 'Es nezinu.')!;
const p2 = phrases.find((p) => p.text === 'Es saprotu.')!;
const past = new Date(Date.now() - 3 * 86400000);
const due = (id: string) => {
  const c = review(newCard(id, 'lv', past), 'good', past).card;
  return { ...c, fsrs: { ...c.fsrs, due: past } };
};

afterEach(cleanup);

const textarea = () => document.querySelector('textarea') as HTMLTextAreaElement;
const type = (v: string) => fireEvent.input(textarea(), { target: { value: v } });

describe('the answer field is empty on every new card', () => {
  it('after a wrong answer: empty on «Набери правильно», and empty on the next card', async () => {
    render(
      <Session
        phrases={phrases}
        cards={[due(p1.id), due(p2.id)]}
        acquainted={[]}
        input={{ reviews: [{ id: p1.id, mode: 'type' }, { id: p2.id, mode: 'type' }], acquainted: [], fresh: [] }}
        settings={{ ...DEFAULT_SETTINGS, sound: false }}
        onExit={() => {}}
      />,
    );
    expect(screen.getByText(p1.ru)).toBeTruthy();
    type('Es negribu');
    expect(textarea().value).toBe('Es negribu');
    fireEvent.click(screen.getByText('Проверить'));
    fireEvent.click(await screen.findByText('Не вспомнил'));

    // «Набери правильно»: the sample is shown, the field starts empty
    expect(await screen.findByText('Набери правильно')).toBeTruthy();
    expect(textarea().value).toBe('');
    type(p1.text);
    fireEvent.click(screen.getByText('Дальше'));

    // the next card: another phrase, the field is empty again
    expect(await screen.findByText(p2.ru)).toBeTruthy();
    expect(textarea().value).toBe('');
  });

  it('after a right answer the next card starts empty too', async () => {
    render(
      <Session
        phrases={phrases}
        cards={[due(p1.id), due(p2.id)]}
        acquainted={[]}
        input={{ reviews: [{ id: p1.id, mode: 'type' }, { id: p2.id, mode: 'type' }], acquainted: [], fresh: [] }}
        settings={{ ...DEFAULT_SETTINGS, sound: false }}
        onExit={() => {}}
      />,
    );
    type(p1.text);
    fireEvent.click(screen.getByText('Проверить'));
    fireEvent.click(await screen.findByText('Вспомнил'));
    expect(await screen.findByText(p2.ru)).toBeTruthy();
    expect(textarea().value).toBe('');
  });
});
