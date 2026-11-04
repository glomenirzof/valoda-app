import type { Phrase, Settings } from '../core/types';
import { trainable } from '../core/session';

export function Progress({ phrases, settings }: { phrases: Phrase[]; settings: Settings }) {
  const tutor = phrases.filter((p) => p.status === 'tutor').length;
  const doubtful = phrases.filter((p) => p.status !== 'tutor' && p.auto === 'doubtful').length;
  const ready = trainable(phrases, settings).length;
  const pct = phrases.length ? Math.round((ready / phrases.length) * 100) : 0;
  return (
    <>
      <h1 class="title">Прогресс</h1>
      <p class="subtitle">Здесь будет видно, сколько фраз выучено и когда следующие повторения.</p>

      <div class="card">
        <p class="muted">Фразы для тренировки</p>
        <div class="bar">
          <i style={{ width: `${pct}%` }} />
        </div>
        <p>
          <b>{ready}</b> из {phrases.length} проверены · репетитором: {tutor} · сомнительных: {doubtful}
        </p>
      </div>

      <div class="card">
        <p class="muted">Выучено</p>
        <p style={{ fontSize: '15px', marginTop: '8px' }}>Статистика появится после первых тренировок</p>
      </div>
    </>
  );
}
