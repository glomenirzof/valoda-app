import { buildQueue, plan } from '../core/session';
import { whenRu, type StoredCard } from '../core/srs';
import { TOPIC_RU, type Phrase, type Settings } from '../core/types';
import { Icon } from './icons';

// Tile hues per topic; purple range (250–300) is left out on purpose.
export const TOPIC_HUE: Record<string, number> = {
  polite: 15, me: 30, understand: 200, shop: 45, city: 210, time: 170,
  gym: 5, health: 140, home: 25, weather: 195, work: 60, likes: 340,
};

export function Home({ phrases, cards, settings, onTopic, onStart }: {
  phrases: Phrase[];
  cards: StoredCard[];
  settings: Settings;
  onTopic: (t: string) => void;
  onStart: () => void;
}) {
  const now = new Date();
  const { due, newLeft, paused, fresh, next } = plan(phrases, cards, settings, now);
  const newToday = Math.min(newLeft, fresh.length);
  const canStart = buildQueue(phrases, cards, settings, now).length > 0;
  const date = now.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
  const counts = new Map<string, number>();
  for (const p of phrases) counts.set(p.topic, (counts.get(p.topic) ?? 0) + 1);

  return (
    <>
      <h1 class="title">Сегодня</h1>
      <p class="subtitle">{date}</p>

      <div class="today">
        <div class="stat">
          <b>{due.length}</b>
          <span>повторений</span>
        </div>
        <div class="stat accent">
          <b>{newToday}</b>
          <span>новых фраз</span>
        </div>
      </div>
      {paused && <p class="subtitle">Много повторений накопилось — новые фразы на паузе, пока их не станет меньше.</p>}
      {!paused && fresh.length === 0 && cards.length === 0 && (
        <p class="subtitle">
          Репетитор ещё не проверил фразы. Чтобы учить их уже сейчас, включи «Непроверенные фразы» в настройках.
        </p>
      )}

      <h2 class="section-title">Темы</h2>
      <div class="tiles">
        {Object.keys(TOPIC_RU)
          .filter((t) => counts.has(t))
          .map((t) => (
            <button key={t} class="tile" style={{ '--h': TOPIC_HUE[t] ?? 30 }} onClick={() => onTopic(t)}>
              <b>{TOPIC_RU[t]}</b>
              <span>{counts.get(t)} фраз</span>
            </button>
          ))}
      </div>

      <div class="start">
        <button class="btn primary" disabled={!canStart} onClick={onStart}>
          Начать <Icon name="arrow" />
        </button>
        {!canStart && <p class="note">{next ? `На сегодня всё. Следующее повторение — ${whenRu(next, now)}` : 'Пока нечего учить'}</p>}
      </div>
    </>
  );
}
