// What was selected in a PDF, transcribed as it looks: titles (bigger
// letters), lists (bullets / numbers at the start of the line), tables
// (text lined up in columns) and paragraphs. Worked out from the text
// layer pdf.js draws over the page — no AI, so it's instant and keeps the
// original words.

const BULLET = /^\s*[•·●▪◦‣∙*–—-]\s+/;
const NUMBERED = /^\s*\(?\d{1,3}[.)]\s+/;
const median = (a: number[]) => {
  const s = [...a].sort((x, y) => x - y);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};

export type Span = { text: string; left: number; right: number; top: number; bottom: number; fs: number };
type Cell = { text: string; left: number; right: number };
type Line = { mid: number; text: string; cells: Cell[]; fs: number };

export type Segment =
  | { type: "h1" | "h2" | "h3" | "text"; text: string }
  | { type: "bullet" | "numbered"; items: string[] }
  | { type: "table"; rows: string[][] };

export type Kind = "auto" | "text" | "title" | "list" | "table";
export type SelectionInfo = { lines: Line[]; ratio: number; segments: Segment[] };

export const SEGMENT_LABEL: Record<Segment["type"], string> = { h1: "Título", h2: "Título", h3: "Título", text: "Texto", bullet: "Lista", numbered: "Lista", table: "Tabla" };

// The text layer's pieces, and the page's usual (body) letter size.
const pieces = (layer: HTMLElement) => [...layer.querySelectorAll<HTMLElement>("span")].filter((s) => s.textContent?.trim() && !s.classList.contains("markedContent"));
const fsOf = (s: HTMLElement) => parseFloat(getComputedStyle(s).fontSize) || s.getBoundingClientRect().height;
const measure = (s: HTMLElement): Span => {
  const r = s.getBoundingClientRect();
  return { text: s.textContent ?? "", left: r.left, right: r.right, top: r.top, bottom: r.bottom, fs: fsOf(s) };
};

function selectedSpans(layer: HTMLElement, sel: Selection): { mine: Span[]; body: number } {
  const all = pieces(layer);
  const mine = all.filter((s) => {
    try {
      return sel.containsNode(s, true);
    } catch {
      return false;
    }
  });
  return { mine: mine.map(measure), body: median(all.map(fsOf).filter(Boolean)) };
}

export type Area = { left: number; top: number; right: number; bottom: number };

// The pieces inside a box drawn on the page (screen coordinates): a piece
// counts when its middle is in the box, so a box that grazes the line
// above or below doesn't drag it in.
export function spansInArea(layer: HTMLElement, a: Area): { mine: Span[]; body: number } {
  const all = pieces(layer).map((s) => ({ s, m: measure(s) }));
  const mine = all.filter(({ m }) => {
    const x = (m.left + m.right) / 2;
    const y = (m.top + m.bottom) / 2;
    return x >= a.left && x <= a.right && y >= a.top && y <= a.bottom;
  });
  return { mine: mine.map((x) => x.m), body: median(all.map((x) => x.m.fs).filter(Boolean)) };
}

// Pieces → lines (same height), and each line → cells (split by a wide gap).
function toLines(spans: Span[]): Line[] {
  const sorted = [...spans].sort((a, b) => a.top - b.top || a.left - b.left);
  const lines: { mid: number; spans: Span[]; fs: number }[] = [];
  for (const s of sorted) {
    const mid = (s.top + s.bottom) / 2;
    const line = lines.find((l) => Math.abs(l.mid - mid) < s.fs * 0.5);
    if (line) line.spans.push(s);
    else lines.push({ mid, spans: [s], fs: s.fs });
  }
  return lines
    .sort((a, b) => a.mid - b.mid)
    .map((l) => {
      const sp = l.spans.sort((a, b) => a.left - b.left);
      const cells: Cell[] = [];
      for (const s of sp) {
        const last = cells[cells.length - 1];
        if (last && s.left - last.right < s.fs * 0.9) {
          last.text += (s.left - last.right > s.fs * 0.15 && !/\s$/.test(last.text) ? " " : "") + s.text;
          last.right = s.right;
        } else cells.push({ text: s.text, left: s.left, right: s.right });
      }
      return {
        mid: l.mid,
        text: cells.map((c) => c.text).join(" ").replace(/\s+/g, " ").trim(),
        cells: cells.map((c) => ({ ...c, text: c.text.replace(/\s+/g, " ").trim() })),
        fs: l.fs,
      };
    });
}

