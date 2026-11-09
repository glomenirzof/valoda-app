"""Pictures for phrases (dual coding): only concrete things and actions.

    python -I scripts/content/build_images.py lv

Reads   content/<lang>/images.src.json — word → picture (a Twemoji emoji, or a Wikimedia Commons file),
        public/data/<lang>/phrases.json, public/data/<lang>/placement.json (word frequency ranks)
Writes  public/images/<lang>/<name>.webp — at most 50 KB each, precached for offline use
        public/data/<lang>/images.json — per picture: source page, author, licence; per phrase: which picture
        content/<lang>/images-report.txt — every phrase with its picture, and the doubtful ones to look at

Every file comes from Wikimedia Commons with its licence read from the file page (extmetadata); only open
licences are accepted (CC0, public domain, CC BY, CC BY-SA). Downloads are cached in data-cache/images/.
"""
import hashlib
import io
import json
import re
import sys
import time
import urllib.parse
import subprocess
from pathlib import Path

from PIL import Image

API = "https://commons.wikimedia.org/w/api.php"
UA = "valoda-app/0.1 (language learning PWA; content build script)"
CACHE = Path("data-cache/images")
MAX_BYTES = 50_000
OPEN = re.compile(r"^(CC0|Public domain|PD|CC BY(-SA)? \d\.\d|Apache License)", re.I)
# words that do not change what a phrase means beyond its pictured word
FRAME = {"būt", "es", "mans", "tas", "šis", "lūdzu", "paldies", "jā", "nē"}


def get(url: str) -> bytes:
    """Download through curl: it uses the system certificate store (Python's own bundle here is out of date)."""
    CACHE.mkdir(parents=True, exist_ok=True)
    f = CACHE / hashlib.sha1(url.encode()).hexdigest()
    if f.exists():
        return f.read_bytes()
    for attempt in range(4):
        r = subprocess.run(["curl", "-sSfL", "--max-time", "60", "-A", UA, url], capture_output=True)
        if r.returncode == 0 and r.stdout:
            f.write_bytes(r.stdout)
            time.sleep(0.3)  # be gentle with Commons
            return r.stdout
        time.sleep(2 * (attempt + 1))
    raise RuntimeError(f"download failed: {url}: {r.stderr.decode(errors='replace')[:200]}")


def file_info(titles: list[str], width: int) -> dict[str, dict]:
    """imageinfo (thumbnail at `width`, licence, author) for Commons file titles; missing titles are absent."""
    out = {}
    for i in range(0, len(titles), 40):
        q = urllib.parse.urlencode({
            "action": "query", "format": "json", "titles": "|".join(titles[i:i + 40]),
            "prop": "imageinfo", "iiprop": "url|extmetadata", "iiurlwidth": width,
        })
        data = json.loads(get(f"{API}?{q}"))
        norm = {n["to"]: n["from"] for n in data["query"].get("normalized", [])}
        for p in data["query"]["pages"].values():
            if "imageinfo" not in p:
                continue
            ii = p["imageinfo"][0]
            m = ii.get("extmetadata", {})
            strip = lambda k: re.sub(r"<[^>]+>", "", m.get(k, {}).get("value", "")).strip()
            out[norm.get(p["title"], p["title"])] = {
                "title": p["title"],
                "thumb": ii["thumburl"],
                "source": ii["descriptionurl"],
                "author": strip("Artist") or strip("Credit") or "unknown",
                "license": strip("LicenseShortName"),
                "licenseUrl": strip("LicenseUrl"),
            }
    return out


def emoji_hex(e: str) -> str:
    return "-".join(f"{ord(c):x}" for c in e if ord(c) != 0xFE0F)


