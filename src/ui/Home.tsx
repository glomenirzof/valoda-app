import { TOPIC_RU, type Phrase, type Settings } from '../core/types';
import { Icon } from './icons';

// Tile hues per topic; purple range (250–300) is left out on purpose.
export const TOPIC_HUE: Record<string, number> = {
  polite: 15, me: 30, understand: 200, shop: 45, city: 210, time: 170,
  gym: 5, health: 140, home: 25, weather: 195, work: 60, likes: 340,
};

export const trainable = (phrases: Phrase[], s: Settings) => phrases.filter((p) => p.status === 'tutor' || s.allowUnverified);

export function Home({ phrases, settings, onTopic }: { phrases: Phrase[]; settings: Settings; onTopic: (t: string) => void }) {
  const ready = trainable(phrases, settings);
  const newToday = Math.min(settings.newPerDay, ready.length);
  const reviews = 0; // FSRS reviews arrive with the session step
  const date = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
  const counts = new Map<string, number>();
  for (const p of phrases) counts.set(p.topic, (counts.get(p.topic) ?? 0) + 1);

  return (
    <>
      <h1 class="title">Сегодня</h1>
      <p class="subtitle">{date}</p>

      <div class="today">
        <div class="stat">
          <b>{reviews}</b>
          <span>повторений</span>
        </div>
        <div class="stat accent">
          <b>{newToday}</b>
          <span>новых фраз</span>
        </div>
      </div>
      {ready.length === 0 && (
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
        <button class="btn primary" disabled>
          Начать <Icon name="arrow" />
        </button>
        <p class="note">Тренировка появится на следующем шаге</p>
      </div>
    </>
  );
}
