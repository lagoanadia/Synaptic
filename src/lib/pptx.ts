import { unzipSync, strFromU8 } from "fflate";

// XML text → plain text: CDATA, numeric and the common named entities.
const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
export function decode(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}

// Reading a .pptx (a zip of XML files) in the browser: one entry per
// slide, with its text paragraphs and the speaker notes. Images and
// layout are ignored — this is about the content.

export type Slide = { n: number; title: string; lines: string[]; notes: string };

// The text paragraphs of one slide/notes XML file, in order. In
// DrawingML every paragraph is an <a:p> and every run of text an <a:t>.
export function slideLines(xml: string): string[] {
  return (xml.match(/<a:p[\s>][\s\S]*?<\/a:p>/g) ?? [])
    .map((p) =>
      (p.match(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g) ?? [])
        .map((t) => decode(t.replace(/<\/?a:t[^>]*>/g, "")))
        .join("")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean);
}

// Speaker notes repeat the slide number in their own placeholder; drop
// lines that are just a number.
const notesText = (xml: string) => slideLines(xml).filter((l) => !/^\d+$/.test(l)).join(" ");

export function readPptx(data: Uint8Array): Slide[] {
  const files = unzipSync(data, { filter: (f) => /^ppt\/(slides|notesSlides)\/\w+\.xml$/.test(f.name) });
  const num = (name: string) => Number(name.match(/(\d+)\.xml$/)?.[1] ?? 0);
  return Object.keys(files)
    .filter((name) => name.startsWith("ppt/slides/"))
    .sort((a, b) => num(a) - num(b))
    .map((name) => {
      const n = num(name);
      const lines = slideLines(strFromU8(files[name]));
      const notesFile = files[`ppt/notesSlides/notesSlide${n}.xml`];
      return { n, title: lines[0] ?? "", lines: lines.slice(1), notes: notesFile ? notesText(strFromU8(notesFile)) : "" };
    })
    .filter((s) => s.title || s.lines.length || s.notes);
}

// As a page in the app's text format: a heading per slide, bullets, and
// the speaker notes as a callout.
export function slidesToText(slides: Slide[], deckTitle?: string): string {
  const parts = slides.map((s) => {
    const out = [`## ${s.title || `Slide ${s.n}`}`];
    if (s.lines.length) out.push(s.lines.map((l) => `- ${l}`).join("\n"));
    if (s.notes) out.push(`! ${s.notes}`);
    return out.join("\n\n");
  });
  return [deckTitle ? `# ${deckTitle}` : "", ...parts].filter(Boolean).join("\n\n");
}
