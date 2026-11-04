"""Validate source phrases against the Tēzaurs form index and build app data.

  python -I scripts/content/build_phrases.py [lang]

Reads   content/<lang>/phrases.src.json, content/<lang>/lexicon.src.json,
        content/<lang>/review.json (tutor decisions, optional),
        data-cache/tezaurs/lv-forms.sqlite, data-cache/freq/<lang>_50k.txt (optional)
Writes  public/data/<lang>/phrases.json  — only phrases that pass the dictionary check
        content/<lang>/build-report.txt  — errors and warnings

Per word: the form must exist in Tēzaurs for the given lemma. If the form has several
grammatical readings, a hint in phrases.src.json picks one (vocative readings are
dropped automatically when another reading exists).
"""
import json
import re
import hashlib
import sqlite3
import sys
from collections import defaultdict
from pathlib import Path

WORD = re.compile(r"[^\W\d_]+(?:-[^\W\d_]+)*", re.UNICODE)
DB = Path("data-cache/tezaurs/lv-forms.sqlite")

# --- context rules that pick one grammatical reading for syncretic forms -------------
PREP_CASE = {"uz": "ACC", "par": "ACC", "pa": "ACC", "ar": "ACC", "caur": "ACC", "gar": "ACC",
             "no": "GEN", "pie": "GEN", "bez": "GEN", "pēc": "GEN", "aiz": "GEN", "zem": "GEN",
             "virs": "GEN", "pirms": "GEN", "līdz": "DAT"}
MODALS = {"gribēt", "varēt", "vajadzēt", "mācīties", "sākt", "drīkstēt", "mēģināt", "patikt"}
SUBJECT = {"es": ("1", "SG"), "tu": ("2", "SG"), "mēs": ("1", "PL"), "jūs": ("2", "PL")}
NOMINATIVE_PRONOUNS = {"es", "tu", "mēs", "jūs", "viņš", "viņa", "viņi", "viņas"}
CASE_ORDER = ["NOM", "ACC", "DAT", "GEN", "LOC", "VOC"]
AGREEING = {"ADJ", "NUM"}
POS_PRIORITY = ["PRON", "VERB", "ADJ", "NOUN", "NUM", "ADP", "ADV", "CCONJ", "PART", "INTJ", "ABBR", "X"]
CONTENT_POS = {"NOUN", "VERB", "ADJ"}
DETERMINERS = {"šis", "tas", "mans", "tavs", "savs", "kāds", "viens", "viss", "mūsu"}


def sets(readings):
    return [(r, set(r.split(".")) if r else set()) for r in readings]


def prune(readings: list[str]) -> list[str]:
    """Drop empty readings and readings that are a strict subset of another one."""
    rs = [r for r in readings if r] or readings
    s = sets(rs)
    return [r for r, a in s if not any(a < b for _, b in s)]


def prefer(readings: list[str], test) -> list[str]:
    kept = [r for r in readings if test(set(r.split(".")))]
    return kept or readings


def resolve(i: int, toks: list[dict], text: str) -> list[str]:
    t = toks[i]
    rs = prune(t["readings"])
    if len(rs) <= 1:
        return rs
    lemmas = [x["lemma"].lower() for x in toks]
    prev = lemmas[i - 1] if i else None

    if t["pos"] == "VERB":
        if any(lemmas[j] in MODALS for j in range(i)) and any("INF" in r.split(".") for r in rs):
            return prefer(rs, lambda a: "INF" in a)
        if i == 0 and text.rstrip().endswith("!"):
            rs = prefer(rs, lambda a: "IMP" in a)
        else:
            rs = prefer(rs, lambda a: "IMP" not in a and "INF" not in a)
        rs = prefer(rs, lambda a: "PTCP" not in a)
        rs = prefer(rs, (lambda a: "PST" in a) if "vakar" in lemmas else (lambda a: "PST" not in a))

        def is_subject(x):
            if x["lemma"].lower() not in SUBJECT:
                return False
            readings = x.get("chosen") or x["readings"]
            return any("NOM" in r.split(".") for r in readings)

        subj = next((SUBJECT[x["lemma"].lower()] for x in toks if is_subject(x)), None)
        if subj:
            rs = prefer(rs, lambda a: subj[0] in a)
        else:
            rs = prefer(rs, lambda a: "3" in a or not ({"1", "2"} & a))
        return rs

    if prev in PREP_CASE:
        # any preposition with a plural noun takes the dative
        rs = prefer(rs, lambda a: (PREP_CASE[prev] in a and "SG" in a) or ("DAT" in a and "PL" in a))
    if t["lemma"].lower() in NOMINATIVE_PRONOUNS:
        rs = prefer(rs, lambda a: "NOM" in a)
    for case in CASE_ORDER:  # generic fallback: most common case first, singular first
        if len(rs) <= 1:
            break
        cand = [r for r in rs if case in r.split(".")]
        if cand:
            rs = prefer(cand, lambda a: "SG" in a)
    return rs


