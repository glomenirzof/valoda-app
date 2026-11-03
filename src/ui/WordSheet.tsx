import { featsLong, paradigmRu, POS_RU } from '../core/grammar-ru';
import type { Token } from '../core/types';

/** Bottom sheet with the analysis of one tapped word. */
export function WordSheet({ token, onClose }: { token: Token; onClose: () => void }) {
  const paradigm = paradigmRu(token);
  const gender = token.gender === 'M' ? 'мужской род' : token.gender === 'F' ? 'женский род' : null;
  return (
    <div class="sheet-backdrop" onClick={onClose}>
      <section class="sheet" role="dialog" aria-label={`Разбор слова ${token.s}`} onClick={(e) => e.stopPropagation()}>
        <div class="sheet-grip" />
        <p class="sheet-form">{token.s}</p>
        <p class="sheet-ru">{token.ru || '—'}</p>
        <dl class="sheet-facts">
          <dt>Начальная форма</dt>
          <dd>{token.lemma}</dd>
          <dt>Часть речи</dt>
          <dd>{[POS_RU[token.pos] ?? token.pos, gender, paradigm].filter(Boolean).join(', ')}</dd>
          {token.feats && (
            <>
              <dt>Эта форма</dt>
              <dd>{featsLong(token.feats).join(', ')}</dd>
            </>
          )}
          {token.alt?.length ? (
            <>
              <dt>Может быть и</dt>
              <dd>{token.alt.map((a) => featsLong(a).join(', ')).join('; ')}</dd>
            </>
          ) : null}
        </dl>
        <button class="big-btn secondary" onClick={onClose}>
          Закрыть
        </button>
      </section>
    </div>
  );
}
