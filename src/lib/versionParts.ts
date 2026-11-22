// "Elegir versión definitiva": the organized page split into its sections,
// each paired with the bits of the student's own notes about the same
// thing, so they can keep the AI's or their own, part by part. Pure.

export type Part = { ia: string; mine: string };
export type Choice = "ia" | "mine";

const HEADING = /^#{1,3}\s/;

// Organized text → sections, each starting at a heading (and what comes
// before the first heading, if anything).
export function sections(body: string): string[] {
  const out: string[][] = [];
  for (const line of body.split("\n")) {
    if (HEADING.test(line) || !out.length) out.push([line]);
    else out[out.length - 1].push(line);
  }
  return out.map((l) => l.join("\n").trim()).filter(Boolean);
}

// The student's text → blocks: paragraphs (split by blank lines) and
// headings start a new one.
export function blocks(body: string): string[] {
  const out: string[][] = [];
  let fresh = true;
  for (const line of body.split("\n")) {
    if (!line.trim()) {
      fresh = true;
      continue;
    }
    if (fresh || HEADING.test(line)) out.push([line]);
    else out[out.length - 1].push(line);
    fresh = false;
  }
  return out.map((l) => l.join("\n").trim()).filter(Boolean);
}

const words = (s: string) =>
  new Set(
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length >= 4),
  );

// Each of the student's blocks goes with the section it shares most words
// with; ones that match nothing stay with the block before them (notes run
// in order), or open their own part when they come first.
export function pairParts(original: string, organized: string): Part[] {
  const secs = sections(organized);
  const own = blocks(original);
  if (!secs.length) return own.length ? [{ ia: "", mine: own.join("\n\n") }] : [];
  const secWords = secs.map(words);
  const mine: string[][] = secs.map(() => []);
  const loose: string[] = [];
  let last = -1;
  for (const b of own) {
    const w = words(b);
    let best = -1;
    let score = 0;
    secWords.forEach((sw, k) => {
      let shared = 0;
      for (const x of w) if (sw.has(x)) shared++;
      const sc = shared / Math.sqrt(w.size * sw.size || 1);
      if (shared > 0 && sc > score) {
        score = sc;
        best = k;
      }
    });
    const k = best >= 0 ? best : last;
    if (k >= 0) mine[k].push(b);
    else loose.push(b);
    if (best >= 0) last = best;
  }
  const parts = secs.map((ia, k) => ({ ia, mine: mine[k].join("\n\n") }));
  return loose.length ? [{ ia: "", mine: loose.join("\n\n") }, ...parts] : parts;
}

// The AI's part where there is one, the student's where the AI has none.
export const defaultChoices = (parts: Part[]): Choice[] => parts.map((p) => (p.ia ? "ia" : "mine"));

export const compose = (parts: Part[], choices: Choice[]) =>
  parts
    .map((p, k) => (choices[k] === "mine" ? p.mine : p.ia).trim())
    .filter(Boolean)
    .join("\n\n");