const CONT = /^[a-zñáéíóúü]/; // a cell starting lower-case carries on the line above

// Lines in columns → tables. A real table (every column on every line)
// gives one row per line; "cards" (cells whose text wraps over several
// lines) give one row per band, with a short title on top as the header.
export function tablesFromLines(slice: Line[], lefts: number[]): string[][][] {
  // Columns from every line, not just the first: cells that overlap
  // sideways are one column (so centred or right-aligned ones line up).
  const fs = slice[0]?.fs ?? 12;
  const spans = [...slice.flatMap((l) => l.cells.map((c) => [c.left, c.right] as [number, number])), ...lefts.map((x) => [x, x + 1] as [number, number])].sort((a, b) => a[0] - b[0]);
  const columns: [number, number][] = [];
  for (const [l, r] of spans) {
    const last = columns[columns.length - 1];
    if (last && l < last[1] + fs * 0.3) last[1] = Math.max(last[1], r);
    else columns.push([l, r]);
  }
  const colOf = (c: Cell) => {
    const mid = (c.left + c.right) / 2;
    let best = 0;
    columns.forEach(([l, r], k) => {
      const d = mid < l ? l - mid : mid > r ? mid - r : 0;
      const [bl, br] = columns[best];
      const bd = mid < bl ? bl - mid : mid > br ? mid - br : 0;
      if (d < bd) best = k;
    });
    return best;
  };
  const cols = columns.length;
  const rows = slice.map((l) => {
    const r: (string | null)[] = Array(cols).fill(null);
    l.cells.forEach((c) => {
      const k = colOf(c);
      r[k] = r[k] == null ? c.text : `${r[k]} ${c.text}`;
    });
    return r;
  });
  // Key → definition tables (the usual kind): a row starts where the first
  // column has text, and lines with nothing there carry on the row above.
  // A first-column line in lower case only carries on when it sits as close
  // as wrapped text does (a key that wraps: "Programa, proceso," then
  // "servicio"), clearly closer than rows sit to each other.
  const step = (k: number) => slice[k].mid - slice[k - 1].mid;
  const allSteps = slice.slice(1).map((_, k) => step(k + 1));
  const tight = Math.min(...allSteps);
  const wide = Math.max(...allSteps);
  const wrapped = (k: number) => k > 0 && step(k) < tight * 1.2 && step(k) < wide * 0.75;
  const keyWraps = rows.some((r, k) => r[0] != null && CONT.test(r[0]) && wrapped(k));
  if (cols >= 2 && rows.some((r) => r[0] != null) && (keyWraps || rows.some((r) => r[0] == null))) {
    const out: (string | null)[][] = [];
    rows.forEach((r, k) => {
      const fresh = r[0] != null && !(CONT.test(r[0]) && wrapped(k));
      if (fresh || !out.length) out.push([...r]);
      else
        r.forEach((x, c) => {
          const row = out[out.length - 1];
          if (x != null) row[c] = row[c] == null ? x : `${row[c]} ${x}`;
        });
    });
    return [out.map((r) => r.map((x) => x ?? ""))];
  }
  const steps = slice.slice(1).map((l, k) => l.mid - slice[k].mid);
  // The normal step between lines of one cell = a short one (lower quartile).
  const base = [...steps].sort((x, y) => x - y)[Math.floor((steps.length - 1) * 0.25)] || 1;
  const gap = (k: number) => k > 0 && steps[k - 1] > base * 1.45 && steps[k - 1] > slice[k].fs * 1.6;
  const uneven = rows.some((r) => r.some((x) => x == null)) || rows.some((r) => r.some((x) => x != null && CONT.test(x)));
  const anyGap = slice.some((_, k) => gap(k));
  const wraps = rows.some((r) => r.some((x) => x != null && CONT.test(x)));
  // Evenly spaced lines with no text wrapping into the next: one row per
  // line, even if some cells are empty.
  if ((!uneven || !wraps) && !anyGap) return [rows.map((r) => r.map((x) => x ?? ""))];
  const bands: number[][] = [];
  slice.forEach((_, k) => {
    if (!bands.length || gap(k)) bands.push([]);
    bands[bands.length - 1].push(k);
  });
  // A one-line header and then rows of multi-line cells: a normal table.
  if (bands.length >= 2 && bands[0].length === 1) {
    return [bands.map((ks) => Array.from({ length: cols }, (_, c) => ks.map((k) => rows[k][c]).filter((x): x is string => x != null).join(" ")))];
  }
  const tables: string[][][] = [];
  let plain: string[][] | null = null;
  for (const ks of bands) {
    const per = Array.from({ length: cols }, (_, c) => ks.map((k) => rows[k][c]).filter((x): x is string => x != null));
    const head = ks.length >= 2 && per.every((a) => a.length >= 2 && a[0].length <= 45 && !/[.!?;]$/.test(a[0]));
    if (head) {
      plain = null;
      tables.push([per.map((a) => a[0]), per.map((a) => a.slice(1).join(" "))]);
    } else {
      if (!plain) {
        plain = [];
        tables.push(plain);
      }
      plain.push(per.map((a) => a.join(" ")));
    }
  }
  return tables;
}

