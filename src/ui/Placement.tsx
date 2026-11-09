import { useEffect, useMemo, useState } from 'preact/hooks';
import {
  MAX_Q, nextQuestion, placedCards, placementResult, questionPool, type Answer, type PlacementData, type PlacementResult, type Question,
} from '../core/placement';
import type { Acquaintance } from '../core/session';
import type { StoredCard } from '../core/srs';
import type { Phrase, Settings } from '../core/types';
import { loadPlacement } from '../data/content';
import { saveCards } from '../data/db';
import { Icon } from './icons';
import { plural, TypeCard } from './Session';

const LEVEL_RU: Record<PlacementResult['level'], string> = {
  A0: 'начинаешь с нуля',
  A1: 'начальный уровень',
  A2: 'элементарный уровень',
  B1: 'средний уровень',
  B2: 'выше среднего',
};

/** A question shown as a typed card: the phrase, a single word or a phrase with one word to put in its form. */
function typedCard(q: Extract<Question, { kind: 'phrase' | 'word' | 'ending' }>, byId: Map<string, Phrase>): { p: Phrase; eyebrow: string } {
  const src = byId.get(q.id)!;
  if (q.kind === 'phrase') return { p: src, eyebrow: 'Тест уровня · переведи фразу' };
  if (q.kind === 'word') {
    return { p: { ...src, id: `w:${q.lemma}`, text: q.lemma, ru: q.ru, tokens: [], accept: [], key: undefined }, eyebrow: 'Тест уровня · переведи слово' };
  }
  const t = src.tokens[q.i];
  const blank = src.text.replace(new RegExp(`(^|[^\\p{L}])${t.s}(?=[^\\p{L}]|$)`, 'u'), '$1___');
  return {
    p: { ...src, id: `e:${src.id}`, text: t.s, ru: `${blank} (${t.lemma})`, tokens: [], accept: [], key: undefined },
    eyebrow: `Тест уровня · впиши слово в нужной форме — «${src.ru}»`,
  };
}

export function Placement({ phrases, cards, acquainted, settings, onDone, onExit }: {
  phrases: Phrase[];
  cards: StoredCard[];
  acquainted: Acquaintance[];
  settings: Settings;
  /** finished: the result, and how many phrases went into reviews (0 when not applied) */
  onDone: (r: PlacementResult, placed: number) => void;
  onExit: () => void;
}) {
  const [data, setData] = useState<PlacementData | null>(null);
  const [error, setError] = useState(false);
  const [started, setStarted] = useState(false);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const byId = useMemo(() => new Map(phrases.map((p) => [p.id, p])), [phrases]);
  const pool = useMemo(() => (data ? questionPool(phrases, data) : []), [data, phrases]);
  useEffect(() => {
    loadPlacement(settings.lang).then(setData).catch(() => setError(true));
  }, [settings.lang]);
  const q = useMemo(() => (started && data ? nextQuestion(answers, pool) : null), [answers, started, data]);
  const answer = (right: boolean) => setAnswers([...answers, { q: q!, right }]);

  if (!started) {
    return (
      <div class="session">
        <main class="s-main summary">
          <h1 class="title">Тест уровня</h1>
          <p class="subtitle">15–25 вопросов, около пяти минут. Сложность подстраивается под ответы: верно — дальше сложнее, ошибка — проще.</p>
          <ul class="test-rules">
            <li>Переводишь с русского слова и фразы и вставляешь окончания — без подсказок</li>
            <li>Иногда спрошу, знаешь ли слово. Среди них есть несуществующие — отвечай честно</li>
            <li>Не знаешь — жми «Не знаю», это тоже ответ</li>
            <li>Твой прогресс тест не стирает</li>
          </ul>
          {error && <p class="subtitle">Не удалось загрузить тест — нужен интернет при первом запуске</p>}
        </main>
        <footer class="s-actions two">
          <button class="btn ghost" onClick={onExit}>
            Не сейчас
          </button>
          <button class="btn primary" disabled={!data} onClick={() => setStarted(true)}>
            Начать <Icon name="arrow" />
          </button>
        </footer>
      </div>
    );
  }

  if (!q) return <Result phrases={phrases} answers={answers} cards={cards} acquainted={acquainted} settings={settings} onDone={onDone} />;

  const n = answers.length;
  return (
    <div class="session" key={q.key}>
      <header class="s-top">
        <button class="icon-btn" aria-label="Выйти из теста" onClick={onExit}>
          <Icon name="x" />
        </button>
        <div class="s-progress">
          <i style={{ width: `${Math.round(((n + 1) / MAX_Q) * 100)}%` }} />
        </div>
        <span class="s-count">{n + 1}</span>
      </header>
      {q.kind === 'yesno' || q.kind === 'fake' ? (
        <>
          <main class="s-main">
            <p class="eyebrow">Тест уровня · знаешь это слово?</p>
            <h1 class="s-lv yesno-word">{q.word}</h1>
            <p class="s-hint">Знаешь — значит можешь сказать, что оно значит. Среди слов есть несуществующие</p>
          </main>
          <footer class="s-actions two">
            <button class="btn ghost" onClick={() => answer(q.kind === 'fake')}>
              Не знаю
            </button>
            <button class="btn primary" onClick={() => answer(q.kind === 'yesno')}>
              Знаю
            </button>
          </footer>
        </>
      ) : (
        (() => {
          const { p, eyebrow } = typedCard(q, byId);
          return (
            <TypeCard
              p={p}
              noHints
              freeKeys
              eyebrow={eyebrow}
              onSkip={() => answer(false)}
              // right, or right except long vowels and marks
              onDone={(o) => answer(!!o.result && o.result.verdict !== 'bad')}
            />
          );
        })()
      )}
    </div>
  );
}

