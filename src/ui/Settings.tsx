import { useState } from 'preact/hooks';
import type { Accent, FontPair, Settings as S } from '../core/types';
import { imageUrl, type ImagesData } from '../data/images';
import { Icon, type IconName } from './icons';
import { ACCENT_RU, effectiveTheme, FONT_PAIRS } from './look';

type Picker = 'newPerDay' | 'accent' | 'font' | null;

function Row({ icon, title, hint, value, onClick, children }: {
  icon: IconName; title: string; hint?: string; value?: preact.ComponentChildren; onClick?: () => void; children?: preact.ComponentChildren;
}) {
  const body = (
    <>
      <Icon name={icon} />
      <span class="row-text">
        <b>{title}</b>
        {hint && <small>{hint}</small>}
      </span>
      {value !== undefined && <span class="row-value">{value}</span>}
      {children}
      {onClick && <Icon name="chevron" class="chev" />}
    </>
  );
  return onClick ? (
    <button class="row" onClick={onClick}>
      {body}
    </button>
  ) : (
    <div class="row">{body}</div>
  );
}

export function Settings({ value, onChange, onPlacement, images }: { value: S; onChange: (s: S) => void; onPlacement: () => void; images: ImagesData | null }) {
  const [picker, setPicker] = useState<Picker>(null);
  const [credits, setCredits] = useState(false);
  const set = (patch: Partial<S>) => onChange({ ...value, ...patch });
  const theme = effectiveTheme(value);

  const options: Record<Exclude<Picker, null>, { title: string; items: [string, string, string?][]; current: string; pick: (v: string) => void }> = {
    newPerDay: {
      title: 'Новых фраз в день',
      items: [8, 9, 10, 11, 12].map((n) => [String(n), `${n} фраз`, n === 10 ? 'рекомендую' : undefined]),
      current: String(value.newPerDay),
      pick: (v) => set({ newPerDay: Number(v) }),
    },
    accent: {
      title: 'Цвет',
      items: (Object.keys(ACCENT_RU) as Accent[]).map((a) => [a, ACCENT_RU[a]]),
      current: value.accent,
      pick: (v) => set({ accent: v as Accent }),
    },
    font: {
      title: 'Шрифт',
      items: (['B', 'A', 'C'] as FontPair[]).map((f) => [f, FONT_PAIRS[f].name, f === 'B' ? 'работает офлайн' : 'нужен интернет при первом выборе']),
      current: value.font,
      pick: (v) => set({ font: v as FontPair }),
    },
  };
  const open = picker ? options[picker] : null;

  if (credits && images) {
    const used = new Set(Object.values(images.phrases).map((x) => x.image));
    const list = Object.entries(images.images).filter(([k]) => used.has(k));
    const lemmas = (k: string) => [...new Set(Object.values(images.phrases).filter((x) => x.image === k).map((x) => x.lemma))].join(', ');
    return (
      <>
        <button class="s-link back" onClick={() => setCredits(false)}>
          ← Настройки
        </button>
        <h1 class="title">Авторы изображений</h1>
        <p class="subtitle">Картинки к фразам — с Wikimedia Commons, под открытыми лицензиями. Значки — набор Twemoji (Twitter, CC BY 4.0) и Noto Emoji (Google, Apache 2.0)</p>
        <div class="rows credits">
          {list.map(([k, c]) => (
            <div key={k} class="row credit-row">
              <img src={imageUrl(c.file)} alt="" width={40} height={40} loading="lazy" />
              <span class="row-text">
                <b>{lemmas(k)}</b>
                <small>
                  {c.author} ·{' '}
                  <a href={c.licenseUrl || c.source} target="_blank" rel="noopener">
                    {c.license}
                  </a>{' '}
                  ·{' '}
                  <a href={c.source} target="_blank" rel="noopener">
                    {c.title.replace(/^File:/, '')}
                  </a>
                </small>
              </span>
            </div>
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      <h1 class="title">Настройки</h1>

      <h2 class="section-title">Обучение</h2>
      <div class="rows">
        <Row icon="plus" title="Новых фраз в день" hint="При большом долге повторений новые встают на паузу сами" value={value.newPerDay} onClick={() => setPicker('newPerDay')} />
        <Row icon="shield" title="Какие фразы учим" hint="Проверенные автоматически (корпус и два переводчика) или репетитором" />
        <Row
          icon="progress"
          title="Тест уровня"
          hint={
            value.placement
              ? `${value.placement.level} · ≈${value.placement.vocab} слов · ${new Date(value.placement.ts).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}. Пройти заново — прогресс не сотрётся`
              : 'Определю уровень, и знакомые фразы сразу пойдут в повторения'
          }
          onClick={onPlacement}
        />
      </div>

      <h2 class="section-title">Звук</h2>
      <div class="rows">
        <Row icon={value.sound ? 'play' : 'mute'} title="Звук" hint={value.sound ? 'Фразы звучат сами, когда виден латышский текст' : 'Без звука: «узнай на слух» станет «узнай по тексту»'}>
          <div class="seg" role="radiogroup" aria-label="Звук">
            <button class={value.sound ? 'on' : ''} role="radio" aria-checked={value.sound} onClick={() => set({ sound: true })}>
              Вкл
            </button>
            <button class={!value.sound ? 'on' : ''} role="radio" aria-checked={!value.sound} onClick={() => set({ sound: false })}>
              Выкл
            </button>
          </div>
        </Row>
      </div>

      <h2 class="section-title">Картинки</h2>
      <div class="rows">
        <Row
          icon="eye"
          title="Картинка вместо перевода"
          hint="Для простых конкретных фраз (Policija!, Tēju, lūdzu.) при вводе и «скажи» показываю картинку вместо русского; перевод — по нажатию"
        >
          <div class="seg" role="radiogroup" aria-label="Картинка вместо перевода">
            <button class={value.pictureCue ? 'on' : ''} role="radio" aria-checked={!!value.pictureCue} onClick={() => set({ pictureCue: true })}>
              Вкл
            </button>
            <button class={!value.pictureCue ? 'on' : ''} role="radio" aria-checked={!value.pictureCue} onClick={() => set({ pictureCue: false })}>
              Выкл
            </button>
          </div>
        </Row>
      </div>

      <h2 class="section-title">Вид</h2>
      <div class="rows">
        <Row icon={theme === 'dark' ? 'moon' : 'sun'} title="Тема">
          <div class="seg" role="radiogroup" aria-label="Тема">
            <button class={theme === 'light' ? 'on' : ''} role="radio" aria-checked={theme === 'light'} onClick={() => set({ theme: 'light' })}>
              <Icon name="sun" />
              Светлая
            </button>
            <button class={theme === 'dark' ? 'on' : ''} role="radio" aria-checked={theme === 'dark'} onClick={() => set({ theme: 'dark' })}>
              <Icon name="moon" />
              Тёмная
            </button>
          </div>
        </Row>
        <Row icon="palette" title="Цвет" value={<><i class="dot" />{ACCENT_RU[value.accent]}</>} onClick={() => setPicker('accent')} />
        <Row icon="type" title="Шрифт" value={FONT_PAIRS[value.font].name} onClick={() => setPicker('font')} />
      </div>

      <h2 class="section-title">О приложении</h2>
      <div class="rows">
        <Row icon="info" title="Словарь форм" hint="Tēzaurs.lv 2026, CLARIN-LV, лицензия CC BY-SA 4.0" />
        <Row icon="play" title="Голос" hint="Azure, Everita (латышский)" />
        {images && <Row icon="palette" title="Авторы изображений" hint="Источники, авторы и лицензии картинок" onClick={() => setCredits(true)} />}
      </div>
      <p class="foot">Всё хранится на этом телефоне и работает без интернета</p>

      {open && (
        <>
          <div class="scrim" onClick={() => setPicker(null)} />
          <section class="sheet" role="dialog" aria-label={open.title}>
            <div class="grab" />
            <h3>{open.title}</h3>
            <div class="options">
              {open.items.map(([v, label, note]) => (
                <button
                  key={v}
                  class={`option ${open.current === v ? 'on' : ''}`}
                  onClick={() => {
                    open.pick(v);
                    setPicker(null);
                  }}
                >
                  <span>
                    {label} {note && <small>· {note}</small>}
                  </span>
                  {open.current === v && <Icon name="check" />}
                </button>
              ))}
            </div>
          </section>
        </>
      )}
    </>
  );
}