def to_webp(raw: bytes, photo: bool) -> bytes:
    img = Image.open(io.BytesIO(raw))
    img = img.convert("RGBA" if not photo else "RGB")
    side = 320 if photo else 192
    img.thumbnail((side, side))
    for q in (80, 70, 60, 50, 40):
        buf = io.BytesIO()
        img.save(buf, "WEBP", quality=q, method=6)
        if buf.tell() <= MAX_BYTES:
            return buf.getvalue()
    raise RuntimeError("cannot fit 50 KB")


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    lang = sys.argv[1] if len(sys.argv) > 1 else "lv"
    src = json.loads(Path(f"content/{lang}/images.src.json").read_text(encoding="utf-8"))
    phrases = json.loads(Path(f"public/data/{lang}/phrases.json").read_text(encoding="utf-8"))["phrases"]
    rank = json.loads(Path(f"public/data/{lang}/placement.json").read_text(encoding="utf-8"))["lemmaRank"]
    out_dir = Path(f"public/images/{lang}")
    out_dir.mkdir(parents=True, exist_ok=True)

    # 1. pictures: one per distinct emoji / Commons file
    wanted: dict[str, tuple[str, list[str]]] = {}  # key → (kind, candidate titles)
    lemma_key: dict[str, str] = {}
    for lemma, spec in src["lemmas"].items():
        if "emoji" in spec:
            h = emoji_hex(spec["emoji"])
            key = f"tw-{h}"
            wanted[key] = ("emoji", [f"File:Twemoji12_{h}.svg", f"File:Twemoji_{h}.svg", f"File:Twemoji2_{h}.svg"])
        else:
            key = "cm-" + hashlib.sha1(spec["commons"].encode()).hexdigest()[:10]
            # an SVG from Commons is a drawn icon (transparent, small); anything else is a photo
            wanted[key] = ("emoji" if spec["commons"].lower().endswith(".svg") else "photo", [spec["commons"]])
        lemma_key[lemma] = key

    problems = []
    images = {}
    emoji_info = file_info([t for k, (kind, ts) in wanted.items() if kind == "emoji" for t in ts], 256)
    photo_info = file_info([t for k, (kind, ts) in wanted.items() if kind == "photo" for t in ts], 640)
    for key, (kind, titles) in wanted.items():
        info = next((emoji_info.get(t) or photo_info.get(t) for t in titles if (emoji_info.get(t) or photo_info.get(t))), None)
        if not info:
            problems.append(f"{key}: нет файла на Commons ({titles[0]})")
            continue
        if not OPEN.match(info["license"]):
            problems.append(f"{key}: лицензия «{info['license']}» не открытая — пропуск")
            continue
        webp = to_webp(get(info["thumb"]), kind == "photo")
        (out_dir / f"{key}.webp").write_bytes(webp)
        images[key] = {k: info[k] for k in ("title", "source", "author", "license", "licenseUrl")} | {"file": f"{key}.webp", "bytes": len(webp)}

    # 2. phrases: the most specific pictured word (nouns before actions, then the rarer word)
    skip = set(src.get("skipText", []))
    by_phrase, report, doubtful = {}, [], []
    for p in sorted((p for p in phrases if p.get("order")), key=lambda p: p["order"]):
        if p["text"] in skip:
            continue
        cands = [t for t in p["tokens"] if t["lemma"] in lemma_key and lemma_key[t["lemma"]] in images]
        override = src.get("phraseOverride", {})
        if p["text"] in override:
            if override[p["text"]] is None:
                continue
            cands = [t for t in cands if t["lemma"] == override[p["text"]]]
        if not cands:
            continue
        best = sorted(cands, key=lambda t: (t["pos"] != "NOUN", -(rank.get(t["lemma"].lower()) or 0)))[0]
        key = lemma_key[best["lemma"]]
        # the picture can stand in for the Russian only when the phrase says nothing beyond the pictured word
        others = {t["lemma"].lower() for t in p["tokens"]} - {best["lemma"].lower()} - FRAME
        # «Man nav naudas» with a picture of money would say the opposite: negated phrases keep the Russian
        negated = any("NEG" in t["feats"].split(".") for t in p["tokens"])
        cue = not others and not negated
        by_phrase[p["id"]] = {"image": key, "lemma": best["lemma"], **({"cue": True} if cue else {})}
        line = f"№{p['order']:>3} {p['text']} — {p['ru']}  →  {best['lemma']} ({key}){'  [вместо перевода]' if cue else ''}"
        report.append(line)
        # a pictured verb, or a noun that is not the subject of the phrase, may be off: list for a human look
        if best["pos"] != "NOUN" or len(cands) > 1 and len({lemma_key[t['lemma']] for t in cands}) > 1:
            doubtful.append(line + ("  — картинка к глаголу" if best["pos"] != "NOUN" else "  — во фразе несколько слов с картинками"))

    # only pictures some phrase uses are kept: in the data, on disk and on the credits page
    used = {v["image"] for v in by_phrase.values()}
    images = {k: v for k, v in images.items() if k in used}
    data = {"images": images, "phrases": by_phrase}
    Path(f"public/data/{lang}/images.json").write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    for f in out_dir.glob("*.webp"):
        if f.stem not in used:
            f.unlink()

    total = sum(images[k]["bytes"] for k in used)
    head = [f"Картинок: {len(used)} ({total // 1024} КБ), фраз с картинкой: {len(by_phrase)} из {sum(1 for p in phrases if p.get('order'))}; "
            f"из них картинка вместо перевода возможна: {sum(1 for v in by_phrase.values() if v.get('cue'))}", ""]
    rep = head + ["ПРОБЛЕМЫ:"] + problems + ["", "ПОСМОТРЕТЬ ГЛАЗАМИ:"] + doubtful + ["", "ВСЕ ФРАЗЫ С КАРТИНКАМИ:"] + report
    Path(f"content/{lang}/images-report.txt").write_text("\n".join(rep), encoding="utf-8")
    print("\n".join(head + ["ПРОБЛЕМЫ:"] + problems))
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
