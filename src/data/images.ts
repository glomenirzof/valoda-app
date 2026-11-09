import type { Lang } from '../core/types';

/** public/data/<lang>/images.json, built by scripts/content/build_images.py */
export interface ImageCredit {
  file: string;
  /** Commons file title */
  title: string;
  /** Commons file page */
  source: string;
  author: string;
  license: string;
  licenseUrl: string;
}
export interface ImagesData {
  images: Record<string, ImageCredit>;
  /** phrase id → its picture; `cue` — the picture says everything the phrase says, so it may replace the Russian */
  phrases: Record<string, { image: string; lemma: string; cue?: boolean }>;
}

let data: ImagesData | null = null;
let lang: Lang = 'lv';

export async function loadImages(l: Lang): Promise<ImagesData | null> {
  lang = l;
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}data/${l}/images.json`);
    data = r.ok ? ((await r.json()) as ImagesData) : null;
  } catch {
    data = null;
  }
  return data;
}

export const imageUrl = (file: string) => `${import.meta.env.BASE_URL}images/${lang}/${file}`;

/** The picture of a phrase, if it has one. */
export function imageFor(id: string): { url: string; lemma: string; cue: boolean } | null {
  const p = data?.phrases[id];
  const img = p && data!.images[p.image];
  return img ? { url: imageUrl(img.file), lemma: p.lemma, cue: !!p.cue } : null;
}
