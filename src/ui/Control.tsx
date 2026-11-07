import { useMemo, useState } from 'preact/hooks';
import { controlPercent, type ControlResult } from '../core/progress';
import type { Phrase, Settings } from '../core/types';
import { saveControl } from '../data/db';
import { Icon } from './icons';
import { KeyText, Mistakes, SampleSound, TypeCard, type Outcome } from './Session';

/**
 * Weekly control test: 20 random phrases the learner holds (помню/знаю), Russian → typed Latvian, no hints,
 * nothing written to FSRS. Only the share of fully correct answers is kept: an honest measure of the method.
 */
export function Control({ phrases, ids, settings, onExit }: { phrases: Phrase[]; ids: string[]; settings: Settings; onExit: () => void }) {
  const byId = useMemo(() => new Map(phrases.map((p) => [p.id, p])), [phrases]);
  const list = ids.map((id) => byId.get(id)).filter((p): p is Phrase => !!p);
  const [i, setI] = useState(0);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [score, setScore] = useState({ correct: 0, almost: 0 });
  const [result, setResult] = useState<ControlResult | null>(null);
  const p = list[i];

  const next = () => {
    const v = outcome!.result!.verdict;
    const s = { correct: score.correct + (v === 'ok' ? 1 : 0), almost: score.almost + (v === 'almost' ? 1 : 0) };
    setScore(s);
    setOutcome(null);
    if (i + 1 < list.length) return setI(i + 1);
    const r: ControlResult = { ts: Date.now(), lang: settings.lang, total: list.length, ...s };
    saveControl(r);
    setResult(r);
  };

  if (result || !p) {
    const r = result ?? { ts: 0, lang: settings.lang, total: 0, correct: 0, almost: 0 };
    return (
      <div class="session">
        <main class="s-main summary">
          <h1 class="title">Контрольная</h1>
          <div class="today">
            <div class="stat accent">
              <b>{controlPercent(r)}%</b>
              <span>написал без ошибок</span>
            </div>
            <div class="stat">
              <b>
                {r.correct}
                <small>/{r.total}</small>
              </b>
              <span>фраз верно{r.almost ? `, ещё ${r.almost} без знаков` : ''}</span>
            </div>
          </div>
          <p class="subtitle">Повторения не изменились. Результат — на экране «Прогресс», следующая контрольная через неделю</p>
        </main>
        <footer class="s-actions">
          <button class="btn primary" onClick={onExit}>
            Закончить
          </button>
        </footer>
      </div>
    );
  }

  return (
    <div class="session" key={i}>
      <header class="s-top">
        <button class="icon-btn" aria-label="Закончить" onClick={onExit}>
          <Icon name="x" />
        </button>
        <div class="s-progress">
          <i style={{ width: `${Math.round(((i + 1) / list.length) * 100)}%` }} />
        </div>
        <span class="s-count">
          {i + 1}/{list.length}
        </span>
      </header>
      <TypeCard p={p} noHints eyebrow="Контрольная · без подсказок" onDone={setOutcome} />
      {outcome && (
        <>
          <div class="scrim" />
          <section class={`sheet fb v-${outcome.result!.verdict}`} role="dialog" aria-label="Ответ">
            <div class="grab" />
            <p class="verdict">
              <Icon name={outcome.result!.verdict === 'ok' ? 'check' : 'alert'} />
              <span>{outcome.result!.verdict === 'ok' ? 'Верно' : outcome.result!.verdict === 'almost' ? 'Почти — без знаков' : 'Не совсем'}</span>
            </p>
            <div class="right">
              <SampleSound p={p} settings={settings} />
              <p class="right-lv">
                <KeyText p={p} />
              </p>
            </div>
            <Mistakes p={p} r={outcome.result!} />
            <button class="btn primary" onClick={next}>
              Дальше <Icon name="arrow" />
            </button>
          </section>
        </>
      )}
    </div>
  );
}
