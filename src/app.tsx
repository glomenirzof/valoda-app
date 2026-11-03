import { useEffect, useState } from 'preact/hooks';

// Step 1 placeholder: proves install-to-home-screen and offline start work.
export function App() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    addEventListener('online', on);
    addEventListener('offline', off);
    return () => {
      removeEventListener('online', on);
      removeEventListener('offline', off);
    };
  }, []);

  return (
    <main class="screen">
      <h1>Valoda</h1>
      <p class="muted">Каркас приложения. Тренировки появятся на следующих шагах.</p>
      <p class={online ? 'badge ok' : 'badge off'}>{online ? 'онлайн' : 'офлайн — работает из кэша'}</p>
      <a class="big-btn" href="voice-test/index.html">Слепой тест голосов</a>
    </main>
  );
}
