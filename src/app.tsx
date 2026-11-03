import { useEffect, useState } from 'preact/hooks';
import { DEFAULT_SETTINGS, type Phrase, type Settings as S } from './core/types';
import { loadPhrases } from './data/content';
import { loadSettings, requestPersistence, saveSettings } from './data/db';
import { Home } from './ui/Home';
import { Icon, type IconName } from './ui/icons';
import { applyLook } from './ui/look';
import { PhraseList } from './ui/PhraseList';
import { Progress } from './ui/Progress';
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

  useEffect(() => {
    loadSettings().then(setSettings);
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

  useEffect(() => {
    loadPhrases(settings.lang)
      .then((f) => setPhrases(f.phrases))
      .catch((e) => setError(String(e)));
  }, [settings.lang]);

  const update = (s: S) => {
    setSettings(s);
    saveSettings(s);
  };

  const go = (t: Tab) => {
    setTab(t);
    scrollTo(0, 0);
  };

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
            settings={settings}
            onTopic={(t) => {
              setTopic(t);
              go('phrases');
            }}
          />
        ) : tab === 'phrases' ? (
          <PhraseList phrases={phrases} topic={topic} onTopic={setTopic} />
        ) : tab === 'progress' ? (
          <Progress phrases={phrases} settings={settings} />
        ) : (
          <Settings value={settings} onChange={update} />
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
