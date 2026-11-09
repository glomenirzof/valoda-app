"""Data for the adaptive placement test: public/data/<lang>/placement.json

    python -I scripts/content/build_placement.py lv

- lemmaRank: corpus frequency rank (subtitle corpus, data-cache/freq/<lang>_50k.txt) of every word used
  in the phrases, so a typed word question has a difficulty on the same scale as everything else;
- words: real dictionary words (Tēzaurs, not proper nouns) from frequency bands 300…12 000 for «знаю / не
  знаю» questions — they reach past the phrase base, which ends around early A2;
- fakes: invented words that look Latvian and are not a form of any Tēzaurs word, to catch guessing.

Difficulty everywhere is a frequency rank: knowing a word of rank r goes with a vocabulary of about r words.
"""
import json
import sqlite3
import sys
from collections import defaultdict
from pathlib import Path

DB = Path("data-cache/tezaurs/lv-forms.sqlite")
BANDS = [300, 600, 1200, 2400, 4800, 9600, 12000]
PER_BAND = 8
# Real words for «знаю / не знаю», picked by hand from each frequency band: ordinary dictionary words, no
# homonym artifacts or rare derivations. Their rank is looked up below, so a word is placed where it really is.
CURATED = [
    "sirds", "ātrs", "pārbaudīt", "iemesls", "sapnis", "maksāt", "pārdot", "gudrs",
    "akmens", "smags", "slimnīca", "brīnums", "brīvība", "dators", "vasara", "sabiedrība",
    "pienākums", "attālums", "stūris", "slavens", "papīrs", "svaigs", "ledus", "dusmas",
    "neparasts", "atriebība", "gaitenis", "satiksme", "pārliecība", "izdevīgs", "dāsns", "steiga",
    "plakāts", "vājums", "apelsīns", "vingrinājums", "skrūve", "pirkums", "ietaupīt", "saldētava",
    "priekšpilsēta", "skaņdarbs", "vispārīgs", "laimests", "pusmūžs", "krastmala", "ābele", "divkāršs",
]
# Invented words in Latvian spelling; each is checked below against every form in Tēzaurs.
FAKE_CANDIDATES = [
    "kortīne", "smelpot", "gruzaks", "dreņķis", "vastrums", "kluzināt", "brīmele", "sporklis", "mīdrot",
    "zelčums", "tarpēt", "glumbis", "vešķele", "skalbot", "drūzens", "mergots", "plūdzināt", "šķirbeks",
]


def ranks(db: sqlite3.Connection, freq_path: Path) -> dict[str, int]:
    """Same spreading of form counts over lemmas as build_phrases.py, but keeps the part of speech."""
    counts: dict[str, float] = defaultdict(float)
    for line in freq_path.read_text(encoding="utf-8").splitlines():
        parts = line.rsplit(" ", 1)
        if len(parts) != 2 or not parts[1].isdigit():
            continue
        word, n = parts[0], int(parts[1])
        lemmas = {r[0] for r in db.execute(
            "SELECT DISTINCT l.lemma FROM form f JOIN lexeme l ON l.id = f.lexeme_id "
            "WHERE f.orth_lc = ? AND l.proper = 0", (word,))}
        for lem in lemmas:
            counts[lem.lower()] += n / len(lemmas)
    ranked = sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))
    return {lem: i + 1 for i, (lem, _) in enumerate(ranked)}


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    lang = sys.argv[1] if len(sys.argv) > 1 else "lv"
    db = sqlite3.connect(DB)
    rank = ranks(db, Path(f"data-cache/freq/{lang}_50k.txt"))
    phrases = json.loads(Path(f"public/data/{lang}/phrases.json").read_text(encoding="utf-8"))["phrases"]
    base = {t["lemma"].lower() for p in phrases for t in p["tokens"]}
    lemma_rank = {l: rank[l] for l in sorted(base) if l in rank}

    missing = [w for w in CURATED if w not in rank]
    words = sorted(({"w": w, "rank": rank[w]} for w in CURATED if w in rank), key=lambda x: x["rank"])

    fakes = [w for w in FAKE_CANDIDATES
             if not db.execute("SELECT 1 FROM form WHERE orth_lc = ? LIMIT 1", (w,)).fetchone()]

    out = {"lemmaRank": lemma_rank, "words": words, "fakes": fakes}
    Path(f"public/data/{lang}/placement.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"слов базы с рангом: {len(lemma_rank)} из {len(base)}; слов по полосам: {len(words)}; "
          f"нет в частотном списке: {', '.join(missing) or 'нет'}; несуществующих: {len(fakes)} из {len(FAKE_CANDIDATES)} ({', '.join(sorted(set(FAKE_CANDIDATES) - set(fakes))) or 'все прошли'})")
    for lo, hi in zip(BANDS, BANDS[1:]):
        print(f"  {lo}–{hi}: " + ", ".join(w["w"] for w in words if lo <= w["rank"] < hi))
    return 0


if __name__ == "__main__":
    sys.exit(main())
