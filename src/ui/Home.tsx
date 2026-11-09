import { canSay, controlDue, lessonOfDay, levelMap, type ControlResult } from '../core/progress';
import { lessonInput, lessonSize, MAX_NEW_PER_SESSION, plan, trainable, type Acquaintance } from '../core/session';
import { whenRu, type StoredCard } from '../core/srs';
import { TOPIC_RU, type Phrase, type Settings } from '../core/types';
import { Icon } from './icons';

// Tile hues per topic; purple range (250–300) is left out on purpose.
export const TOPIC_HUE: Record<string, number> = {
  polite: 15, me: 30, understand: 200, shop: 45, city: 210, time: 170,
  gym: 5, health: 140, home: 25, weather: 195, work: 60, likes: 340,
};

export function Home({ phrases, cards, acquainted, control, settings, onTopic, onStart, onControl, onKbTipDone, backupOffer, onBackup, onBackupLater }: {
  phrases: Phrase[];
  cards: StoredCard[];
  acquainted: Acquaintance[];
  control: ControlResult[];
  settings: Settings;
  onTopic: (t: string) => void;
  onStart: () => void;
  onControl: () => void;
  onKbTipDone: () => void;
  /** progress changed and a day has passed: offer to save a copy */
  backupOffer: boolean;
  onBackup: () => void;
  onBackupLater: () => void;
}) {
  const now = new Date();
  const { due, newLeft, paused, fresh, resume, next, introducedToday } = plan(phrases, cards, settings, now, acquainted);
  const newToday = Math.min(newLeft, fresh.length);
  const canStart = lessonSize(lessonInput(phrases, cards, settings, now, acquainted)) > 0;
  // more new phrases a day than fit one lesson: show the lesson number instead of the phrase count
  const split = settings.newPerDay > MAX_NEW_PER_SESSION && !paused && fresh.length > 0;
  const day = lessonOfDay(settings.newPerDay, introducedToday);
  const held = [...levelMap(trainable(phrases), cards, acquainted).values()].filter(canSay).length;
  const showControl = controlDue(control, held, now);
  const startLabel = newToday === 0 && due.length > 0 ? 'Повторить' : introducedToday > 0 ? 'Следующий урок' : 'Начать';
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
        {split && newToday > 0 ? (
          <div class="stat accent">
            <b>
              {day.n}
              <small>/{day.total}</small>
            </b>
            <span>урок на сегодня</span>
          </div>
        ) : (
          <div class="stat accent">
            <b>{newToday}</b>
            <span>новых фраз</span>
          </div>
        )}
      </div>
      {paused && <p class="subtitle">Много повторений накопилось — новые фразы на паузе, пока их не станет меньше.</p>}
      {resume.length > 0 && <p class="subtitle">Знакомлюсь: {resume.length} — продолжим со сборки из слов</p>}
      {!paused && fresh.length === 0 && cards.length === 0 && (
        <p class="subtitle">Пока нет проверенных фраз: учим только те, что прошли проверку по корпусу и переводчикам или у репетитора</p>
      )}

      {showControl && (
        <div class="card control-cta">
          <p>
            <b>Контрольная недели</b>
          </p>
          <p class="note">20 фраз, которые ты помнишь, без подсказок и без влияния на повторения</p>
          <button class="btn ghost" onClick={onControl}>
            Пройти <Icon name="arrow" />
          </button>
        </div>
      )}

      {backupOffer && (
        <div class="card backup-offer">
          <p>
            <b>Сохранить копию прогресса?</b>
          </p>
          <p class="note">Через «Поделиться» — в Файлы или iCloud. Если телефон очистит данные сайта, прогресс вернётся из копии</p>
          <div class="s-actions two">
            <button class="btn ghost" onClick={onBackupLater}>
              Позже
            </button>
            <button class="btn primary" onClick={onBackup}>
              Сохранить
            </button>
          </div>
        </div>
      )}

      {!settings.kbTipDone && (
        <div class="card kb-tip">
          <p>
            <b>Латышская клавиатура на iPhone</b>
          </p>
          <p class="note">
            Настройки → Основные → Клавиатура → Клавиатуры → Новые клавиатуры → Латышская. Тогда ā, š, ž — долгим нажатием на букву. Над полем ввода в уроке
            тоже есть ряд с этими буквами
          </p>
          <button class="btn ghost" onClick={onKbTipDone}>
            Понятно
          </button>
        </div>
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
          {canStart ? (
            <>
              {startLabel} <Icon name="arrow" />
            </>
          ) : next ? (
            `Повторение ${whenRu(next, now)}`
          ) : (
            'Пока нечего учить'
          )}
        </button>
        {split && newToday > 0 && <p class="note">Урок {day.n} из {day.total} на сегодня · {newToday} новых фраз осталось</p>}
        {!canStart && next && <p class="note">Новое на сегодня пройдено — дальше только повторения</p>}
      </div>
    </>
  );
}
