import { useEffect, useState } from 'preact/hooks';
import { DEFAULT_SETTINGS, type Phrase, type Settings as S } from './core/types';
import { loadPhrases } from './data/content';
import { loadSettings, requestPersistence, saveSettings } from './data/db';
import { PhraseList } from './ui/PhraseList';
import { Settings } from './ui/Settings';

type Tab = 'phrases' | 'settings';

export function App() {
  const [tab, setTab] = useState<Tab>('phrases');
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

  useEffect(() => {
    loadPhrases(settings.lang)
      .then((f) => setPhrases(f.phrases))
      .catch((e) => setError(String(e)));
  }, [settings.lang]);

  const update = (s: S) => {
    setSettings(s);
    saveSettings(s);
  };

  return (
    <main class="screen">
      <header class="top">
        <h1>Valoda</h1>
        {!online && <span class="badge off">офлайн</span>}
      </header>

      {tab === 'phrases' &&
        (error ? <p class="muted">Не удалось загрузить фразы: {error}</p> : phrases ? <PhraseList phrases={phrases} /> : <p class="muted">Загрузка…</p>)}
      {tab === 'settings' && <Settings value={settings} onChange={update} />}

      <nav class="tabbar">
        <button class={tab === 'phrases' ? 'on' : ''} onClick={() => setTab('phrases')}>
          Фразы
        </button>
        <button class={tab === 'settings' ? 'on' : ''} onClick={() => setTab('settings')}>
          Настройки
        </button>
      </nav>
    </main>
  );
}
