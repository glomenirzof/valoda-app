import { useMemo, useState } from 'preact/hooks';
import { TOPIC_RU, type Lang, type Phrase, type Token } from '../core/types';
import { playPhrase, soundEnabled } from '../data/audio';
import { Icon } from './icons';
import { StatusTag } from './StatusTag';
import { WordSheet } from './WordSheet';

/** Latvian text where every word is a button that opens its analysis. */
export function TappableText({ phrase, onWord, cls = 'lv-text' }: { phrase: Phrase; onWord: (t: Token) => void; cls?: string }) {
  // Split on words but keep punctuation/spaces; tokens are matched in order.
  // \p{L}, not \W: in JS \W is ASCII-only even with the u flag, so "ī" would break words.
  const parts = phrase.text.split(/(\p{L}+(?:-\p{L}+)*)/u);
  let i = 0;
  return (
    <p class={cls}>
      {parts.map((part, k) => {
        if (k % 2 === 0) return part;
        const t = phrase.tokens[i++];
        return t ? (
          <button key={k} class="word" onClick={() => onWord(t)}>
            {part}
          </button>
        ) : (
          part
        );
      })}
    </p>
  );
}

export function PhraseList({ phrases, lang, topic, onTopic }: { phrases: Phrase[]; lang: Lang; topic: string | null; onTopic: (t: string | null) => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const [word, setWord] = useState<Token | null>(null);

  const groups = useMemo(() => {
    const m = new Map<string, Phrase[]>();
    for (const p of phrases) if (!topic || p.topic === topic) m.set(p.topic, [...(m.get(p.topic) ?? []), p]);
    const order = Object.keys(TOPIC_RU);
    const rank = (t: string) => (order.includes(t) ? order.indexOf(t) : order.length);
    return [...m.entries()].sort(([a], [b]) => rank(a) - rank(b));
  }, [phrases, topic]);

  const topics = useMemo(() => Object.keys(TOPIC_RU).filter((t) => phrases.some((p) => p.topic === t)), [phrases]);
  const tutor = phrases.filter((p) => p.status === 'tutor').length;
  const auto = phrases.filter((p) => p.status !== 'tutor' && p.auto === 'ok').length;

  return (
    <>
      <h1 class="title">Фразы</h1>
      <p class="subtitle">
        {phrases.length} фраз · проверено автоматически: {auto} · репетитором: {tutor}
      </p>

      <div class="chips">
        <button class={`chip ${topic ? '' : 'on'}`} onClick={() => onTopic(null)}>
          Все
        </button>
        {topics.map((t) => (
          <button key={t} class={`chip ${topic === t ? 'on' : ''}`} onClick={() => onTopic(t)}>
            {TOPIC_RU[t]}
          </button>
        ))}
      </div>

      {groups.map(([t, items]) => (
        <section key={t}>
          {!topic && <h2 class="group-title">{TOPIC_RU[t] ?? t}</h2>}
          {items.map((p) => (
            <article key={p.id} class="phrase" onClick={() => setOpen(open === p.id ? null : p.id)}>
              <div class="phrase-head">
                <span class="phrase-lv">{p.text}</span>
                <StatusTag p={p} />
              </div>
              <p class="phrase-ru">{p.ru}</p>
              {open === p.id && (
                <div onClick={(e) => e.stopPropagation()}>
                  <TappableText phrase={p} onWord={setWord} />
                  <div class="phrase-tools">
                    {soundEnabled() && (
                      <>
                        <button class="a-mini" aria-label="Слушать" onClick={() => playPhrase(lang, p.id)}>
                          <Icon name="play" />
                        </button>
                        <button class="a-mini" aria-label="Медленно" onClick={() => playPhrase(lang, p.id, 0.75)}>
                          <Icon name="slow" />
                        </button>
                      </>
                    )}
                    <p class="tap-hint">Нажми на слово — покажу разбор</p>
                  </div>
                </div>
              )}
            </article>
          ))}
        </section>
      ))}
      {word && <WordSheet token={word} lang={lang} onClose={() => setWord(null)} />}
    </>
  );
}