def agree(i: int, toks: list[dict], db: sqlite3.Connection, lexicon: dict[str, str]) -> None:
    """Adjectives, numerals and determiners take case/number/gender from the next noun.

    Tēzaurs keeps some feminine pronoun forms as separate lexemes (šī, mana), so when
    the given lemma has no agreeing reading, a same-spelled lexeme that agrees is used.
    """
    t = toks[i]
    if not (t["pos"] in AGREEING or t["pos"] == "PRON" or t["lemma"].lower() in DETERMINERS) or i + 1 >= len(toks):
        return
    nxt = toks[i + 1]
    if nxt["pos"] != "NOUN" or not nxt["chosen"]:
        return
    want = {p for p in nxt["chosen"][0].split(".") if p in {"NOM", "GEN", "DAT", "ACC", "LOC", "SG", "PL", "M", "F"}}
    if nxt.get("gender"):
        want.add(nxt["gender"])
    match = [r for r in prune(t["readings"]) if want <= set(r.split("."))]
    if match:
        t["chosen"] = match
        return
    if t["lemma"].lower() not in DETERMINERS and t["pos"] not in AGREEING:
        return
    for lemma, feats in db.execute(
            "SELECT l.lemma, f.feats FROM form f JOIN lexeme l ON l.id = f.lexeme_id "
            "WHERE f.orth_lc = ? AND l.pos = ? AND lower(l.lemma) != ?",
            (t["s"].lower(), t["pos"], t["lemma"].lower())):
        if want <= set(feats.split(".")):
            t["ru"] = lexicon.get(lemma) or t["ru"]
            t["lemma"], t["readings"], t["chosen"] = lemma, [feats], [feats]
            return


CASE_RU = {"NOM": "именительный", "GEN": "родительный", "DAT": "дательный", "ACC": "винительный", "LOC": "местный"}
CASE_Q = {"NOM": "кто? что?", "GEN": "кого? чего?", "DAT": "кому? чему?", "ACC": "кого? что?", "LOC": "где?"}
PERSON_RU = {"1": "1-е лицо", "2": "2-е лицо", "3": "3-е лицо"}
TENSE_RU = {"PRS": "настоящее время", "PST": "прошедшее время", "FUT": "будущее время"}


def same_case(s: str, like: str) -> str:
    return s[:1].upper() + s[1:] if like[:1].isupper() else s


def key_word(tokens: list[dict], db: sqlite3.Connection) -> dict | None:
    """The word whose ending the phrase trains, a same-lexeme trap with a wrong ending, and one-line reasons.

    Prefers a noun or adjective in an oblique case (the endings learners get wrong), then a finite
    verb (person ending), then a noun or adjective in the nominative.
    """
    def case_of(t):
        return next((c for c in CASE_RU if c in t["feats"].split(".")), None)

    order = ([i for i, t in enumerate(tokens) if t["pos"] == "NOUN" and case_of(t) not in (None, "NOM")]
             + [i for i, t in enumerate(tokens) if t["pos"] == "ADJ" and case_of(t) not in (None, "NOM")]
             + [i for i, t in enumerate(tokens) if t["pos"] == "VERB" and {"PRS", "PST", "FUT"} & set(t["feats"].split("."))]
             + [i for i, t in enumerate(tokens) if t["pos"] in ("NOUN", "ADJ") and case_of(t) == "NOM"])
    for i in order:
        t = tokens[i]
        feats = set(t["feats"].split("."))
        forms = db.execute("SELECT f.orth, f.feats FROM form f JOIN lexeme l ON l.id = f.lexeme_id "
                           "WHERE l.lemma = ? AND l.pos = ?", (t["lemma"], t["pos"])).fetchall()
        prev = tokens[i - 1] if i else None
        if t["pos"] == "VERB":
            person = next((p for p in PERSON_RU if p in feats), None)
            if not person:
                continue
            others = ["3", "1"] if person != "3" else ["1", "2"]
            for o in others:
                # 3rd person forms carry no number in Tēzaurs (saprot = IND.PRS.3); 1st/2nd do
                want = (feats - {person, "SG", "PL"}) | {o} | (set() if o == "3" else {"PL" if "PL" in feats else "SG"})
                trap = next((f for f, fs in forms if set(fs.split(".")) == want and f.lower() != t["s"].lower()), None)
                if trap:
                    num = "мн. ч." if "PL" in feats else "ед. ч."
                    tense = next((TENSE_RU[x] for x in TENSE_RU if x in feats), "")
                    return {"i": i, "trap": same_case(trap, t["s"]),
                            "why": f"{t['lemma']} → {t['s']}: {PERSON_RU[person]}, {num}, {tense}",
                            "trapWhy": f"{same_case(trap, t['s'])} — {PERSON_RU[o]}, а здесь {PERSON_RU[person]}: {t['s']}"}
            continue
        case = case_of(t)
        for other in ["NOM", "ACC", "GEN", "DAT", "LOC"]:
            if other == case:
                continue
            want = (feats - {case}) | {other}
            trap = next((f for f, fs in forms if set(fs.split(".")) == want and f.lower() != t["s"].lower()), None)
            if not trap:
                continue
            reason = (f"после {prev['s'].lower()} — {CASE_RU[case]} падеж" if prev and prev["pos"] == "ADP"
                      else f"{CASE_Q[case]} — {CASE_RU[case]} падеж")
            arrow = f"{t['lemma']} → {t['s']}" if t["lemma"].lower() != t["s"].lower() else t["s"]
            return {"i": i, "trap": same_case(trap, t["s"]),
                    "why": f"{reason}: {arrow}",
                    "trapWhy": f"{same_case(trap, t['s'])} — {CASE_RU[other]} («{CASE_Q[other]}»), а здесь {reason}: {t['s']}"}
    return None


