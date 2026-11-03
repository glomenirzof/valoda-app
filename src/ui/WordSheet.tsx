import { featsLong, paradigmRu, POS_RU } from '../core/grammar-ru';
import type { Token } from '../core/types';

/** Bottom sheet with the analysis of one tapped word. */
export function WordSheet({ token, onClose }: { token: Token; onClose: () => void }) {
  const paradigm = paradigmRu(token);
  const gender = token.gender === 'M' ? 'мужской род' : token.gender === 'F' ? 'женский род' : null;
  return (
    <>
      <div class="scrim" onClick={onClose} />
      <section class="sheet" role="dialog" aria-label={`Разбор слова ${token.s}`}>
        <div class="grab" />
        <p class="ws-form">{token.s}</p>
        <p class="ws-ru">{token.ru || '—'}</p>
        <dl class="facts">
          <div>
            <dt>Начальная форма</dt>
            <dd>{token.lemma}</dd>
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
