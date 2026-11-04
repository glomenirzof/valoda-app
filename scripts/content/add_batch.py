"""Merge a batch of new phrases into content/<lang>/phrases.src.json and lexicon.src.json.

    python -I scripts/content/add_batch.py lv content/lv/batches/batch-1.json [--dry]

Batch format: {"lexicon": {lemma: ru}, "phrases": [[topic, lv, ru, "lemma lemma …", {hints}?], …]}.
Checks the i+1 rule: every phrase brings at most one lemma that is not known yet (known = lemmas of all
earlier phrases, including earlier phrases of the same batch). Phrases that break it are listed and the
batch is not merged. Already present texts are skipped, so re-running is safe. After merging, run
npm run content:check — nothing goes into training before it says «ok».
"""
import json
import sys
from pathlib import Path


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    lang, batch_path = sys.argv[1], Path(sys.argv[2])
    dry = "--dry" in sys.argv
    src_p = Path(f"content/{lang}/phrases.src.json")
    lex_p = Path(f"content/{lang}/lexicon.src.json")
    src = json.loads(src_p.read_text(encoding="utf-8"))
    lex = json.loads(lex_p.read_text(encoding="utf-8"))
    batch = json.loads(batch_path.read_text(encoding="utf-8"))

    lemma = lambda spec: spec.partition("/")[0].lower()
    known = {lemma(l) for p in src["phrases"] for l in p["lemmas"].split()}
    texts = {p["lv"] for p in src["phrases"]}
    next_id = max(int(p["id"].split("-")[1]) for p in src["phrases"]) + 1

    added, problems, skipped = [], [], 0
    for item in batch["phrases"]:
        topic, lv, ru, lemmas = item[:4]
        hints = item[4] if len(item) > 4 else None
        if lv in texts:
            skipped += 1
            continue
        new = sorted({lemma(l) for l in lemmas.split()} - known)
        if len(new) > 1:
            problems.append(f"«{lv}»: новых слов {len(new)} — {', '.join(new)}")
        if not new:
            problems.append(f"«{lv}»: нет нового слова")
        missing = [l for l in new if l not in {k.lower() for k in {**lex, **batch.get('lexicon', {})}}]
        if missing:
            problems.append(f"«{lv}»: нет перевода для {', '.join(missing)}")
        known |= set(new)
        phrase = {"id": f"{lang}-{next_id:04d}", "topic": topic, "lv": lv, "ru": ru, "lemmas": lemmas,
                  "batch": batch_path.stem}
        if hints:
            phrase["hints"] = hints
        added.append(phrase)
        next_id += 1

    print(f"{batch_path.name}: новых фраз {len(added)}, уже были {skipped}, нарушений {len(problems)}")
    for p in problems:
        print("  " + p)
    if problems or dry:
        return 1 if problems else 0
    src["phrases"].extend(added)
    for k, v in batch.get("lexicon", {}).items():
        lex.setdefault(k, v)
    src_p.write_text(json.dumps(src, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    lex_p.write_text(json.dumps(lex, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"добавлено: {added[0]['id']}…{added[-1]['id']}" if added else "добавлять нечего")
    return 0


if __name__ == "__main__":
    sys.exit(main())
