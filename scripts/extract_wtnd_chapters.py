#!/usr/bin/env python3
"""
extract_wtnd_chapters.py — auto-detect chapter starts in a Hesperian
"Where There Is No Doctor" PDF (or any PDF using a "CHAPTER <N>" marker
near a chapter title).

Used to regenerate the GuideSection list in
src/services/content/guide.service.ts when the pack source PDF changes.

Requirements
------------
- pdftotext (poppler-utils)
  On the rgo-agent dev environment, install with:
      nix shell nixpkgs#poppler_utils -c python3 scripts/extract_wtnd_chapters.py <pdf>
  or system-wide:
      apt install poppler-utils   # or equivalent

Output
------
JSON to stdout: a list of {chapter, title, pdf_page, book_page}.
The "page" field used in guide.service.ts GuideSection entries is
**pdf_page** (the value the react-native-pdf reader uses for setPage()).

Example
-------
    $ nix shell nixpkgs#poppler_utils -c python3 scripts/extract_wtnd_chapters.py wtnd-2011.pdf
    [
      {
        "chapter": 1,
        "title": "Home Cures and Popular Beliefs",
        "pdf_page": 48,
        "book_page": 1
      },
      ...
    ]
"""
import json
import os
import re
import shutil
import subprocess
import sys


def find_pdftotext():
    if "PDFTOTEXT" in os.environ:
        return os.environ["PDFTOTEXT"]
    found = shutil.which("pdftotext")
    if found:
        return found
    # Common Nix store paths the rgo-agent dev env uses
    candidates = subprocess.run(
        ["bash", "-c", "ls -d /nix/store/*poppler*/bin/pdftotext 2>/dev/null"],
        capture_output=True, text=True,
    ).stdout.splitlines()
    if candidates:
        return candidates[0]
    print("error: pdftotext not found. Install poppler-utils or set PDFTOTEXT=/path/to/pdftotext", file=sys.stderr)
    sys.exit(2)


PDFTOTEXT = find_pdftotext()
PDFINFO = os.path.join(os.path.dirname(PDFTOTEXT), "pdfinfo")


def page_text(pdf, page):
    out = subprocess.run(
        [PDFTOTEXT, "-layout", "-f", str(page), "-l", str(page), pdf, "-"],
        capture_output=True, text=True, check=True,
    )
    return out.stdout


def get_total(pdf):
    out = subprocess.run([PDFINFO, pdf], capture_output=True, text=True, check=True).stdout
    m = re.search(r"Pages:\s+(\d+)", out)
    if m is None:
        print(f"error: pdfinfo output missing page count for {pdf}", file=sys.stderr)
        sys.exit(2)
    return int(m.group(1))


def find_chapter_marker(lines):
    """Find the line index of a 'CHAPTER' marker and the chapter number
    (a small integer on a neighbouring line). Returns (idx, chap_num) or
    (None, None)."""
    for i, line in enumerate(lines):
        if "CHAPTER" not in line:
            continue
        for j in range(i - 3, i + 4):
            if 0 <= j < len(lines):
                prev = lines[j].strip()
                m = re.fullmatch(r"(\d{1,2})", prev)
                if m:
                    n = int(prev)
                    if abs(j - i) <= 2 and 1 <= n <= 30:
                        return i, n
    return None, None


def find_title(lines, marker_idx, chap_num):
    """Combine the closest non-numeric, non-header lines around the chapter
    marker into a single title. Joins across a chapter-number line because
    2-column layouts often break titles there."""
    candidates = []
    for j in range(max(0, marker_idx - 4), min(len(lines), marker_idx + 6)):
        s = lines[j].strip()
        if not s:
            continue
        if s.startswith("Where There Is No Doctor"):
            continue
        if re.fullmatch(r"\d{1,3}", s):
            continue
        if s == "CHAPTER" or s.startswith("CHAPTER"):
            continue
        candidates.append((j, s))
    if not candidates:
        return f"Chapter {chap_num}"
    first_idx, first_s = candidates[0]
    title = first_s
    # Title continuations: short, often start with a lowercase preposition
    # ("and", "of", "the", ...), or with a Title-cased noun.
    # Sub-section headings in this book are ALL CAPS — never join those.
    join_words = {
        "and", "of", "the", "to", "for", "in", "a", "an", "with", "—", "or",
        "are", "is", "as", "by", "on", "at", "its", "from", "but", "be",
    }
    for j, s in candidates[1:]:
        if abs(j - first_idx) > 8:
            break
        if s.endswith(".") or s.endswith(","):
            break
        if len(s) > 60:
            break
        letters = [c for c in s if c.isalpha()]
        if letters and all(c.isupper() for c in letters):
            break
        first_word = s.lstrip().split(maxsplit=1)[0].lower()
        is_continuation = (
            first_word in join_words
            or (s.lstrip()[:1].isupper() and len(s) <= 50)
        )
        if not is_continuation:
            break
        title = f"{title} {s}"
        first_idx = j
        # Allow a 2nd continuation if it's short and starts lowercase
        next_pair = None
        for k, s2 in candidates:
            if k > j and abs(k - first_idx) <= 4:
                next_pair = (k, s2)
                break
        if next_pair is None:
            break
        k, s2 = next_pair
        if s2.endswith(".") or s2.endswith(","):
            break
        if len(s2) > 50:
            break
        letters2 = [c for c in s2 if c.isalpha()]
        if letters2 and all(c.isupper() for c in letters2):
            break
        fw2 = s2.lstrip().split(maxsplit=1)[0].lower()
        if fw2 in join_words:
            title = f"{title} {s2}"
        break
    return title


def find_book_page(lines, chap_num):
    """Book page number is a small integer on its own line in the top 8
    lines, or the trailing integer on the book-header line."""
    for line in lines[:8]:
        s = line.strip()
        m = re.fullmatch(r"(\d{1,3})", s)
        if m:
            n = int(s)
            if n != chap_num and 0 < n < 1000:
                return n
    for line in lines[:3]:
        if "Where There Is No Doctor" in line:
            m = re.search(r"(\d{1,3})\s*$", line)
            if m:
                n = int(m.group(1))
                if 0 < n < 1000:
                    return n
    return None


def main():
    pdf = sys.argv[1]
    total = get_total(pdf)
    chapters = {}
    for p in range(40, total + 1):
        text = page_text(pdf, p)
        lines = text.splitlines()
        marker_idx, chap_num = find_chapter_marker(lines)
        if chap_num is None or chap_num in chapters:
            continue
        title = find_title(lines, marker_idx, chap_num)
        book_page = find_book_page(lines, chap_num)
        chapters[chap_num] = {
            "chapter": chap_num,
            "title": title,
            "pdf_page": p,
            "book_page": book_page,
        }
    out = [chapters[k] for k in sorted(chapters)]
    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    main()
