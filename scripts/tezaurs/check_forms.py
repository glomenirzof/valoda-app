"""Check that every word of given Latvian phrases exists as a word form in Tēzaurs.

Uses the filtered word-form list from the Tēzaurs.lv CLARIN-LV release
(tezaurs_<edition>.ispell.zip, CC BY-SA 4.0). This only proves a form exists;
it does not check case/agreement — that needs the wordforms TEI appendix (step 2).

Usage: python -I scripts/tezaurs/check_forms.py <ispell.zip> <phrases.json>
phrases.json: [{"id": "...", "text": "..."}]
"""
import json
import re
import sys
import zipfile

WORD = re.compile(r"[^\W\d_]+(?:-[^\W\d_]+)*", re.UNICODE)


def load_forms(zip_path: str) -> set[str]:
    with zipfile.ZipFile(zip_path) as z:
        name = z.namelist()[0]
        with z.open(name) as f:
            return {line.decode("utf-8").strip() for line in f if line.strip()}


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")  # Windows console defaults to cp1251
    zip_path, phrases_path = sys.argv[1], sys.argv[2]
    forms = load_forms(zip_path)
    lower = {w.lower() for w in forms}
    with open(phrases_path, encoding="utf-8") as f:
        phrases = json.load(f)

    failed = 0
    for p in phrases:
        missing = [w for w in WORD.findall(p["text"]) if w not in forms and w.lower() not in lower]
        status = "OK " if not missing else "BAD"
        failed += bool(missing)
        print(f"{status} {p['id']}: {p['text']}" + (f"  — нет в Tēzaurs: {', '.join(missing)}" if missing else ""))
    print(f"\n{len(phrases) - failed}/{len(phrases)} фраз: все словоформы найдены ({len(forms):,} форм в списке)")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
