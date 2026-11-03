"""Build a SQLite index of all Latvian word forms from the Tēzaurs.lv wordforms appendix.

Input:  tezaurs_<edition>_wordforms_tei.xml.zip (CLARIN-LV, CC BY-SA 4.0), streamed —
        the 13+ GB XML is never unpacked to disk.
Output: data-cache/tezaurs/lv-forms.sqlite
        lexeme(id, lemma, pos, decl, conj, gender, proper, props)
        form(lexeme_id, orth, orth_lc, feats)

feats is a dot-joined code string in a fixed order, e.g. "LOC.SG.F", "IND.PRS.1.SG".
The same codes are used in content/lv/*.json, so validation is a subset check.

Usage: python -I scripts/tezaurs/build_index.py <wordforms.zip> <out.sqlite>
"""
import json
import sqlite3
import sys
import time
import xml.etree.ElementTree as ET
import zipfile

NS = "{http://www.tei-c.org/ns/1.0}"

POS = {
    "Lietvārds": "NOUN", "Darbības vārds": "VERB", "Īpašības vārds": "ADJ", "Apstākļa vārds": "ADV",
    "Vietniekvārds": "PRON", "Skaitļa vārds": "NUM", "Prievārds": "ADP", "Saiklis": "CCONJ",
    "Partikula": "PART", "Izsauksmes vārds": "INTJ", "Saīsinājums": "ABBR", "Reziduālis": "X",
}

# (TEI gram type, value -> code); order here is the order of codes in feats
FEATS = [
    ("Izteiksme", {"Īstenības": "IND", "Pavēles": "IMP", "Nenoteiksme": "INF", "Vajadzības": "DEB",
                   "Atstāstījuma": "QUOT", "Vēlējuma": "COND", "Divdabis": "PTCP",
                   "Vajadzības, atstāstījuma paveids": "DEBQ"}),
    ("Laiks", {"Tagadne": "PRS", "Pagātne": "PST", "Nākotne": "FUT"}),
    ("Persona", {"1": "1", "2": "2", "3": "3"}),
    ("Locījums", {"Nominatīvs": "NOM", "Ģenitīvs": "GEN", "Datīvs": "DAT", "Akuzatīvs": "ACC",
                  "Lokatīvs": "LOC", "Vokatīvs": "VOC"}),
    ("Skaitlis", {"Vienskaitlis": "SG", "Daudzskaitlis": "PL"}),
    ("Dzimte", {"Vīriešu": "M", "Sieviešu": "F"}),
    ("Noteiktība", {"Noteiktā": "DEF", "Nenoteiktā": "INDEF"}),
    ("Pakāpe", {"Pārākā": "CMP", "Vispārākā": "SUP"}),
    ("Kārta", {"Ciešamā": "PASS"}),
    ("Atgriezeniskums", {"Jā": "REFL"}),
    ("Noliegums", {"Jā": "NEG"}),
]


def grams(el) -> dict[str, str]:
    gg = el.find(f"{NS}gramGrp")
    return {} if gg is None else {g.get("type"): (g.text or "") for g in gg.findall(f"{NS}gram")}


def feats_code(g: dict[str, str]) -> str:
    return ".".join(m[g[t]] for t, m in FEATS if g.get(t) in m)


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    zip_path, out = sys.argv[1], sys.argv[2]
    db = sqlite3.connect(out)
    db.executescript("""
        PRAGMA journal_mode = OFF; PRAGMA synchronous = OFF;
        DROP TABLE IF EXISTS lexeme; DROP TABLE IF EXISTS form;
        CREATE TABLE lexeme (id TEXT PRIMARY KEY, lemma TEXT, pos TEXT, decl TEXT, conj TEXT,
                             gender TEXT, proper INTEGER, props TEXT);
        CREATE TABLE form (lexeme_id TEXT, orth TEXT, orth_lc TEXT, feats TEXT);
    """)

    t0 = time.time()
    n_lex = n_form = 0
    lex_rows, form_rows = [], []

    def flush():
        db.executemany("INSERT OR REPLACE INTO lexeme VALUES (?,?,?,?,?,?,?,?)", lex_rows)
        db.executemany("INSERT INTO form VALUES (?,?,?,?)", form_rows)
        db.commit()
        lex_rows.clear()
        form_rows.clear()

    with zipfile.ZipFile(zip_path) as z, z.open(z.namelist()[0]) as f:
        for _, el in ET.iterparse(f, events=("end",)):
            if el.tag != f"{NS}entry":
                continue
            top = el.find(f"{NS}form")
            if top is None:
                el.clear()
                continue
            ptr = top.find(f"{NS}ref/{NS}ptr")
            lex_id = ptr.get("target") if ptr is not None else f"anon_{n_lex}"
            lemma = (top.findtext(f"{NS}orth") or "").strip()
            g = grams(top)
            pos = POS.get(g.get("Vārdšķira", ""), "X")
            lex_rows.append((
                lex_id, lemma, pos, g.get("Deklinācija"), g.get("Konjugācija"),
                {"Vīriešu": "M", "Sieviešu": "F"}.get(g.get("Dzimte", "")),
                1 if g.get("Lietvārda_tips") == "Īpašvārds" else 0,
                json.dumps({k: v for k, v in g.items() if k not in ("Vārdšķira",)}, ensure_ascii=False),
            ))
            for fe in top.findall(f"{NS}form"):
                if fe.get("type") != "inflection":
                    continue
                orth = (fe.findtext(f"{NS}orth") or "").strip()
                if orth:
                    form_rows.append((lex_id, orth, orth.lower(), feats_code(grams(fe))))
                    n_form += 1
            n_lex += 1
            el.clear()
            if len(form_rows) > 200_000:
                flush()
                print(f"  {n_lex:,} лексем, {n_form:,} форм, {time.time() - t0:.0f} с", flush=True)
    flush()

    print("индексы…", flush=True)
    db.executescript("""
        CREATE INDEX form_orth ON form(orth_lc);
        CREATE INDEX form_lex ON form(lexeme_id);
        CREATE INDEX lexeme_lemma ON lexeme(lemma);
    """)
    db.close()
    print(f"готово: {n_lex:,} лексем, {n_form:,} форм за {time.time() - t0:.0f} с → {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
