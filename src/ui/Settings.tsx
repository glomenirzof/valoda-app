import { useState } from 'preact/hooks';
import type { Accent, FontPair, Settings as S } from '../core/types';
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

export function Settings({ value, onChange, onPlacement }: { value: S; onChange: (s: S) => void; onPlacement: () => void }) {
  const [picker, setPicker] = useState<Picker>(null);
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