const levelOf = (ratio: number) => (ratio >= 1.6 ? "h1" : ratio >= 1.3 ? "h2" : "h3");

// The selection in pieces, each with its kind.
function segment(lines: Line[], body: number): Segment[] {
  const out: Segment[] = [];
  const ratio = (l: Line) => (body ? l.fs / body : 1);
  const isHead = (l: Line) => ratio(l) >= 1.12 && l.text.length <= 140;
  const isItem = (l: Line) => BULLET.test(l.text) || NUMBERED.test(l.text);
  // A table starts on a line with 2+ columns when another such line follows,
  // maybe after a few lines that only carry on a later column's text.
  const startsTable = (k: number) => {
    const l = lines[k];
    if (!l || l.cells.length < 2) return false;
    for (let j = k + 1; j < Math.min(lines.length, k + 5); j++) {
      const n = lines[j];
      if (n.cells.length >= 2) return true;
      const under = l.cells.slice(1).some((c) => Math.abs(n.cells[0].left - c.left) < l.fs * 0.6);
      if (!under || n.mid - lines[j - 1].mid > n.fs * 2.2) return false;
    }
    return false;
  };
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (isHead(l)) {
      let j = i + 1;
      while (j < lines.length && isHead(lines[j]) && Math.abs(lines[j].fs - l.fs) < l.fs * 0.1) j++;
      out.push({ type: levelOf(ratio(l)), text: lines.slice(i, j).map((x) => x.text).join(" ") });
      i = j;
    } else if (isItem(l)) {
      let j = i;
      const items: string[] = [];
      const numbered = NUMBERED.test(l.text);
      // Same kind of marker throughout: "•" then "1." are two lists.
      while (j < lines.length && !isHead(lines[j]) && (isItem(lines[j]) ? NUMBERED.test(lines[j].text) === numbered : items.length && lines[j].cells.length < 2)) {
        const clean = lines[j].text.replace(BULLET, "").replace(NUMBERED, "");
        if (isItem(lines[j])) items.push(clean);
        else items[items.length - 1] += ` ${clean}`;
        j++;
      }
      out.push({ type: numbered ? "numbered" : "bullet", items });
      i = j;
    } else if (startsTable(i)) {
      const lefts = l.cells.map((c) => c.left);
      const near = (c: Cell) => l.cells.some((h) => Math.abs(c.left - h.left) < l.fs * 0.45 || (c.left < h.right && c.right > h.left));
      let j = i + 1;
      while (j < lines.length && !isHead(lines[j]) && lines[j].cells.every(near)) {
        if (lines[j].cells.length < 2 && lines[j].mid - lines[j - 1].mid > lines[j].fs * 2.2) break;
        j++;
      }
      tablesFromLines(lines.slice(i, j), lefts).forEach((rows) => out.push({ type: "table", rows }));
      i = j;
    } else {
      // A paragraph: up to a title, a bullet, a table or a big gap.
      let j = i + 1;
      let maxLen = l.text.length;
      // A question ends its own line ("¿Por qué…?" then the answer).
      const endsHere = (k: number) => /\?$/.test(lines[k].text) || (/[.!?:]$/.test(lines[k].text) && lines[k].text.length < maxLen * 0.75);
      while (
        j < lines.length &&
        !isHead(lines[j]) &&
        !isItem(lines[j]) &&
        !startsTable(j) &&
        lines[j].mid - lines[j - 1].mid < lines[j].fs * 1.9 &&
        !endsHere(j - 1)
      ) {
        maxLen = Math.max(maxLen, lines[j].text.length);
        j++;
      }
      const run = lines.slice(i, j);
      const short = run.length >= 3 && run.every((x) => x.text.length <= 80) && run.every((x) => Math.abs(x.cells[0].left - run[0].cells[0].left) < x.fs * 0.5);
      if (short) out.push({ type: "bullet", items: run.map((x) => x.text) }); // short lines lined up: bullets drawn as shapes
      else out.push({ type: "text", text: joinWrapped(run.map((x) => x.text)) });
      i = j;
    }
  }
  return out;
}

