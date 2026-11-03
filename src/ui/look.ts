import type { Accent, FontPair, Settings } from '../core/types';

export const ACCENT_RU: Record<Accent, string> = { terra: 'Терракота', amber: 'Янтарь' };

export const FONT_PAIRS: Record<FontPair, { name: string; head: string; body: string; google?: string }> = {
  // B ships with the app (self-hosted, works offline); A and C load from Google Fonts on first use.
  B: { name: 'Manrope + Golos', head: "'Manrope Variable'", body: "'Golos Text Variable'" },
  A: { name: 'Onest + Inter', head: "'Onest'", body: "'Inter'", google: 'family=Onest:wght@400;600;700;800&family=Inter:wght@400;500;600;700' },
  C: { name: 'Geologica + Noto Sans', head: "'Geologica'", body: "'Noto Sans'", google: 'family=Geologica:wght@400;600;700;800&family=Noto+Sans:wght@400;500;600;700' },
};

const systemDark = () => matchMedia('(prefers-color-scheme: dark)').matches;

/** The theme actually shown: the user's choice, or the system one until they pick. */
export const effectiveTheme = (s: Settings): 'light' | 'dark' => s.theme ?? (systemDark() ? 'dark' : 'light');

/** Applies theme, accent and font pair to <html>. */
export function applyLook(s: Settings) {
  const root = document.documentElement;
  const theme = effectiveTheme(s);
  root.dataset.theme = theme;
  root.dataset.accent = s.accent;
  const f = FONT_PAIRS[s.font];
  if (f.google && !document.getElementById(`font-${s.font}`)) {
    const link = document.createElement('link');
    link.id = `font-${s.font}`;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?${f.google}&display=swap`;
    document.head.append(link);
  }
  root.style.setProperty('--font-head', `${f.head}, system-ui, sans-serif`);
  root.style.setProperty('--font-body', `${f.body}, system-ui, sans-serif`);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0c0c0d' : '#f7f7f4');
}