function Result({ phrases, answers, cards, acquainted, settings, onDone }: {
  phrases: Phrase[];
  answers: Answer[];
  cards: StoredCard[];
  acquainted: Acquaintance[];
  settings: Settings;
  onDone: (r: PlacementResult, placed: number) => void;
}) {
  const r = useMemo(() => placementResult(answers, phrases), []);
  const skip = useMemo(() => new Set([...cards.map((c) => c.id), ...acquainted.map((a) => a.id)]), []);
  const toPlace = useMemo(() => placedCards(r.known, skip, settings.lang, new Date()), []);
  const days = Math.ceil(toPlace.length / 15);
  const [busy, setBusy] = useState(false);

  const apply = async () => {
    setBusy(true);
    await saveCards(toPlace);
    onDone(r, toPlace.length);
  };

  return (
    <div class="session">
      <main class="s-main summary">
        <h1 class="title">Твой уровень</h1>
        <div class="today">
          <div class="stat accent">
            <b>{r.level}</b>
            <span>{LEVEL_RU[r.level]}</span>
          </div>
          <div class="stat">
            <b>≈{r.vocab}</b>
            <span>слов знаешь (от {r.range[0]} до {r.range[1]})</span>
          </div>
        </div>
        <p class="subtitle">
          {r.pos > 0 ? `В порядке фраз знаешь почти всё до №${r.pos} из ${r.total}` : `Начнём с первой фразы из ${r.total}`}
          {r.known.length > 0 && `. Знакомых фраз: ${r.known.length}`}
        </p>
        {toPlace.length > 0 && (
          <p class="subtitle">
            {toPlace.length} {plural(toPlace.length, 'фразу', 'фразы', 'фраз')} отмечу как знакомые: в новых их не будет, они сразу пойдут в повторения с оценкой «Хорошо» — приложение проверит их
            {days > 1 ? ` в ближайшие ${days} ${plural(days, 'день', 'дня', 'дней')}, не больше 15 в день` : ' завтра'}
          </p>
        )}
        {r.known.length > toPlace.length && (
          <p class="subtitle">Ещё {r.known.length - toPlace.length} из знакомых ты уже учишь — их не трогаю</p>
        )}
        {r.guessed > 0 && (
          <p class="note warn-note">
            Ты отметил {r.guessed} {plural(r.guessed, 'несуществующее слово', 'несуществующих слова', 'несуществующих слов')} как знакомые, поэтому ответы «знаю» я не учитывал — уровень посчитан по переводам
          </p>
        )}
        {(r.beyondBase || r.fewLeft) && (
          <p class="note warn-note">
            {r.beyondBase ? 'Твой уровень выше, чем покрывает база фраз (она примерно до A2). ' : ''}
            Новых фраз для тебя осталось {r.remaining} из {r.total} — для твоего уровня это мало, честно
          </p>
        )}
        <p class="note">Уровень примерный: по размеру словаря на частотных словах и твоим переводам</p>
      </main>
      <footer class="s-actions two">
        <button class="btn ghost" disabled={busy} onClick={() => onDone(r, 0)}>
          Не отмечать
        </button>
        <button class="btn primary" disabled={busy} onClick={apply}>
          {toPlace.length ? 'Отметить' : 'Начать'} <Icon name="arrow" />
        </button>
      </footer>
    </div>
  );
}
