import type { Phrase, Settings } from '../core/types';
import { trainable } from './Home';

export function Progress({ phrases, settings }: { phrases: Phrase[]; settings: Settings }) {
  const verified = phrases.filter((p) => p.status === 'tutor').length;
  const ready = trainable(phrases, settings).length;
  const pct = phrases.length ? Math.round((verified / phrases.length) * 100) : 0;
  return (
    <>
      <h1 class="title">Прогресс</h1>
      <p class="subtitle">Здесь будет видно, сколько фраз выучено и когда следующие повторения.</p>

      <div class="card">
        <p class="muted">Проверено репетитором</p>
        <div class="bar">
          <i style={{ width: `${pct}%` }} />
        </div>
        <p>
          <b>{verified}</b> из {phrases.length} · доступно для тренировки: {ready}
        </p>
      </div>

      <div class="card">
        <p class="muted">Выучено</p>
        <p style={{ fontSize: '15px', marginTop: '8px' }}>Статистика появится после первых тренировок.</p>
      </div>
    </>
  );
}
