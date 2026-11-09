import { useEffect, useState } from 'preact/hooks';
import type { LessonInput } from './core/ladder';
import { canSay, controlPick, levelMap, type ControlResult } from './core/progress';
import { lessonInput, trainable, type Acquaintance } from './core/session';
import type { StoredCard } from './core/srs';
import { DEFAULT_SETTINGS, type Phrase, type Settings as S } from './core/types';
import { setSound, unlockAudio } from './data/audio';
import { loadImages, type ImagesData } from './data/images';
import { loadPhrases } from './data/content';
import { loadAcquaint, loadCards, loadControl, loadSettings, requestPersistence, saveSettings } from './data/db';
import { Control } from './ui/Control';
import { Placement } from './ui/Placement';
import { Home } from './ui/Home';
import { Icon, type IconName } from './ui/icons';
import { applyLook } from './ui/look';
import { PhraseList } from './ui/PhraseList';
import { Progress } from './ui/Progress';
import { Session } from './ui/Session';
import { Settings } from './ui/Settings';

type Tab = 'learn' | 'phrases' | 'progress' | 'settings';

const TABS: [Tab, string, IconName][] = [
  ['learn', 'Учить', 'learn'],
  ['phrases', 'Фразы', 'phrases'],
  ['progress', 'Прогресс', 'progress'],
  ['settings', 'Настройки', 'settings'],
];

export function App() {
  const [tab, setTab] = useState<Tab>('learn');
  const [topic, setTopic] = useState<string | null>(null);
  const [settings, setSettings] = useState<S>(DEFAULT_SETTINGS);
  const [phrases, setPhrases] = useState<Phrase[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [cards, setCards] = useState<StoredCard[]>([]);
  const [acquaint, setAcquaint] = useState<Acquaintance[]>([]);
  const [session, setSession] = useState<LessonInput | null>(null);
  const [control, setControl] = useState<ControlResult[]>([]);
  /** phrase ids of a running control test */
  const [test, setTest] = useState<string[] | null>(null);
  /** placement test running */
  const [placing, setPlacing] = useState(false);
  const [images, setImages] = useState<ImagesData | null>(null);
  /** settings and the learner's data are loaded: only then can the first-launch offer be decided */
  const [loaded, setLoaded] = useState({ settings: false, data: false });

  useEffect(() => {
    loadSettings().then((s) => {
      setSettings(s);
      setLoaded((l) => ({ ...l, settings: true }));
    });
    requestPersistence();
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    addEventListener('online', on);
    addEventListener('offline', off);
    return () => {
      removeEventListener('online', on);
      removeEventListener('offline', off);
    };
  }, []);

  // Until the user picks a theme, follow the system one, including live changes.
  useEffect(() => {
    applyLook(settings);
    if (settings.theme) return;
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyLook(settings);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [settings]);

  useEffect(() => setSound(settings.sound), [settings.sound]);

  useEffect(() => {
    loadPhrases(settings.lang)
      .then((f) => setPhrases(f.phrases))
      .catch((e) => setError(String(e)));
    Promise.all([loadCards(settings.lang).then(setCards), loadAcquaint(settings.lang).then(setAcquaint)]).then(() =>
      setLoaded((l) => ({ ...l, data: true })),
    );
    loadControl(settings.lang).then(setControl);
    loadImages(settings.lang).then(setImages);
  }, [settings.lang]);

  const update = (s: S) => {
    setSettings(s);
    saveSettings(s);
  };

  const go = (t: Tab) => {
    setTab(t);
    scrollTo(0, 0);
  };

  const startControl = () => {
    if (!phrases) return;
    unlockAudio();
    const levels = levelMap(trainable(phrases), cards, acquaint);
    setTest(controlPick([...levels.entries()].filter(([, l]) => canSay(l)).map(([id]) => id)));
  };

  if (placing && phrases) {
    return (
      <Placement
        phrases={phrases}
        cards={cards}
        acquainted={acquaint}
        settings={settings}
        onExit={() => setPlacing(false)}
        onDone={(r, placed) => {
          update({
            ...settings,
            onboarded: true,
            placement: { ts: Date.now(), level: r.level, vocab: r.vocab, pos: r.pos, known: placed, total: r.total },
          });
          loadCards(settings.lang).then(setCards);
          setPlacing(false);
          go('learn');
        }}
      />
    );
  }

  // First launch: nothing learned yet and the offer not answered — offer the placement test.
  if (loaded.settings && loaded.data && phrases && !settings.onboarded && cards.length === 0 && acquaint.length === 0) {
    return (
      <div class="session">
        <main class="s-main summary">
          <h1 class="title">Labdien!</h1>
          <p class="subtitle">Уже немного знаешь латышский? Пройди тест уровня — около пяти минут. Фразы, которые ты знаешь, не будут попадаться как новые: я сразу отправлю их в повторения.</p>
          <p class="note">Тест можно пройти позже в настройках</p>
        </main>
        <footer class="s-actions two">
          <button class="btn ghost" onClick={() => update({ ...settings, onboarded: true })}>
            Начать с нуля
          </button>
          <button class="btn primary" onClick={() => setPlacing(true)}>
            Тест уровня <Icon name="arrow" />
          </button>
        </footer>
      </div>
    );
  }

  if (test && phrases) {
    return (
      <Control
        phrases={phrases}
        ids={test}
        settings={settings}
        onExit={() => {
          loadControl(settings.lang).then(setControl);
          setTest(null);
          scrollTo(0, 0);
        }}
      />
    );
  }

  if (session && phrases) {
    return (
      <Session
        phrases={phrases}
        cards={cards}
        acquainted={acquaint}
        input={session}
        settings={settings}
        onExit={() => {
          // everything was saved as it happened; reload what the lesson changed
          loadCards(settings.lang).then(setCards);
          loadAcquaint(settings.lang).then(setAcquaint);
          setSession(null);
          scrollTo(0, 0);
        }}
      />
    );
  }

  return (
    <>
      <main class={`screen ${tab === 'learn' ? 'has-start' : ''}`} key={tab}>
        {!online && (
          <span class="offline">
            <Icon name="offline" />
            офлайн
          </span>
        )}
        {error ? (
          <p class="muted">Не удалось загрузить фразы: {error}</p>
        ) : !phrases ? (
          <p class="muted">Загрузка…</p>
        ) : tab === 'learn' ? (
          <Home
            phrases={phrases}
            cards={cards}
            acquainted={acquaint}
            control={control}
            settings={settings}
            onControl={startControl}
            onStart={() => {
              // iOS Safari: the first play() must happen inside this tap; later clips reuse the unlocked player
              unlockAudio();
              setSession(lessonInput(phrases, cards, settings, new Date(), acquaint));
            }}
            onTopic={(t) => {
              setTopic(t);
              go('phrases');
            }}
          />
        ) : tab === 'phrases' ? (
          <PhraseList phrases={phrases} lang={settings.lang} topic={topic} onTopic={setTopic} />
        ) : tab === 'progress' ? (
          <Progress phrases={phrases} cards={cards} acquainted={acquaint} control={control} settings={settings} onControl={startControl} />
        ) : (
          <Settings value={settings} onChange={update} onPlacement={() => setPlacing(true)} images={images} />
        )}
      </main>

      <nav class="nav" aria-label="Разделы">
        {TABS.map(([id, label, icon]) => (
          <button key={id} class={tab === id ? 'on' : ''} aria-current={tab === id ? 'page' : undefined} onClick={() => go(id)}>
            <Icon name={icon} />
            {label}
          </button>
        ))}
      </nav>
    </>
  );
}
