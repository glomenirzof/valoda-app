// Shared prototype logic for the design variants (screens 2–4).
// Each variant page provides its own CSS and calls Proto.start({ variant, fonts, rating }).
(() => {
  const PHRASES = [
    {
      lv: 'Mēs ejam uz veikalu.',
      ru: 'Мы идём в магазин.',
      audio: 'audio/veikalu.mp3',
      key: 'veikalu',
      trap: ['veikals', 'veikals — это «кто? что?», а после uz нужен винительный: veikalu'],
      why: 'после uz (куда?) — винительный падеж: veikals → veikalu',
      words: [
        { s: 'Mēs', lemma: 'mēs', ru: 'мы', gram: 'местоимение', form: 'именительный · мн. ч.' },
        { s: 'ejam', lemma: 'iet', ru: 'идти', gram: 'глагол · неправильный', form: 'наст. время · 1-е лицо · мн. ч.' },
        { s: 'uz', lemma: 'uz', ru: 'на, в (куда)', gram: 'предлог', form: 'требует винительного в ед. ч.' },
        { s: 'veikalu', lemma: 'veikals', ru: 'магазин', gram: 'сущ. · м. р. · 1-е склонение', form: 'винительный · ед. ч.' },
      ],
    },
    {
      lv: 'Vakar es biju trenažieru zālē.',
      ru: 'Вчера я был в тренажёрном зале.',
      audio: 'audio/zale.mp3',
      key: 'zālē',
      trap: ['zāle', 'zāle — это «кто? что?», а на вопрос «где?» нужен местный: zālē'],
      why: 'где? — местный падеж: zāle → zālē',
      words: [
        { s: 'Vakar', lemma: 'vakar', ru: 'вчера', gram: 'наречие', form: 'не изменяется' },
        { s: 'es', lemma: 'es', ru: 'я', gram: 'местоимение', form: 'именительный · ед. ч.' },
        { s: 'biju', lemma: 'būt', ru: 'быть', gram: 'глагол · неправильный', form: 'прош. время · 1-е лицо · ед. ч.' },
        { s: 'trenažieru', lemma: 'trenažieris', ru: 'тренажёр', gram: 'сущ. · м. р. · 2-е склонение', form: 'родительный · мн. ч.' },
        { s: 'zālē', lemma: 'zāle', ru: 'зал', gram: 'сущ. · ж. р. · 5-е склонение', form: 'местный · ед. ч.' },
      ],
    },
    {
      lv: 'Es ēdu maizi.',
      ru: 'Я ем хлеб.',
      audio: 'audio/maizi.mp3',
      key: 'maizi',
      trap: ['maize', 'maize — это «кто? что?», а «что ем?» — винительный: maizi'],
      why: 'что ем? — винительный падеж: maize → maizi',
      words: [
        { s: 'Es', lemma: 'es', ru: 'я', gram: 'местоимение', form: 'именительный · ед. ч.' },
        { s: 'ēdu', lemma: 'ēst', ru: 'есть, кушать', gram: 'глагол · 1-е спряжение', form: 'наст. время · 1-е лицо · ед. ч.' },
        { s: 'maizi', lemma: 'maize', ru: 'хлеб', gram: 'сущ. · ж. р. · 5-е склонение', form: 'винительный · ед. ч.' },
      ],
    },
  ];

  const RATINGS = [
    { id: 'again', label: 'Снова', hint: '< 1 мин' },
    { id: 'hard', label: 'Трудно', hint: '6 мин' },
    { id: 'good', label: 'Хорошо', hint: '1 день' },
    { id: 'easy', label: 'Легко', hint: '4 дня' },
  ];

  // Two buttons are enough for FSRS: Again and Good.
  const RATINGS_SIMPLE = [
    { id: 'again', label: 'Не вспомнил', hint: 'повторю скоро' },
    { id: 'good', label: 'Вспомнил', hint: 'через 1 день' },
  ];

  // With hints the phrase was not recalled on its own: "Hard" at best.
  const RATINGS_HINTED = [
    { id: 'again', label: 'Не вспомнил', hint: 'повторю скоро' },
    { id: 'hard', label: 'С подсказкой', hint: 'повторю сегодня' },
  ];

  const FONT_PAIRS = {
    A: { name: 'Onest + Inter', head: "'Onest'", body: "'Inter'" },
    B: { name: 'Manrope + Golos', head: "'Manrope'", body: "'Golos Text'" },
    C: { name: 'Geologica + Noto Sans', head: "'Geologica'", body: "'Noto Sans'" },
  };

  const LETTERS = ['ā', 'ē', 'ī', 'ū', 'č', 'ģ', 'ķ', 'ļ', 'ņ', 'š', 'ž'];

  // Lucide icons (ISC), inlined so the page has no dependencies.
  const I = {
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    play: '<path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"/><path d="M16 9a5 5 0 0 1 0 6"/><path d="M19.364 18.364a9 9 0 0 0 0-12.728"/>',
    slow: '<path d="M2 13a6 6 0 1 0 12 0 4 4 0 1 0-8 0 2 2 0 0 0 4 0"/><circle cx="10" cy="13" r="8"/><path d="M2 21h12c4.4 0 8-3.6 8-8V7a2 2 0 1 0-4 0v6"/><path d="M18 3 19.1 5.2"/><path d="M22 3 20.9 5.2"/>',
    mic: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v3"/>',
    keyboard: '<path d="M10 8h.01"/><path d="M12 12h.01"/><path d="M14 8h.01"/><path d="M16 12h.01"/><path d="M18 8h.01"/><path d="M6 8h.01"/><path d="M7 16h10"/><path d="M8 12h.01"/><rect width="20" height="16" x="2" y="4" rx="2"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    alert: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
    eye: '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>',
    arrow: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
    sliders: '<path d="M10 5H3"/><path d="M12 19H3"/><path d="M14 3v4"/><path d="M16 17v4"/><path d="M21 12h-9"/><path d="M21 19h-5"/><path d="M21 5h-7"/><path d="M8 10v4"/><path d="M8 12H3"/>',
    bulb: '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    type: '<path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/>',
  };
  const icon = (n, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n]}</svg>`;

  const store = {
    get(k, d) { try { return localStorage.getItem('valoda-design-' + k) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem('valoda-design-' + k, v); } catch { /* private mode */ } },
  };

  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const norm = (s) => s.toLowerCase().replace(/[^\p{L}\s-]/gu, ' ').replace(/\s+/g, ' ').trim();
  const bare = (s) => s.normalize('NFD').replace(/\p{M}/gu, '');

  /** Compares the typed answer word by word and says where each mistake is: root, ending or only a diacritic. */
  function check(typed, target) {
    const t = norm(target).split(' ');
    const u = norm(typed).split(' ').filter(Boolean);
    const words = t.map((w, i) => {
      const got = u[i] ?? '';
      if (got === w) return { w, got, kind: 'ok', p: w.length };
      if (got && bare(got) === bare(w)) return { w, got, kind: 'mark', p: 0 };
      let p = 0;
      while (p < got.length && p < w.length && got[p] === w[p]) p++;
      const kind = got && p >= 2 && p >= w.length - 3 ? 'ending' : 'root';
      return { w, got, kind, p };
    });
    const bad = words.filter((x) => x.kind !== 'ok');
    const verdict = bad.length === 0 && u.length === t.length ? 'ok' : bad.every((x) => x.kind === 'mark') && u.length === t.length ? 'almost' : 'bad';
    return { verdict, words };
  }

  function renderDiff(words) {
    return words
      .map((x) => {
        if (x.kind === 'ok') return `<span class="d-ok">${esc(x.got)}</span>`;
        if (!x.got) return `<span class="d-miss">…</span>`;
        if (x.kind === 'mark') return `<span class="d-err d-mark">${esc(x.got)}</span>`;
        return `<span class="d-ok">${esc(x.got.slice(0, x.p))}</span><span class="d-err">${esc(x.got.slice(x.p)) || '∅'}</span>`;
      })
      .join(' ');
  }

  // Simple mode session: meet a phrase, build it from tiles, later type it and say it.
  const QUEUE = [['new', 0], ['tiles', 0], ['new', 1], ['tiles', 1], ['type', 0], ['type', 1], ['new', 2], ['tiles', 2], ['ex', 0], ['type', 2], ['ex', 1], ['ex', 2]];

  const plural = (n, one, few, many) => {
    const m10 = n % 10, m100 = n % 100;
    return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many;
  };

  const shuffle = (a) => {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };

  const KIND_RU = { root: 'ошибка в корне', ending: 'ошибка в окончании', mark: 'нет долготы или знака' };

  function start(opts) {
    const app = document.getElementById('app');
    const st = {
      i: 0,
      screen: opts.simple ? 'new' : store.get('screen', 'new'),
      q: 0,
      known: new Set(),
      hints: 0,
      weak: new Set(),
      from: 'new',
      pool: null,
      picked: [],
      tiles: null,
      mode: opts.simple ? 'speak' : store.get('mode', 'type'),
      plays: 0,
      typed: '',
      result: null,
      word: null,
      rating: 'good',
      font: store.get('font-' + opts.title, opts.fonts),
      // First visit follows the system; after that the toggle is just light / dark.
      theme: ['light', 'dark'].includes(store.get('theme')) ? store.get('theme') : matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
      reviewOpen: false,
      accent: opts.accents ? store.get('accent', opts.accents[0][0]) : null,
    };
    let audio = null;

    const play = (rate) => {
      if (audio) audio.pause();
      audio = new Audio(PHRASES[st.i].audio);
      audio.playbackRate = rate;
      audio.play().catch(() => {});
    };

    const applyLook = () => {
      if (st.accent) document.documentElement.dataset.accent = st.accent;
      const f = FONT_PAIRS[st.font];
      document.documentElement.style.setProperty('--font-head', `${f.head}, system-ui, sans-serif`);
      document.documentElement.style.setProperty('--font-body', `${f.body}, system-ui, sans-serif`);
      document.documentElement.setAttribute('data-theme', st.theme);
    };

    const tappable = (p) => {
      let k = 0;
      return p.lv
        .split(/(\p{L}+)/u)
        .map((part, j) => {
          if (j % 2 === 0) return esc(part);
          const idx = k++;
          return `<button class="w" data-word="${idx}">${esc(part)}</button>`;
        })
        .join('');
    };

    const highlightKey = (p) => esc(p.lv).replace(p.key, `<b class="key">${p.key}</b>`);

    const reviewBar = () => `
      <button class="review-fab ${st.reviewOpen ? 'on' : ''}" data-review aria-label="Настройки просмотра">${icon('sliders')}</button>
      ${st.reviewOpen ? `<nav class="review" aria-label="Переключатели для просмотра">
        <span class="review-v">${opts.title}</span>
        <div class="review-seg">
          ${(opts.simple ? [['new', 'Новая'], ['tiles', 'Плитки'], ['type', 'Пишу'], ['ex', 'Скажи'], ['fb', 'Отклик']] : [['new', 'Новая'], ['ex', 'Упражнение'], ['fb', 'Отклик']]).map(([id, l]) => `<button data-go="${id}" class="${st.screen === id ? 'on' : ''}">${l}</button>`).join('')}
        </div>
        <button data-font class="review-chip">${icon('type')}${st.font}</button>
        <button data-theme class="review-chip">${icon(st.theme === 'dark' ? 'moon' : 'sun')}${st.theme === 'dark' ? 'тёмная' : 'светлая'}</button>
        ${opts.accents ? `<button data-accent class="review-chip"><i class="dot"></i>${opts.accents.find((a) => a[0] === st.accent)[1]}</button>` : ''}
      </nav>` : ''}`;

    const topBar = (step) => opts.simple ? `
      <header class="top">
        <button class="icon-btn" aria-label="Закрыть">${icon('x')}</button>
        <div class="progress"><i style="width:${Math.round(((st.q + 1) / QUEUE.length) * 100)}%"></i></div>
        <span class="count">${st.q + 1}/${QUEUE.length}</span><span class="fab-gap"></span>
      </header>` : `
      <header class="top">
        <button class="icon-btn" aria-label="Закрыть">${icon('x')}</button>
        <div class="progress"><i style="width:${step}%"></i></div>
        <span class="count">${st.i + 1}/12</span><span class="fab-gap"></span>
      </header>`;

    // Simple mode: one sound button; every second tap plays slower.
    const slowNext = () => st.plays % 2 === 1;
    const oneAudio = (cls) => `<button class="${cls}" data-play-toggle aria-label="Слушать">${icon(slowNext() ? 'slow' : 'play')}<span>${slowNext() ? 'Ещё раз медленно' : 'Слушать'}</span></button>`;

    const audioBtns = () => opts.simple ? `<div class="audio one">${oneAudio('a-play')}</div>` : `
      <div class="audio">
        <button class="a-play" data-play="1" aria-label="Слушать">${icon('play')}<span>Слушать</span></button>
        <button class="a-slow" data-play="0.75" aria-label="Медленно">${icon('slow')}<span>Медленно</span></button>
      </div>`;

    const screenNew = (p) => `
      ${topBar(18 + st.i * 25)}
      <main class="scr scr-new">
        <p class="eyebrow">Новая фраза</p>
        <div class="phrase-card">
          ${audioBtns()}
          <h1 class="lv">${tappable(p)}</h1>
          <p class="ru">${esc(p.ru)}</p>
        </div>
        <p class="hint">Нажми на слово — покажу разбор</p>
      </main>
      ${opts.simple ? `<footer class="actions">
        <button class="btn primary" data-advance>Дальше ${icon('arrow')}</button>
        <button class="link" data-next>Уже знаю эту фразу</button>
      </footer>` : `<footer class="actions two">
        <button class="btn ghost" data-next>Уже знаю</button>
        <button class="btn primary" data-to="ex">Дальше ${icon('arrow')}</button>
      </footer>`}`;

    const initTiles = (p) => {
      st.pool = shuffle([...p.words.map((w) => w.s), p.trap[0]].map((t, id) => ({ t, id })));
      st.picked = [];
      st.tiles = null;
    };

    const screenTiles = (p) => {
      const byId = (id) => st.pool.find((x) => x.id === id);
      const res = st.tiles;
      const usedTrap = st.picked.some((id) => byId(id).t === p.trap[0]);
      return `
      ${topBar()}
      <main class="scr scr-tiles">
        <p class="eyebrow">Собери фразу</p>
        <h1 class="ru-big">${esc(p.ru)}</h1>
        <div class="build ${res ? 'b-' + res : ''}">
          ${st.picked.length ? st.picked.map((id) => `<button class="tile" data-unpick="${id}" ${res ? 'disabled' : ''}>${esc(byId(id).t)}</button>`).join('') : '<span class="build-ph">Нажимай на слова ниже</span>'}
        </div>
        ${res === 'ok' ? `<p class="tile-msg ok">${icon('check')}Верно</p>` : ''}
        ${res === 'bad' ? `<div class="tile-msg bad"><p>Правильно: <b>${highlightKey(p)}</b></p><p>${esc(usedTrap ? p.trap[1] : 'Проверь порядок слов.')}</p></div>` : ''}
        <div class="pool">
          ${st.pool.map((x) => `<button class="tile ${st.picked.includes(x.id) ? 'used' : ''}" data-pick="${x.id}" ${st.picked.includes(x.id) || res ? 'disabled' : ''}>${esc(x.t)}</button>`).join('')}
        </div>
        <p class="hint">Одно слово лишнее — с неправильным окончанием</p>
      </main>
      <footer class="actions">
        ${res ? `<button class="btn primary" data-advance>Дальше ${icon('arrow')}</button>` : `<button class="btn primary" data-check-tiles ${st.picked.length ? '' : 'disabled'}>Проверить</button>`}
      </footer>`;
    };

    // Letter hints: each tap opens the next letter; words with opened letters count as weak.
    const letterCount = (p) => (p.lv.match(/\p{L}/gu) || []).length;
    const mask = (p) => {
      let k = 0;
      return p.lv.split(/(\p{L}+)/u).map((part, j) => {
        if (j % 2 === 0) return esc(part);
        return `<span class="mw">${[...part].map((ch) => (k++ < st.hints ? `<b>${esc(ch)}</b>` : '<i></i>')).join('')}</span>`;
      }).join('');
    };
    const weakWords = (p) => {
      if (st.weak.size) return [...st.weak].sort((a, b) => a - b).map((k) => p.words[k].s);
      let k = 0;
      return p.words.filter((w) => { const start = k; k += [...w.s].length; return start < st.hints; }).map((w) => w.s);
    };

    const screenSay = (p) => `
      ${topBar()}
      <main class="scr scr-ex">
        <p class="eyebrow">Скажи по-латышски</p>
        <h1 class="ru-big">${esc(p.ru)}</h1>
        ${st.hints ? `<p class="mask">${mask(p)}</p>` : ''}
        <div class="speak-box">
          <div class="mic-ring">${icon('mic')}</div>
          <p>Скажи фразу вслух.<br>Не помнишь — открой букву.</p>
        </div>
      </main>
      <footer class="actions two">
        <button class="btn ghost" data-hint ${st.hints >= letterCount(p) ? 'disabled' : ''}>${icon('bulb')}Буква${st.hints ? ` · ${st.hints}` : ''}</button>
        <button class="btn primary" data-show>${icon('eye')}Показать</button>
      </footer>`;

    const hintLabel = () => `${icon('bulb')}Буква${st.hints ? ` · ${st.hints}` : ''}`;

    const screenType = (p) => `
      ${topBar()}
      <main class="scr scr-ex scr-type">
        <p class="eyebrow">Напиши по-латышски</p>
        <h1 class="ru-big">${esc(p.ru)}</h1>
        <div class="type-box">
          <textarea id="ans" rows="2" placeholder="Пиши здесь…" autocapitalize="sentences" autocomplete="off" autocorrect="off" spellcheck="false" lang="lv">${esc(st.typed)}</textarea>
          <div class="letters">${LETTERS.map((l) => `<button data-letter="${l}">${l}</button>`).join('')}</div>
        </div>
      </main>
      <footer class="actions two">
        <button class="btn ghost" data-hint>${hintLabel()}</button>
        <button class="btn primary" data-show>${icon('check')}Проверить</button>
      </footer>`;

    const screenEx = (p) => opts.simple ? screenSay(p) : `
      ${topBar(30 + st.i * 25)}
      <main class="scr scr-ex">
        <p class="eyebrow">Скажи по-латышски</p>
        <h1 class="ru-big">${esc(p.ru)}</h1>
        ${opts.simple ? '' : `<div class="seg" role="tablist">
          <button role="tab" data-mode="speak" class="${st.mode === 'speak' ? 'on' : ''}">${icon('mic')}Говорю</button>
          <button role="tab" data-mode="type" class="${st.mode === 'type' ? 'on' : ''}">${icon('keyboard')}Пишу</button>
        </div>`}
        ${
          st.mode === 'type'
            ? `<div class="type-box">
                <textarea id="ans" rows="2" placeholder="Напиши фразу…" autocapitalize="sentences" autocomplete="off" autocorrect="off" spellcheck="false" lang="lv">${esc(st.typed)}</textarea>
                <div class="letters">${LETTERS.map((l) => `<button data-letter="${l}">${l}</button>`).join('')}</div>
              </div>`
            : `<div class="speak-box">
                <div class="mic-ring">${icon('mic')}</div>
                <p>Скажи фразу вслух,<br>потом открой ответ</p>
              </div>`
        }
      </main>
      <footer class="actions">
        <button class="btn primary" data-show>${icon('eye')}Показать</button>
      </footer>`;

    const sheet = (p) => {
      const r = st.result;
      const v = st.mode === 'speak' || !r ? 'self' : r.verdict;
      const head = {
        ok: [icon('check'), 'Верно'],
        almost: [icon('alert'), 'Почти — проверь знаки'],
        bad: [icon('alert'), 'Не совсем'],
        self: [icon('eye'), 'Сравни с образцом'],
      }[v];
      const errs = r && st.mode === 'type' ? [...new Set(r.words.filter((x) => x.kind !== 'ok' && x.got).map((x) => KIND_RU[x.kind]))] : [];
      const list = !opts.simple ? RATINGS
        : st.hints ? RATINGS_HINTED
        : st.rating === 'hard' ? [RATINGS_SIMPLE[0], { id: 'hard', label: 'Почти', hint: 'повторю сегодня' }]
        : RATINGS_SIMPLE;
      const rateButtons = list.map(
        (x) => `<button class="rate rate-${x.id} ${st.rating === x.id && (opts.rating === 'next' || (opts.suggest && r) || (opts.simple && (st.hints || r))) ? 'on' : ''}" data-rate="${x.id}"><b>${x.label}</b><small>${x.hint}</small></button>`,
      ).join('');
      return `
        <div class="scrim"></div>
        <section class="sheet v-${v}" role="dialog" aria-label="Ответ">
          <div class="grab"></div>
          <p class="verdict">${head[0]}<span>${head[1]}</span></p>
          <div class="right">
            ${opts.simple ? oneAudio('a-mini') : `<button class="a-mini" data-play="1" aria-label="Слушать">${icon('play')}</button>
            <button class="a-mini" data-play="0.75" aria-label="Медленно">${icon('slow')}</button>`}
            <p class="right-lv">${highlightKey(p)}</p>
          </div>
          ${r && st.mode === 'type' && v !== 'ok' ? `<p class="yours"><span class="lbl">Ты:</span> ${renderDiff(r.words)}${errs.length ? `<span class="tags">${errs.map((e) => `<i>${e}</i>`).join('')}</span>` : ''}</p>` : ''}
          <p class="why"><b>${p.key}</b> — ${esc(p.why)}</p>
          ${opts.simple && st.hints ? `<p class="hint-note">${icon('bulb')}<span>Ты открыл ${st.hints} ${plural(st.hints, 'букву', 'буквы', 'букв')}. Эти слова вернутся раньше: <b>${weakWords(p).map(esc).join(', ')}</b></span></p>` : ''}
          ${
            opts.rating === 'next'
              ? `<p class="rate-lbl">Оценка — можно поменять</p><div class="rates row">${rateButtons}</div>
                 <button class="btn primary wide" data-rated>Дальше ${icon('arrow')}</button>`
              : `<div class="rates ${opts.simple ? 'two' : opts.rating}">${rateButtons}</div>`
          }
        </section>`;
    };

    const wordSheet = (p) => {
      const w = p.words[st.word];
      return `
        <div class="scrim" data-close-word></div>
        <section class="sheet word-sheet" role="dialog" aria-label="Разбор слова">
          <div class="grab"></div>
          <p class="ws-form">${esc(w.s)}</p>
          <p class="ws-ru">${esc(w.ru)}</p>
          <dl>
            <div><dt>Начальная форма</dt><dd>${esc(w.lemma)}</dd></div>
            <div><dt>Часть речи</dt><dd>${esc(w.gram)}</dd></div>
            <div><dt>Эта форма</dt><dd>${esc(w.form)}</dd></div>
          </dl>
          <button class="btn ghost wide" data-close-word>Понятно</button>
        </section>`;
    };

    function render() {
      applyLook();
      const p = PHRASES[st.i];
      const shown = st.screen === 'fb' ? st.from : st.screen;
      const base = shown === 'new' ? screenNew(p) : shown === 'tiles' ? screenTiles(p) : shown === 'type' ? screenType(p) : screenEx(p);
      app.innerHTML =
        reviewBar() +
        `<div class="stage">${base}${st.screen === 'fb' ? sheet(p) : ''}${st.word !== null ? wordSheet(p) : ''}</div>`;
      const ta = app.querySelector('#ans');
      if (ta) ta.addEventListener('input', () => (st.typed = ta.value));
    }

    const go = (screen) => {
      if (screen !== 'fb') st.from = screen;
      if (opts.simple) st.mode = st.from === 'type' ? 'type' : 'speak';
      st.screen = screen;
      if (screen === 'tiles' && !st.pool) initTiles(PHRASES[st.i]);
      store.set('screen', screen === 'fb' ? 'ex' : screen);
      if (screen === 'fb' && !st.result && st.mode === 'type') st.result = check(st.typed, PHRASES[st.i].lv);
      render();
      if (screen === 'type') app.querySelector('#ans')?.focus();
    };

    const reset = () => {
      st.typed = '';
      st.result = null;
      st.rating = 'good';
      st.plays = 0;
      st.hints = 0;
      st.weak = new Set();
      st.pool = null;
    };

    const nextInQueue = () => {
      for (let n = 0; n < QUEUE.length; n++) {
        st.q = (st.q + 1) % QUEUE.length;
        if (st.q === 0) st.known.clear();
        if (!st.known.has(QUEUE[st.q][1])) break;
      }
      reset();
      st.i = QUEUE[st.q][1];
      go(QUEUE[st.q][0]);
    };

    const next = () => {
      if (opts.simple) return nextInQueue();
      st.i = (st.i + 1) % PHRASES.length;
      st.typed = '';
      st.result = null;
      st.rating = 'good';
      st.plays = 0;
      go('new');
    };

    app.addEventListener('click', (e) => {
      const b = e.target.closest('button, .scrim');
      if (!b) return;
      const d = b.dataset;
      if ('review' in d) { st.reviewOpen = !st.reviewOpen; render(); }
      else if (d.go) { st.result = null; st.reviewOpen = false; go(d.go); }
      else if ('font' in d) { st.font = { A: 'B', B: 'C', C: 'A' }[st.font]; store.set('font-' + opts.title, st.font); render(); }
      else if ('accent' in d) { const k = opts.accents.findIndex((a) => a[0] === st.accent); st.accent = opts.accents[(k + 1) % opts.accents.length][0]; store.set('accent', st.accent); render(); }
      else if ('theme' in d) { st.theme = st.theme === 'dark' ? 'light' : 'dark'; store.set('theme', st.theme); render(); }
      else if (d.play) play(Number(d.play));
      else if ('playToggle' in d) {
        play(slowNext() ? 0.75 : 1);
        st.plays++;
        app.querySelectorAll('[data-play-toggle]').forEach((el) => { el.outerHTML = oneAudio(el.className); });
      }
      else if (d.word !== undefined) { st.word = Number(d.word); render(); }
      else if ('closeWord' in d) { st.word = null; render(); }
      else if (d.to) go(d.to);
      else if ('next' in d) { if (opts.simple && st.screen === 'new') st.known.add(st.i); next(); }
      else if ('advance' in d) next();
      else if (d.pick !== undefined) { st.picked.push(Number(d.pick)); render(); }
      else if (d.unpick !== undefined) { st.picked = st.picked.filter((id) => id !== Number(d.unpick)); render(); }
      else if ('checkTiles' in d) {
        const got = st.picked.map((id) => st.pool.find((x) => x.id === id).t).join(' ');
        st.tiles = got === PHRASES[st.i].words.map((w) => w.s).join(' ') ? 'ok' : 'bad';
        play(1);
        render();
      }
      else if ('hint' in d && st.screen === 'type') {
        // Keep the correct beginning, then write the next correct letter (spaces and punctuation come for free).
        const t = PHRASES[st.i].lv;
        const ta = app.querySelector('#ans');
        const typed = ta.value;
        let i = 0;
        while (i < typed.length && i < t.length && typed[i].toLowerCase() === t[i].toLowerCase()) i++;
        let j = i;
        while (j < t.length && !/\p{L}/u.test(t[j])) j++;
        if (j < t.length) {
          st.weak.add((t.slice(0, j + 1).match(/\p{L}+/gu) || []).length - 1);
          st.hints++;
          j++;
        }
        ta.value = t.slice(0, j);
        st.typed = ta.value;
        ta.focus();
        ta.setSelectionRange(j, j);
        b.innerHTML = hintLabel();
      }
      else if ('hint' in d) { st.hints = Math.min(st.hints + 1, letterCount(PHRASES[st.i])); render(); }
      else if (d.mode) { st.mode = d.mode; store.set('mode', d.mode); render(); }
      else if (d.letter) {
        const ta = app.querySelector('#ans');
        const s = ta.selectionStart ?? ta.value.length;
        ta.value = ta.value.slice(0, s) + d.letter + ta.value.slice(ta.selectionEnd ?? s);
        st.typed = ta.value;
        ta.focus();
        ta.setSelectionRange(s + 1, s + 1);
      } else if ('show' in d) {
        st.result = st.mode === 'type' ? check(st.typed, PHRASES[st.i].lv) : null;
        st.rating = !st.result ? 'good' : { ok: 'good', almost: 'hard', bad: 'again' }[st.result.verdict];
        // More than a third of the letters opened means the phrase was not really recalled.
        if (opts.simple && st.hints) {
          const byHints = st.hints / letterCount(PHRASES[st.i]) > 1 / 3 ? 'again' : 'hard';
          const order = ['again', 'hard', 'good'];
          st.rating = order[Math.min(order.indexOf(st.rating), order.indexOf(byHints))];
        }
        st.plays = 0;
        go('fb');
        play(1);
        st.plays = 1;
        app.querySelectorAll('[data-play-toggle]').forEach((el) => { el.outerHTML = oneAudio(el.className); });
      } else if (d.rate) {
        if (opts.rating === 'next') { st.rating = d.rate; render(); }
        else next();
      } else if ('rated' in d) next();
    });

    // Keep focus on the textarea when a letter button is pressed (iOS would otherwise close the keyboard).
    app.addEventListener('pointerdown', (e) => { if (e.target.closest('[data-letter]')) e.preventDefault(); });

    render();
  }

  window.Proto = { start, FONT_PAIRS };
})();