// Lines broken by the page width → one paragraph; "infor-" + "mación" → "información".
const joinWrapped = (parts: string[]) => parts.reduce((acc, p) => (acc && /\p{L}-$/u.test(acc) ? acc.slice(0, -1) + p : acc ? `${acc} ${p}` : p), "");

function classify({ mine, body }: { mine: Span[]; body: number }): SelectionInfo | null {
  if (!mine.length) return null;
  const lines = toLines(mine).filter((l) => l.text);
  if (!lines.length) return null;
  const fs = median(lines.map((l) => l.fs));
  return { lines, ratio: body ? fs / body : 1, segments: segment(lines, body) };
}

export const classifySelection = (layer: HTMLElement, sel: Selection) => classify(selectedSpans(layer, sel));
export const classifyArea = (layer: HTMLElement, a: Area) => classify(spansInArea(layer, a));

// The selection pasted as one chosen kind ("auto" keeps each piece's own).
export function toSegments(info: SelectionInfo, kind: Kind): Segment[] {
  const lines = info.lines;
  if (kind === "auto") return info.segments;
  if (kind === "title") return [{ type: levelOf(info.ratio), text: lines.map((l) => l.text).join(" ") }];
  if (kind === "list") {
    const numbered = lines.filter((l) => NUMBERED.test(l.text)).length > lines.length / 2;
    const anyMarked = lines.some((l) => BULLET.test(l.text) || NUMBERED.test(l.text));
    const items: string[] = [];
    for (const l of lines) {
      const marked = BULLET.test(l.text) || NUMBERED.test(l.text);
      const clean = l.text.replace(BULLET, "").replace(NUMBERED, "");
      if (marked || !items.length || !anyMarked) items.push(clean);
      else items[items.length - 1] += ` ${clean}`;
    }
    return [{ type: numbered ? "numbered" : "bullet", items }];
  }
  if (kind === "table") {
    const first = lines.find((l) => l.cells.length >= 2) ?? lines[0];
    return tablesFromLines(lines, first.cells.map((c) => c.left)).map((rows) => ({ type: "table", rows }));
  }
  return [{ type: "text", text: joinWrapped(lines.map((l) => l.text)) }];
}

// Pieces → editor blocks (tiptap JSON), built directly so text that looks
// like Markdown ("- …", "# …") is pasted as written.
type Json = { type: string; attrs?: Record<string, unknown>; content?: Json[]; text?: string };
const para = (text: string): Json => ({ type: "paragraph", content: text ? [{ type: "text", text }] : [] });
const list = (type: string, items: string[]): Json => ({ type, content: items.map((x) => ({ type: "listItem", content: [para(x)] })) });

export function segmentsToDoc(segments: Segment[]): Json[] {
  return segments.map((s): Json => {
    switch (s.type) {
      case "h1":
      case "h2":
      case "h3":
        return { type: "heading", attrs: { level: Number(s.type[1]) }, content: [{ type: "text", text: s.text }] };
      case "bullet":
        return list("bulletList", s.items);
      case "numbered":
        return list("orderedList", s.items);
      case "table": {
        const w = Math.max(...s.rows.map((r) => r.length));
        // A header row has short labels over longer cells ("Actividad | Qué
        // haces"), not a first row of data ("Path y Files | Path es…").
        const header = s.rows.length > 1 && s.rows[0].every((c) => c.length <= 30 && !/[.!?;:]$/.test(c)) && s.rows.slice(1).some((r) => r.some((c) => c.length > 30));
        return {
          type: "table",
          content: s.rows.map((r, k) => ({
            type: "tableRow",
            content: Array.from({ length: w }, (_, c) => ({ type: k === 0 && header ? "tableHeader" : "tableCell", content: [para(r[c] ?? "")] })),
          })),
        };
      }
      default:
        return para(s.text);
    }
  });
}

// Measured pieces → pieces of note (for tests, and whole pages).
export const segmentsFromSpans = (spans: Span[], body: number): Segment[] => (spans.length ? segment(toLines(spans), body) : []);