def load_json(p: Path, default):
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else default


def lemma_freq(db: sqlite3.Connection, freq_path: Path) -> dict[str, int]:
    """Spread subtitle word-form counts over the lemmas each form can belong to."""
    if not freq_path.exists():
        return {}
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
    ranked = sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))  # ties by lemma: stable ranks
    return {lem: i + 1 for i, (lem, _) in enumerate(ranked)}


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    lang = sys.argv[1] if len(sys.argv) > 1 else "lv"
    src = load_json(Path(f"content/{lang}/phrases.src.json"), None)
    lexicon: dict[str, str] = load_json(Path(f"content/{lang}/lexicon.src.json"), {})
    review: dict[str, dict] = load_json(Path(f"content/{lang}/review.json"), {})
    # npm run content:check results; a status counts only for the exact text and translation it was checked for
    auto: dict[str, dict] = load_json(Path(f"content/{lang}/auto-check.json"), {})
    db = sqlite3.connect(DB)
    edition = "2026_4"
    ranks = lemma_freq(db, Path(f"data-cache/freq/{lang}_50k.txt"))

    errors, warnings, out = [], [], []
    missing_gloss: set[str] = set()

    for p in src["phrases"]:
        words = WORD.findall(p["lv"])
        lemmas = p["lemmas"].split()
        hints = p.get("hints", {})
        pid = p["id"]
        if len(words) != len(lemmas):
            errors.append(f"{pid}: {len(words)} слов, но {len(lemmas)} лемм — «{p['lv']}»")
            continue

        tokens, ok = [], True
        for w, lem_spec in zip(words, lemmas):
            # "rīt/ADV" picks one homonym when a lemma exists under several parts of speech
            lem, _, want_pos = lem_spec.partition("/")
            rows = db.execute(
                "SELECT l.lemma, l.pos, l.decl, l.conj, l.gender, f.feats FROM form f "
                "JOIN lexeme l ON l.id = f.lexeme_id WHERE f.orth_lc = ? AND lower(l.lemma) = ?",
                (w.lower(), lem.lower())).fetchall()
            if want_pos:
                rows = [r for r in rows if r[1] == want_pos]
            else:
                # abbreviations / residuals that share the spelling ("es", "uz") never win
                rows = [r for r in rows if r[1] not in ("ABBR", "X")] or rows
                pos_set = {r[1] for r in rows}
                if len(pos_set) > 1:
                    best = min(pos_set, key=POS_PRIORITY.index)
                    rows = [r for r in rows if r[1] == best]
                    if len(pos_set & CONTENT_POS) > 1:
                        warnings.append(f"{pid}: «{w}» — омонимы «{lem}» ({', '.join(sorted(pos_set))}), взял {best}; "
                                        f"если не так — укажи {lem}/ЧАСТЬ_РЕЧИ")
            if not rows:
                other = sorted({r[0] for r in db.execute(
                    "SELECT l.lemma FROM form f JOIN lexeme l ON l.id = f.lexeme_id WHERE f.orth_lc = ?",
                    (w.lower(),))})
                hint = f" (в Tēzaurs эта форма есть у: {', '.join(other[:6])})" if other else " (формы нет в Tēzaurs)"
                errors.append(f"{pid}: «{w}» не является формой леммы «{lem}»{hint}")
                ok = False
                continue

            readings = sorted({r[5] for r in rows})
            hinted = w in hints
            if hinted:
                want = set(hints[w].split("."))
                readings = [r for r in readings if want <= set(r.split("."))]
                if not readings:
                    errors.append(f"{pid}: подсказка {hints[w]} для «{w}» не совпала ни с одной формой "
                                  f"({', '.join(sorted({r[5] for r in rows}))})")
                    ok = False
                    continue
            readings = [r for r in readings if "VOC" not in r.split(".")] or readings

            r0 = rows[0]
            gloss = lexicon.get(lem) or lexicon.get(lem.lower())
            if not gloss:
                missing_gloss.add(lem)
            tokens.append({
                "s": w, "lemma": r0[0], "pos": r0[1], "readings": readings, "hinted": hinted,
                "decl": r0[2], "conj": r0[3], "gender": r0[4], "ru": gloss or "",
            })
        if not ok:
            continue

        # pick one reading per word: nouns/verbs by context, then agreeing words by their noun
        for i, t in enumerate(tokens):
            t["chosen"] = prune(t["readings"]) if t["hinted"] else resolve(i, tokens, p["lv"])
        for i in range(len(tokens) - 1, -1, -1):
            if not tokens[i]["hinted"]:
                agree(i, tokens, db, lexicon)
        for t in tokens:
            if len(t["chosen"]) > 1:
                warnings.append(f"{pid}: «{t['s']}» ({t['lemma']}) осталось неоднозначно: {' | '.join(t['chosen'])}")
        tokens = [{
            "s": t["s"], "lemma": t["lemma"], "pos": t["pos"], "feats": t["chosen"][0] if t["chosen"] else "",
            **({"alt": t["chosen"][1:]} if len(t["chosen"]) > 1 else {}),
            **({"decl": t["decl"]} if t["decl"] and t["decl"] != "Nepiemīt" else {}),
            **({"conj": t["conj"]} if t["conj"] and t["conj"] != "Nepiemīt" else {}),
            **({"gender": t["gender"]} if t["gender"] else {}),
            "ru": t["ru"],
        } for t in tokens]

        rv = review.get(pid, {})
        if rv.get("status") == "drop":
            continue
        ac = auto.get(pid, {})
        checked = ac.get("hash") == hashlib.sha1(f"{p['lv']}|{p['ru']}".encode()).hexdigest()[:12]
        if checked and ac.get("status") == "drop":
            continue
        if rv.get("status") == "fix":
            warnings.append(f"{pid}: репетитор исправил → «{rv.get('lv', p['lv'])}» / «{rv.get('ru', p['ru'])}»"
                            f"{' — ' + rv['comment'] if rv.get('comment') else ''}: обнови phrases.src.json")
        content_ranks = [ranks.get(t["lemma"].lower()) for t in tokens if t["pos"] not in ("ADP", "CCONJ", "PART", "INTJ")]
        content_ranks = [r for r in content_ranks if r]
        out.append({
            "id": pid,
            "lang": lang,
            "topic": p.get("topic"),
            # a tutor fix is applied by editing phrases.src.json, so the tokens stay consistent
            "text": p["lv"],
            "ru": p["ru"],
            "tokens": tokens,
            "accept": p.get("accept", []),
            **({"key": key} if (key := key_word(tokens, db)) else {}),
            "audio": None,
            "image": p.get("image"),
            "freqRank": max(content_ranks) if content_ranks else None,
            "status": "tutor" if rv.get("status") == "ok" else "unverified",
            "auto": ac.get("status", "unchecked") if checked else "unchecked",
            "source": p.get("source", "llm"),
            "check": {"tezaurs": "ok", "edition": edition},
        })

    out.sort(key=lambda x: (x["freqRank"] or 10**9, x["id"]))
    Path(f"public/data/{lang}").mkdir(parents=True, exist_ok=True)
    Path(f"public/data/{lang}/phrases.json").write_text(
        json.dumps({"lang": lang, "edition": edition, "phrases": out}, ensure_ascii=False, indent=1), encoding="utf-8")

    report = [f"Фраз в источнике: {len(src['phrases'])}; прошли словарь: {len(out)}; ошибок: {len(errors)}; "
              f"предупреждений: {len(warnings)}; лемм без перевода: {len(missing_gloss)}", ""]
    report += ["ОШИБКИ:"] + errors + ["", "ПРЕДУПРЕЖДЕНИЯ:"] + warnings
    report += ["", "НЕТ ПЕРЕВОДА В lexicon.src.json:", ", ".join(sorted(missing_gloss))]
    Path(f"content/{lang}/build-report.txt").write_text("\n".join(report), encoding="utf-8")
    print("\n".join(report))
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
