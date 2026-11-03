import { useMemo, useState } from 'preact/hooks';
import { TOPIC_RU, type Phrase, type Token } from '../core/types';
import { WordSheet } from './WordSheet';

/** Latvian text where every word is a button that opens its analysis. */
export function TappableText({ phrase, onWord }: { phrase: Phrase; onWord: (t: Token) => void }) {
  // Split on words but keep punctuation/spaces; tokens are matched in order.
  // \p{L}, not \W: in JS \W is ASCII-only even with the u flag, so "ī" would break words.
  const parts = phrase.text.split(/(\p{L}+(?:-\p{L}+)*)/u);
  let i = 0;
  return (
    <p class="lv-text">
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

export function PhraseList({ phrases }: { phrases: Phrase[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const [word, setWord] = useState<Token | null>(null);

  const groups = useMemo(() => {
    const m = new Map<string, Phrase[]>();
    for (const p of phrases) m.set(p.topic, [...(m.get(p.topic) ?? []), p]);
    const order = Object.keys(TOPIC_RU);
    const rank = (t: string) => (order.includes(t) ? order.indexOf(t) : order.length);
    return [...m.entries()].sort(([a], [b]) => rank(a) - rank(b));
  }, [phrases]);

  const verified = phrases.filter((p) => p.status === 'tutor').length;

  return (
    <div class="list">
      <p class="muted">
        {phrases.length} фраз · проверено репетитором: {verified}. Нажми на фразу, потом на слово — увидишь разбор.
      </p>
      {groups.map(([topic, items]) => (
        <section key={topic}>
          <h2 class="group-title">{TOPIC_RU[topic] ?? topic}</h2>
          {items.map((p) => (
            <article key={p.id} class={`phrase ${open === p.id ? 'open' : ''}`} onClick={() => setOpen(open === p.id ? null : p.id)}>
              <div class="phrase-head">
                <span class="phrase-lv">{p.text}</span>
                {p.status !== 'tutor' && <span class="tag warn">не проверено</span>}
              </div>
              <p class="phrase-ru">{p.ru}</p>
              {open === p.id && (
                <div onClick={(e) => e.stopPropagation()}>
                  <TappableText phrase={p} onWord={setWord} />
                </div>
              )}
            </article>
          ))}
        </section>
      ))}
      {word && <WordSheet token={word} onClose={() => setWord(null)} />}
    </div>
  );
}
