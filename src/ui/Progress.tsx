import {
  canSay, controlDue, controlPercent, CONTROL_EVERY_DAYS, CONTROL_MIN, countLevels, forecast, LEVEL_RU, LEVELS, levelMap, topicLevels,
  weakSpots, weekOf, type ControlResult, type Level,
} from '../core/progress';
import { trainable, type Acquaintance } from '../core/session';
import type { StoredCard } from '../core/srs';
import { TOPIC_RU, type Phrase, type Settings } from '../core/types';
import { Icon } from './icons';

/** Stacked bar of the five levels. */
function LevelBar({ n, total }: { n: Record<Level, number>; total: number }) {
  return (
    <div class="lvl-bar" role="img" aria-label={LEVELS.map((l) => `${LEVEL_RU[l]}: ${n[l]}`).join(', ')}>
      {LEVELS.filter((l) => l !== 'new' && n[l]).map((l) => (
        <i key={l} class={`lv-${l}`} style={{ width: `${(n[l] / Math.max(total, 1)) * 100}%` }} />
      ))}
    </div>
  );
}

const DAY = 86400000;
const plural = (n: number, one: string, few: string, many: string) => {
  const m10 = n % 10, m100 = n % 100;
  return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many;
};

export function Progress({ phrases, cards, acquainted, control, settings, onControl }: {
  phrases: Phrase[];
  cards: StoredCard[];
  acquainted: Acquaintance[];
  control: ControlResult[];
  settings: Settings;
  onControl: () => void;
}) {
  const now = new Date();
  const pool = trainable(phrases, settings);
  const levels = levelMap(pool, cards, acquainted);
  const n = countLevels(levels.values());
  const say = n.remember + n.know;
  const topics = topicLevels(pool, levels);
  const weak = weakSpots(cards, phrases);
  const fc = forecast(cards, now);
  const held = [...levels.values()].filter(canSay).length;
  const due = controlDue(control, held, now);
  const last = control[control.length - 1];
  const nextIn = last ? Math.max(1, Math.ceil((last.ts + CONTROL_EVERY_DAYS * DAY - now.getTime()) / DAY)) : 0;
  // one bar per week, the last 8 weeks that had a test
  const weeks = [...new Map(control.map((r) => [weekOf(r.ts), r])).values()].slice(-8);

  return (
    <>
      <h1 class="title">Прогресс</h1>

      <div class="card say-card">
        <p class="muted">Могу сказать</p>
        <p class="say-n">
          <b>{say}</b> {plural(say, 'фраза', 'фразы', 'фраз')}
          <span class="muted"> из {pool.length}</span>
        </p>
        <LevelBar n={n} total={pool.length} />
        <ul class="lvl-legend">
          {LEVELS.filter((l) => l !== 'new').map((l) => (
            <li key={l}>
              <i class={`lv-${l}`} />
              {LEVEL_RU[l]} <b>{n[l]}</b>
            </li>
          ))}
          <li>
            <i class="lv-new" />
            {LEVEL_RU.new} <b>{n.new}</b>
          </li>
        </ul>
        <p class="note">Помню — держится неделю и дольше, знаю — три недели и дольше</p>
      </div>

      <h2 class="section-title">Повторения</h2>
      <div class="today">
        <div class="stat">
          <b>{fc.tomorrow}</b>
          <span>до конца завтра</span>
        </div>
        <div class="stat">
          <b>{fc.week}</b>
          <span>за 7 дней</span>
        </div>
      </div>

      <h2 class="section-title">Контрольная</h2>
      <div class="card">
        {weeks.length > 0 ? (
          <div class="weeks" role="img" aria-label={weeks.map((r) => `${controlPercent(r)}%`).join(', ')}>
            {weeks.map((r) => (
              <div key={r.ts} class="week">
                <span>{controlPercent(r)}%</span>
                <i style={{ height: `${Math.max(4, controlPercent(r))}%` }} />
                <small>{new Date(weekOf(r.ts)).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</small>
              </div>
            ))}
          </div>
        ) : (
          <p class="note">Раз в неделю — 20 фраз, которые ты помнишь: перевод с русского, без подсказок и без влияния на повторения. Это честная проверка, работает ли обучение</p>
        )}
        {due ? (
          <button class="btn primary" onClick={onControl}>
            Пройти контрольную <Icon name="arrow" />
          </button>
        ) : (
          <p class="note">
            {held < CONTROL_MIN
              ? `Откроется, когда ${CONTROL_MIN} фраз будут на уровне «помню»: сейчас ${held}`
              : `Следующая — через ${nextIn} ${plural(nextIn, 'день', 'дня', 'дней')}`}
          </p>
        )}
      </div>

      {weak.length > 0 && (
        <>
          <h2 class="section-title">Слабые места</h2>
          <div class="rows weak">
            {weak.map((w) => (
              <div key={w.lemma} class="row weak-row">
                <span class="row-text">
                  <b>
                    {w.lemma} <span class="muted">— {w.ru}</span>
                  </b>
                  {w.forms.map((f) => (
                    <small key={f.s}>
                      {f.s}: {f.what || 'неизменяемое слово'}
                    </small>
                  ))}
                </span>
                <span class="row-value">{w.count}×</span>
              </div>
            ))}
          </div>
          <p class="note">Слова, где ты открывал буквы или ошибался в окончании</p>
        </>
      )}

      <h2 class="section-title">По темам</h2>
      <div class="rows">
        {Object.keys(TOPIC_RU)
          .filter((t) => topics.has(t))
          .map((t) => {
            const tn = topics.get(t)!;
            const total = LEVELS.reduce((a, l) => a + tn[l], 0);
            return (
              <div key={t} class="row topic-row">
                <span class="row-text">
                  <b>{TOPIC_RU[t]}</b>
                  <LevelBar n={tn} total={total} />
                </span>
                <span class="row-value">
                  {tn.remember + tn.know}/{total}
                </span>
              </div>
            );
          })}
      </div>
    </>
  );
}
