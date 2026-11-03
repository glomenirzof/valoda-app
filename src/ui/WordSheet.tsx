import { featsLong, paradigmRu, POS_RU } from '../core/grammar-ru';
import type { Lang, Token } from '../core/types';
import { playWord, wordKey } from '../data/audio';
import { Icon } from './icons';

/** Bottom sheet with the analysis of one tapped word; both the form and the dictionary form can be heard. */
export function WordSheet({ token, lang, onClose }: { token: Token; lang: Lang; onClose: () => void }) {
  const paradigm = paradigmRu(token);
  const gender = token.gender === 'M' ? 'мужской род' : token.gender === 'F' ? 'женский род' : null;
  const form = wordKey(token);
  return (
    <>
      <div class="scrim" onClick={onClose} />
      <section class="sheet" role="dialog" aria-label={`Разбор слова ${token.s}`}>
        <div class="grab" />
        <div class="ws-head">
          <p class="ws-form">{token.s}</p>
          <button class="a-mini" aria-label={`Слушать ${form}`} onClick={() => playWord(lang, form)}>
            <Icon name="play" />
          </button>
        </div>
        <p class="ws-ru">{token.ru || '—'}</p>
        <dl class="facts">
          <div>
            <dt>Начальная форма</dt>
            <dd>
              {token.lemma.toLowerCase() !== form.toLowerCase() && (
                <button class="a-inline" aria-label={`Слушать ${token.lemma}`} onClick={() => playWord(lang, token.lemma)}>
                  <Icon name="play" />
                </button>
              )}
              {token.lemma}
            </dd>
          </div>
          <div>
            <dt>Часть речи</dt>
            <dd>{[POS_RU[token.pos] ?? token.pos, gender, paradigm].filter(Boolean).join(', ')}</dd>
          </div>
          {token.feats && (
            <div>
              <dt>Эта форма</dt>
              <dd>{featsLong(token.feats).join(', ')}</dd>
            </div>
          )}
          {token.alt?.length ? (
            <div>
              <dt>Может быть и</dt>
              <dd>{token.alt.map((a) => featsLong(a).join(', ')).join('; ')}</dd>
            </div>
          ) : null}
        </dl>
        <button class="btn ghost" onClick={onClose}>
          Понятно
        </button>
      </section>
    </>
  );
}
