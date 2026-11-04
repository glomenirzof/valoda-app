import type { Phrase } from '../core/types';

/** Who checked the phrase: the tutor, the automatic check (corpus + two translators), or nobody yet. */
export function StatusTag({ p }: { p: Phrase }) {
  if (p.status === 'tutor') return <span class="tag t-tutor">проверено репетитором</span>;
  if (p.auto === 'ok') return <span class="tag t-auto">проверено автоматически</span>;
  if (p.auto === 'doubtful') return <span class="tag t-doubt">сомнительно</span>;
  return <span class="tag">не проверено</span>;
}
