import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { checkAnswer, MISTAKE_RU, type CheckResult } from '../core/check';
import { answerReview, answerStage, current, startLesson, unfinished, type Answer, type Item, type Lesson, type LessonInput } from '../core/ladder';
import { lessonSize, type Acquaintance } from '../core/session';
import { graduationGrade, newCard, review, whenRu, type Grade, type StoredCard } from '../core/srs';
import type { Phrase, Settings, Token } from '../core/types';
import { graduate, saveAcquaint, saveReview } from '../data/db';
import { playPhrase } from '../data/audio';
import { Icon } from './icons';
import { TappableText } from './PhraseList';
import { StatusTag } from './StatusTag';
import { WordSheet } from './WordSheet';

/* ---------- helpers ---------- */

const LETTERS = ['ā', 'ē', 'ī', 'ū', 'č', 'ģ', 'ķ', 'ļ', 'ņ', 'š', 'ž'];
// Phrase keyboard: letters of the answer plus the plain/long twin of each vowel and marked letter,
// in Latvian alphabet order, so the keyboard never gives the marks away.
const TWIN: Record<string, string> = { a: 'ā', ā: 'a', e: 'ē', ē: 'e', i: 'ī', ī: 'i', u: 'ū', ū: 'u', č: 'c', š: 's', ž: 'z', ļ: 'l', ņ: 'n', ķ: 'k', ģ: 'g' };
const ABC = 'aābcčdeēfgģhiījkķlļmnņoprsštuūvzž';
const phraseKeys = (lv: string) => {
  const set = new Set(lv.toLowerCase().match(/\p{L}/gu) ?? []);
  for (const ch of [...set]) if (TWIN[ch]) set.add(TWIN[ch]);
  return [...set].sort((x, y) => ABC.indexOf(x) - ABC.indexOf(y));
};

const shuffle = <T,>(a: T[]) => {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
};

const letterCount = (s: string) => (s.match(/\p{L}/gu) ?? []).length;

/** Indices of words that contain at least one of the first `n` letters (letter hints open from the start). */
const wordsWithinLetters = (p: Phrase, n: number) => {
  let k = 0;
  return p.tokens.flatMap((t, i) => {
    const start = k;
    k += [...t.s].length;
    return start < n ? [i] : [];
  });
};

const plural = (n: number, one: string, few: string, many: string) => {
  const m10 = n % 10, m100 = n % 100;
  return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many;
};

const store = {
  get: (k: string, d: string) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

/** Phrase text with the key word highlighted. */
function KeyText({ p }: { p: Phrase }) {
  if (!p.key) return <>{p.text}</>;
  const k = p.tokens[p.key.i].s;
  const at = p.text.indexOf(k);
  if (at < 0) return <>{p.text}</>;
  return (
    <>
      {p.text.slice(0, at)}
      <b class="key">{k}</b>
      {p.text.slice(at + k.length)}
    </>
  );
}

/** One sound button: first tap normal speed, next tap slower, and so on. */
function SoundButton({ p, settings, cls, label = true, autoplay = false }: { p: Phrase; settings: Settings; cls: string; label?: boolean; autoplay?: boolean }) {
  const [plays, setPlays] = useState(0);
  const slow = plays % 2 === 1;
  useEffect(() => {
    if (!autoplay) return;
    playPhrase(settings.lang, p.id, 1);
    setPlays(1);
  }, [p.id]);
  return (
    <button
      class={cls}
      aria-label={slow ? 'Ещё раз медленно' : 'Слушать'}
      onClick={() => {
        playPhrase(settings.lang, p.id, slow ? 0.75 : 1);
        setPlays(plays + 1);
      }}
    >
      <Icon name={slow ? 'slow' : 'play'} />
      {label && <span>{slow ? 'Ещё раз медленно' : 'Слушать'}</span>}
    </button>
  );
}

function TopBar({ pos, total, onClose }: { pos: number; total: number; onClose: () => void }) {
  return (
    <header class="s-top">
      <button class="icon-btn" aria-label="Закончить" onClick={onClose}>
        <Icon name="x" />
      </button>
      <div class="s-progress">
        <i style={{ width: `${Math.round(((pos + 1) / Math.max(total, 1)) * 100)}%` }} />
      </div>
      <span class="s-count">
        {pos + 1}/{total}
      </span>
    </header>
  );
}

/* ---------- cards ---------- */

function Intro({ p, settings, onNext, onKnown }: { p: Phrase; settings: Settings; onNext: () => void; onKnown: () => void }) {
  const [word, setWord] = useState<Token | null>(null);
  return (
    <>
      <main class="s-main">
        <p class="eyebrow">
          Новая фраза <StatusTag p={p} />
        </p>
        <div class="phrase-card">
          <TappableText phrase={p} onWord={setWord} cls="s-lv" />
          <p class="s-ru">{p.ru}</p>
          <div class="s-audio">
            <SoundButton p={p} settings={settings} cls="s-play" autoplay />
          </div>
        </div>
        <p class="s-hint">Нажми на слово — покажу разбор</p>
      </main>
      <footer class="s-actions">
        <button class="btn primary" onClick={onNext}>
          Дальше <Icon name="arrow" />
        </button>
        <button class="s-link" onClick={onKnown}>
          Уже знаю эту фразу
        </button>
      </footer>
      {word && <WordSheet token={word} lang={settings.lang} onClose={() => setWord(null)} />}
    </>
  );
}

function Tiles({ p, settings, trap = true, onNext }: { p: Phrase; settings: Settings; trap?: boolean; onNext: (pass: boolean) => void }) {
  const withTrap = trap && !!p.key;
  const pool = useMemo(
    () => shuffle([...p.tokens.map((t) => t.s), ...(withTrap ? [p.key!.trap] : [])]).map((t, id) => ({ t, id })),
    [p.id],
  );
  const [picked, setPicked] = useState<number[]>([]);
  const [res, setRes] = useState<'ok' | 'bad' | null>(null);
  const text = (id: number) => pool.find((x) => x.id === id)!.t;
  const usedTrap = withTrap && picked.some((id) => text(id) === p.key!.trap);

  return (
    <>
      <main class="s-main">
        <p class="eyebrow">Собери фразу</p>
        <h1 class="ru-big">{p.ru}</h1>
        <div class={`build ${res ? `b-${res}` : ''}`}>
          {picked.length ? (
            picked.map((id) => (
              <button key={id} class="wtile" disabled={!!res} onClick={() => setPicked(picked.filter((x) => x !== id))}>
                {text(id)}
              </button>
            ))
          ) : (
            <span class="build-ph">Нажимай на слова ниже</span>
          )}
        </div>
        {res === 'ok' && (
          <p class="tile-msg ok">
            <Icon name="check" />
            Верно
          </p>
        )}
        {res === 'bad' && (
          <div class="tile-msg bad">
            <p>
              Правильно: <b><KeyText p={p} /></b>
            </p>
            <p>{usedTrap ? p.key!.trapWhy : 'Проверь порядок слов'}</p>
          </div>
        )}
        <div class="pool">
          {pool.map((x) => (
            <button
              key={x.id}
              class={`wtile ${picked.includes(x.id) ? 'used' : ''}`}
              disabled={picked.includes(x.id) || !!res}
              onClick={() => setPicked([...picked, x.id])}
            >
              {x.t}
            </button>
          ))}
        </div>
        {withTrap && !res && <p class="s-hint">Одно слово лишнее — с неправильным окончанием</p>}
      </main>
      <footer class="s-actions">
        {res ? (
          <button class="btn primary" onClick={() => onNext(res === 'ok')}>
            Дальше <Icon name="arrow" />
          </button>
        ) : (
          <button
            class="btn primary"
            disabled={!picked.length}
            onClick={() => {
              setRes(picked.map(text).join(' ') === p.tokens.map((t) => t.s).join(' ') ? 'ok' : 'bad');
              playPhrase(settings.lang, p.id);
            }}
          >
            Проверить
          </button>
        )}
      </footer>
    </>
  );
}

interface Outcome { mode: 'type' | 'say'; result: CheckResult | null; hints: number; weak: number[] }

function TypeCard({ p, cue = false, onDone }: { p: Phrase; cue?: boolean; onDone: (o: Outcome) => void }) {
  const [text, setText] = useState('');
  const [hints, setHints] = useState(0);
  const [weak, setWeak] = useState<Set<number>>(new Set());
  const [kb, setKb] = useState(store.get('valoda-kb', 'phrase'));
  const ta = useRef<HTMLTextAreaElement>(null);
  const keys = useMemo(() => phraseKeys(p.text), [p.id]);

  useEffect(() => {
    if (kb === 'system') ta.current?.focus();
  }, [kb]);

  // Keep the correct beginning, then write the next correct letter (spaces and punctuation come for free).
  const hint = () => {
    const t = p.text;
    let i = 0;
    while (i < text.length && i < t.length && text[i].toLowerCase() === t[i].toLowerCase()) i++;
    let j = i;
    while (j < t.length && !/\p{L}/u.test(t[j])) j++;
    if (j < t.length) {
      setWeak(new Set(weak).add((t.slice(0, j + 1).match(/\p{L}+/gu) ?? []).length - 1));
      setHints(hints + 1);
      j++;
    }
    setText(t.slice(0, j));
  };

  const keep = (e: Event) => e.preventDefault(); // tapping a key must not move focus or open the system keyboard

  return (
    <>
      <main class="s-main">
        <p class="eyebrow">{cue ? 'Напиши по первым буквам' : 'Напиши по-латышски'}</p>
        <h1 class="ru-big">{p.ru}</h1>
        {cue && (
          <p class="mask cue">
            {p.text.split(/(\p{L}+)/u).map((part, j) =>
              j % 2 === 0 ? part : (
                <span key={j} class="mw">
                  {[...part].map((ch, n) => (n === 0 ? <b key={n}>{ch}</b> : <i key={n} />))}
                </span>
              ),
            )}
          </p>
        )}
        <div class="type-box">
          <textarea
            ref={ta}
            rows={2}
            value={text}
            placeholder={kb === 'phrase' ? 'Нажимай буквы ниже…' : 'Пиши здесь…'}
            inputMode={kb === 'phrase' ? 'none' : 'text'}
            autocapitalize="sentences"
            autocomplete="off"
            autocorrect="off"
            spellcheck={false}
            lang="lv"
            onInput={(e) => setText((e.target as HTMLTextAreaElement).value)}
          />
          {kb === 'phrase' ? (
            <>
              <div class="keys">
                {keys.map((l) => (
                  <button key={l} onPointerDown={keep} onClick={() => setText(text + l)}>
                    {l}
                  </button>
                ))}
              </div>
              <div class="keys-row">
                <button aria-label="Клавиатура телефона" onClick={() => { setKb('system'); store.set('valoda-kb', 'system'); }}>
                  <Icon name="keyboard" />
                </button>
                <button class="k-space" onPointerDown={keep} onClick={() => setText(text + ' ')}>
                  пробел
                </button>
                <button aria-label="Стереть" onPointerDown={keep} onClick={() => setText(text.slice(0, -1))}>
                  <Icon name="del" />
                </button>
              </div>
            </>
          ) : (
            <>
              <div class="letters">
                {LETTERS.map((l) => (
                  <button
                    key={l}
                    onPointerDown={keep}
                    onClick={() => {
                      const el = ta.current!;
                      const s = el.selectionStart ?? text.length;
                      const v = text.slice(0, s) + l + text.slice(el.selectionEnd ?? s);
                      setText(v);
                      requestAnimationFrame(() => el.setSelectionRange(s + 1, s + 1));
                    }}
                  >
                    {l}
                  </button>
                ))}
              </div>
              <button class="s-link" onClick={() => { setKb('phrase'); store.set('valoda-kb', 'phrase'); }}>
                Буквы фразы
              </button>
            </>
          )}
        </div>
      </main>
      <footer class="s-actions two">
        <button class="btn ghost" onPointerDown={keep} onClick={hint}>
          <Icon name="bulb" />
          Буква{hints ? ` · ${hints}` : ''}
        </button>
        <button
          class="btn primary"
          disabled={!text.trim()}
          onClick={() => onDone({ mode: 'type', result: checkAnswer(text, p.text, p.accept), hints, weak: [...weak] })}
        >
          <Icon name="check" />
          Проверить
        </button>
      </footer>
    </>
  );
}

function SayCard({ p, onDone }: { p: Phrase; onDone: (o: Outcome) => void }) {
  const [hints, setHints] = useState(0);
  const total = letterCount(p.text);
  let k = 0;
  const mask = p.text.split(/(\p{L}+)/u).map((part, j) =>
    j % 2 === 0 ? (
      part
    ) : (
      <span key={j} class="mw">
        {[...part].map((ch, n) => (k++ < hints ? <b key={n}>{ch}</b> : <i key={n} />))}
      </span>
    ),
  );
  return (
    <>
      <main class="s-main">
        <p class="eyebrow">Скажи по-латышски</p>
        <h1 class="ru-big">{p.ru}</h1>
        {hints > 0 && <p class="mask">{mask}</p>}
        <div class="speak-box">
          <div class="mic-ring">
            <Icon name="mic" />
          </div>
          <p>
            Скажи фразу вслух
            <br />
            Не помнишь — открой букву
          </p>
        </div>
      </main>
      <footer class="s-actions two">
        <button class="btn ghost" disabled={hints >= total} onClick={() => setHints(hints + 1)}>
          <Icon name="bulb" />
          Буква{hints ? ` · ${hints}` : ''}
        </button>
        <button class="btn primary" onClick={() => onDone({ mode: 'say', result: null, hints, weak: wordsWithinLetters(p, hints) })}>
          <Icon name="eye" />
          Показать
        </button>
      </footer>
    </>
  );
}

const ORDER: Grade[] = ['again', 'hard', 'good', 'easy'];
const worse = (a: Grade, b: Grade) => ORDER[Math.min(ORDER.indexOf(a), ORDER.indexOf(b))];

/** Grade suggested by the checker and the hints; null when only the learner can judge (said aloud, no hints). */
function suggested(o: Outcome, p: Phrase): Grade | null {
  let g: Grade | null = o.result ? ({ ok: 'good', almost: 'hard', bad: 'again' } as const)[o.result.verdict] : null;
  if (o.hints) {
    const byHints: Grade = o.hints / letterCount(p.text) > 1 / 3 ? 'again' : 'hard';
    g = g ? worse(g, byHints) : byHints;
  }
  return g;
}

function Feedback({ p, card, o, settings, onGrade }: { p: Phrase; card: StoredCard; o: Outcome; settings: Settings; onGrade: (g: Grade) => void }) {
  const sug = suggested(o, p);
  const verdict = o.result?.verdict ?? 'self';
  const head = { ok: ['check', 'Верно'], almost: ['alert', 'Почти — проверь знаки'], bad: ['alert', 'Не совсем'], self: ['eye', 'Сравни с образцом'] } as const;
  const second: [Grade, string] = o.hints ? ['hard', 'С подсказкой'] : sug === 'hard' ? ['hard', 'Почти'] : ['good', 'Вспомнил'];
  const now = new Date();
  const when = (g: Grade) => whenRu(review(card, g, now).card.fsrs.due, now);
  const errors = o.result
    ? [...new Set(o.result.words.filter((w) => w.kind !== 'ok').map((w) => MISTAKE_RU[w.kind as keyof typeof MISTAKE_RU]))]
    : [];
  const weakWords = o.weak.map((i) => p.tokens[i]?.s).filter(Boolean);

  return (
    <>
      <div class="scrim" />
      <section class={`sheet fb v-${verdict}`} role="dialog" aria-label="Ответ">
        <div class="grab" />
        <p class="verdict">
          <Icon name={head[verdict][0]} />
          <span>{head[verdict][1]}</span>
        </p>
        <div class="right">
          <SoundButton p={p} settings={settings} cls="a-mini" label={false} autoplay />
          <p class="right-lv">
            <KeyText p={p} />
          </p>
        </div>
        {o.result && verdict !== 'ok' && (
          <p class="yours">
            <span class="muted">Ты: </span>
            {o.result.words.map((w, i) => (
              <span key={i}>
                {i > 0 && ' '}
                {w.kind === 'ok' ? (
                  w.got
                ) : w.kind === 'missing' ? (
                  <span class="d-err">…</span>
                ) : w.kind === 'mark' ? (
                  <span class="d-err d-mark">{w.got}</span>
                ) : (
                  <>
                    {w.got.slice(0, w.p)}
                    <span class="d-err">{w.got.slice(w.p) || '∅'}</span>
                  </>
                )}
              </span>
            ))}
            {errors.length > 0 && (
              <span class="tags">
                {errors.map((e) => (
                  <i key={e}>{e}</i>
                ))}
              </span>
            )}
          </p>
        )}
        {p.key && <p class="why">{p.key.why}</p>}
        {o.hints > 0 && (
          <p class="hint-note">
            <Icon name="bulb" />
            <span>
              Ты открыл {o.hints} {plural(o.hints, 'букву', 'буквы', 'букв')}. Эти слова вернутся раньше: <b>{weakWords.join(', ')}</b>
            </span>
          </p>
        )}
        <div class="rates">
          <button class={`rate rate-again ${sug === 'again' ? 'on' : ''}`} onClick={() => onGrade('again')}>
            <b>Не вспомнил</b>
            <small>{when('again')}</small>
          </button>
          <button class={`rate rate-${second[0]} ${sug === second[0] ? 'on' : ''}`} onClick={() => onGrade(second[0])}>
            <b>{second[1]}</b>
            <small>{when(second[0])}</small>
          </button>
        </div>
      </section>
    </>
  );
}

/* ---------- ladder cards (S1 hear it, S3/S4 feedback) ---------- */

/** S1: the phrase sounds, the learner picks its meaning from three Russian translations (others from other topics). */
function ListenChoose({ p, options, settings, onDone }: { p: Phrase; options: string[]; settings: Settings; onDone: (pass: boolean) => void }) {
  const [picked, setPicked] = useState<string | null>(null);
  const right = picked === p.ru;
  return (
    <>
      <main class="s-main">
        <p class="eyebrow">Узнай на слух</p>
        <div class="s-audio listen">
          <SoundButton p={p} settings={settings} cls="s-play" autoplay />
        </div>
        <p class="s-hint">Что значит эта фраза?</p>
        <div class="choices">
          {options.map((o) => (
            <button
              key={o}
              class={`choice ${picked && o === p.ru ? 'c-ok' : ''} ${picked === o && !right ? 'c-bad' : ''}`}
              disabled={!!picked}
              onClick={() => setPicked(o)}
            >
              {o}
            </button>
          ))}
        </div>
        {picked && <p class="choice-lv">{p.text}</p>}
      </main>
      <footer class="s-actions">
        <button class="btn primary" disabled={!picked} onClick={() => onDone(right)}>
          Дальше <Icon name="arrow" />
        </button>
      </footer>
    </>
  );
}

/** Feedback after S3/S4: the answer is checked automatically, one button goes on. */
function StageFeedback({ p, o, stage, settings, nextReview, onNext }: {
  p: Phrase;
  o: Outcome;
  stage: 3 | 4;
  settings: Settings;
  /** for a passed S4: when FSRS brings the phrase back */
  nextReview?: string;
  onNext: () => void;
}) {
  const verdict = o.result!.verdict;
  const pass = verdict !== 'bad';
  const head = { ok: ['check', 'Верно'], almost: ['alert', 'Почти — проверь знаки'], bad: ['alert', 'Не совсем'] } as const;
  const errors = [...new Set(o.result!.words.filter((w) => w.kind !== 'ok').map((w) => MISTAKE_RU[w.kind as keyof typeof MISTAKE_RU]))];
  return (
    <>
      <div class="scrim" />
      <section class={`sheet fb v-${verdict}`} role="dialog" aria-label="Ответ">
        <div class="grab" />
        <p class="verdict">
          <Icon name={head[verdict][0]} />
          <span>{head[verdict][1]}</span>
        </p>
        <div class="right">
          <SoundButton p={p} settings={settings} cls="a-mini" label={false} autoplay />
          <p class="right-lv">
            <KeyText p={p} />
          </p>
        </div>
        {verdict !== 'ok' && (
          <p class="yours">
            <span class="muted">Ты: </span>
            {o.result!.words.map((w, i) => (
              <span key={i}>
                {i > 0 && ' '}
                {w.kind === 'ok' ? w.got : w.kind === 'missing' ? <span class="d-err">…</span> : w.kind === 'mark' ? <span class="d-err d-mark">{w.got}</span> : (
                  <>
                    {w.got.slice(0, w.p)}
                    <span class="d-err">{w.got.slice(w.p) || '∅'}</span>
                  </>
                )}
              </span>
            ))}
            {errors.length > 0 && <span class="tags">{errors.map((e) => <i key={e}>{e}</i>)}</span>}
          </p>
        )}
        {p.key && <p class="why">{p.key.why}</p>}
        <p class="stage-note">
          {pass && stage === 4
            ? `Фраза выучена — дальше в повторениях${nextReview ? `, следующее ${nextReview}` : ''}`
            : pass
              ? 'Скоро напишешь её целиком, без подсказки'
              : stage === 4
                ? 'Вернёмся к ней с подсказкой первых букв через пару карточек'
                : 'Ещё раз соберём её из слов через пару карточек'}
        </p>
        <button class="btn primary" onClick={onNext}>
          Дальше <Icon name="arrow" />
        </button>
      </section>
    </>
  );
}

/* ---------- session ---------- */

const stageKey = (it: Item | undefined) => (it ? `${it.id}:${it.kind === 'stage' ? `S${it.stage}` : it.mode}` : 'end');

export function Session({ phrases, cards, acquainted, input, settings, onExit }: {
  phrases: Phrase[];
  cards: StoredCard[];
  acquainted: Acquaintance[];
  input: LessonInput;
  settings: Settings;
  onExit: () => void;
}) {
  const byId = useMemo(() => new Map(phrases.map((p) => [p.id, p])), [phrases]);
  const [lesson, setLesson] = useState<Lesson>(() => startLesson(input));
  const [deck, setDeck] = useState(() => new Map(cards.map((c) => [c.id, c])));
  const [meet, setMeet] = useState(() => new Map(acquainted.map((a) => [a.id, a])));
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [nextReview, setNextReview] = useState<string | undefined>();
  const [graded, setGraded] = useState<{ id: string; g: Grade }[]>([]);
  const [stopped, setStopped] = useState(false);

  const item = current(lesson);
  const p = item && byId.get(item.id);
  const now = () => new Date();
  const lang = settings.lang;

  // S1 options: the right meaning and two from phrases of other topics, in random order (fixed per card).
  const options = useMemo(() => {
    if (!p || item?.kind !== 'stage' || item.stage !== 1) return [];
    const others = shuffle(phrases.filter((x) => x.topic !== p.topic && x.ru !== p.ru).map((x) => x.ru));
    return shuffle([p.ru, ...[...new Set(others)].slice(0, 2)]);
  }, [stageKey(item), lesson.shown.length]);

  // A phrase becomes «знакомлюсь» the moment it is first shown: it then counts against today's limit
  // and resumes at S2 if the lesson is left before it passes S4.
  useEffect(() => {
    if (item?.kind !== 'stage' || meet.has(item.id) || deck.has(item.id)) return;
    const a: Acquaintance = { id: item.id, lang, started: Date.now(), stage: -1 };
    setMeet((m) => new Map(m).set(a.id, a));
    saveAcquaint(a);
  }, [stageKey(item), lesson.shown.length]);

  const stageStep = (answer: Answer) => {
    const it = item as Extract<Item, { kind: 'stage' }>;
    const step = answerStage(lesson, answer);
    setOutcome(null);
    setNextReview(undefined);
    setLesson(step.lesson);
    if ('pass' in answer && answer.pass && it.stage < 4) {
      const a = meet.get(it.id);
      if (a && a.stage < it.stage) {
        const upd = { ...a, stage: it.stage };
        setMeet((m) => new Map(m).set(a.id, upd));
        saveAcquaint(upd);
      }
    }
  };

  /** S4 passed: the phrase gets its FSRS card with the first grade (Good clean, Hard with hints or marks). */
  const graduateNow = (o: Outcome) => {
    const t = now();
    const a = meet.get(item!.id);
    const g = graduationGrade({ verdict: o.result!.verdict, hints: o.hints });
    const { card, log } = review(newCard(item!.id, lang, t, a?.started ?? t.getTime()), g, t);
    const weak: Record<string, number> = {};
    const bad = new Set(o.weak);
    o.result!.words.forEach((w, i) => w.kind !== 'ok' && bad.add(i));
    for (const i of bad) {
      const lemma = p!.tokens[i]?.lemma;
      if (lemma) weak[lemma] = (weak[lemma] ?? 0) + 1;
    }
    const c = { ...card, weak };
    setDeck((d) => new Map(d).set(c.id, c));
    setMeet((m) => {
      const n = new Map(m);
      n.delete(c.id);
      return n;
    });
    graduate(c, { cardId: c.id, ts: t.getTime(), grade: g, mode: 'ladder', hints: o.hints, log });
    setNextReview(whenRu(c.fsrs.due, t));
  };

  const typedDone = (o: Outcome) => {
    setOutcome(o);
    if (item?.kind === 'stage' && item.stage === 4 && o.result!.verdict !== 'bad') graduateNow(o);
  };

  const gradeReview = (g: Grade) => {
    const c = deck.get(item!.id)!;
    const o = outcome!;
    const t = now();
    const { card, log } = review(c, g, t);
    // Hinted words and words with mistakes are remembered per lemma: input for ending drills.
    const weak = { ...card.weak };
    const bad = new Set(o.weak);
    o.result?.words.forEach((w, i) => w.kind !== 'ok' && bad.add(i));
    for (const i of bad) {
      const lemma = p!.tokens[i]?.lemma;
      if (lemma) weak[lemma] = (weak[lemma] ?? 0) + 1;
    }
    const next = { ...card, weak };
    setDeck((d) => new Map(d).set(next.id, next));
    saveReview(next, { cardId: c.id, ts: t.getTime(), grade: g, mode: o.mode, hints: o.hints, log });
    setGraded([...graded, { id: c.id, g }]);
    setOutcome(null);
    setLesson(answerReview(lesson, g === 'again').lesson);
  };

  if (stopped || !item || !p) {
    const total = lessonSize(input);
    const right = graded.filter((x) => x.g === 'good' || x.g === 'easy').length;
    const meeting = unfinished(lesson).length;
    const t = now();
    const nextDue = [...deck.values()].map((c) => c.fsrs.due).filter((d) => d.getTime() > t.getTime()).sort((a, b) => a.getTime() - b.getTime())[0];
    return (
      <div class="session">
        <main class="s-main summary">
          <h1 class="title">{total ? 'Готово' : 'На сегодня всё'}</h1>
          {total > 0 && (
            <div class="today">
              <div class="stat accent">
                <b>{lesson.graduated.length}</b>
                <span>{plural(lesson.graduated.length, 'новая фраза выучена', 'новые фразы выучены', 'новых фраз выучено')}</span>
              </div>
              <div class="stat">
                <b>
                  {right}
                  <small>/{graded.length}</small>
                </b>
                <span>повторений вспомнил сам</span>
              </div>
            </div>
          )}
          {meeting > 0 && <p class="subtitle">Ещё знакомлюсь: {meeting} — в следующий раз начнём со сборки из слов</p>}
          {nextDue && <p class="subtitle">Следующее повторение — {whenRu(nextDue, t)}</p>}
        </main>
        <footer class="s-actions">
          <button class="btn primary" onClick={onExit}>
            Закончить
          </button>
        </footer>
      </div>
    );
  }

  const shown = lesson.shown.length;
  return (
    <div class="session" key={`${shown}-${stageKey(item)}`}>
      <TopBar pos={shown} total={shown + lesson.queue.length} onClose={() => (shown ? setStopped(true) : onExit())} />
      {item.kind === 'stage' && item.stage === 0 && (
        <Intro p={p} settings={settings} onNext={() => stageStep({ pass: true })} onKnown={() => stageStep({ known: true })} />
      )}
      {item.kind === 'stage' && item.stage === 1 && <ListenChoose p={p} options={options} settings={settings} onDone={(pass) => stageStep(pass ? { pass: true } : { pass: false })} />}
      {item.kind === 'stage' && item.stage === 2 && <Tiles p={p} settings={settings} trap={false} onNext={(pass) => stageStep(pass ? { pass: true } : { pass: false })} />}
      {item.kind === 'stage' && item.stage >= 3 && <TypeCard p={p} cue={item.stage === 3} onDone={typedDone} />}
      {item.kind === 'review' && item.mode === 'type' && <TypeCard p={p} onDone={setOutcome} />}
      {item.kind === 'review' && item.mode === 'say' && <SayCard p={p} onDone={setOutcome} />}
      {outcome && item.kind === 'stage' && (
        <StageFeedback
          p={p}
          o={outcome}
          stage={item.stage as 3 | 4}
          settings={settings}
          nextReview={nextReview}
          onNext={() => stageStep(outcome.result!.verdict !== 'bad' ? { pass: true } : { pass: false })}
        />
      )}
      {outcome && item.kind === 'review' && deck.get(p.id) && <Feedback p={p} card={deck.get(p.id)!} o={outcome} settings={settings} onGrade={gradeReview} />}
    </div>
  );
}
