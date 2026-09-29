import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import { parseNoteBlocks, type InlineNode, type NoteBlock } from "@/lib/text";

// A4 in points (pdf-lib's unit), origin bottom-left.
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 56;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const BODY_SIZE = 11;
const LINE_GAP = 5;

type Fonts = {
  regular: PDFFont;
  bold: PDFFont;
  italic: PDFFont;
  mono: PDFFont;
};

type Token = {
  text: string;
  font: PDFFont;
  size: number;
  color?: { r: number; g: number; b: number };
};

// Walks the same NoteBlock[] RichContent renders in the app, but drawing
// onto real PDF pages instead of DOM nodes -- this is what turns an
// Organized note or Brain Dump into an actual file Classroom can accept
// as a submission (Classroom attaches a Drive file, not raw HTML).
// Deliberately plainer than the web rendering (no real table grid, no
// underline stroke, no clickable links) -- a teacher grading a submission
// needs to read it, not see a pixel-perfect copy of the app.
class PdfCursor {
  doc: PDFDocument;
  page!: PDFPage;
  y = 0;

  constructor(doc: PDFDocument) {
    this.doc = doc;
    this.newPage();
  }

  newPage() {
    this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.y = PAGE_HEIGHT - MARGIN;
  }

  ensureSpace(height: number) {
    if (this.y - height < MARGIN) this.newPage();
  }

  spacer(height: number) {
    this.y -= height;
  }

  // Greedy word-wrap across a run of styled tokens (so a bold word can sit
  // on the same visual line as plain text around it), drawing each
  // wrapped line and advancing the cursor as it goes.
  drawTokens(tokens: Token[], indent = 0) {
    const maxWidth = CONTENT_WIDTH - indent;
    let line: Token[] = [];
    let lineWidth = 0;

    const flush = () => {
      if (line.length === 0) return;
      const size = Math.max(...line.map((t) => t.size));
      this.ensureSpace(size + LINE_GAP);
      let x = MARGIN + indent;
      for (const t of line) {
        this.page.drawText(t.text, {
          x,
          y: this.y,
          size: t.size,
          font: t.font,
          color: t.color ? rgb(t.color.r, t.color.g, t.color.b) : rgb(0.05, 0.05, 0.05),
        });
        x += t.font.widthOfTextAtSize(t.text, t.size);
      }
      this.y -= size + LINE_GAP;
      line = [];
      lineWidth = 0;
    };

    for (const token of tokens) {
      for (const rawWord of token.text.split(/(\s+)/).filter((w) => w !== "")) {
        const word = safeForFont(token.font, rawWord);
        const width = token.font.widthOfTextAtSize(word, token.size);
        if (word.trim() !== "" && lineWidth + width > maxWidth && line.length > 0) {
          flush();
        }
        line.push({ ...token, text: word });
        lineWidth += width;
      }
    }
    flush();
  }
}

// pdf-lib's standard fonts only support the WinAnsi charset (~Windows-1252
// -- covers plain ASCII, Spanish accents/ñ/¿/¡, and a handful of "smart"
// punctuation like •/—/'', but not emoji or most symbol/dingbat glyphs).
// Anything outside that throws deep inside pdf-lib the moment its width is
// measured -- one stray emoji typed into a note would otherwise crash the
// whole PDF (and with it, the whole Classroom turn-in) instead of just
// rendering oddly in that one spot.
function safeForFont(font: PDFFont, text: string): string {
  try {
    font.widthOfTextAtSize(text, 10);
    return text;
  } catch {
    return Array.from(text)
      .map((ch) => {
        try {
          font.widthOfTextAtSize(ch, 10);
          return ch;
        } catch {
          return "?";
        }
      })
      .join("");
  }
}

function inlineToPlainText(nodes: InlineNode[]): string {
  return nodes.map((n) => (n.type === "link" ? n.text : n.value)).join("");
}

function inlineToTokens(nodes: InlineNode[], fonts: Fonts, size = BODY_SIZE): Token[] {
  return nodes.map((n) => {
    switch (n.type) {
      case "bold":
        return { text: n.value, font: fonts.bold, size };
      case "italic":
        return { text: n.value, font: fonts.italic, size };
      case "underline":
        // pdf-lib has no built-in text-decoration -- plain text is a fine
        // simplification here, the content matters more than the styling.
        return { text: n.value, font: fonts.regular, size };
      case "link":
        return { text: n.text, font: fonts.regular, size, color: { r: 0.1, g: 0.4, b: 0.85 } };
      case "text":
        return { text: n.value, font: fonts.regular, size };
    }
  });
}

const HEADING_SIZE = { 1: 18, 2: 15, 3: 13 } as const;

async function drawImage(cursor: PdfCursor, url: string) {
  try {
    // Attachment URLs are public Vercel Blob links (same ones the app's
    // own <img> tags point at) -- a plain fetch is enough, no auth needed.
    const res = await fetch(url);
    if (!res.ok) return;
    const bytes = new Uint8Array(await res.arrayBuffer());
    const contentType = res.headers.get("content-type") ?? "";
    const image = contentType.includes("png")
      ? await cursor.doc.embedPng(bytes)
      : await cursor.doc.embedJpg(bytes);

    let width = image.width;
    let height = image.height;
    const widthScale = CONTENT_WIDTH / width;
    if (widthScale < 1) {
      width *= widthScale;
      height *= widthScale;
    }
    const maxHeight = PAGE_HEIGHT - MARGIN * 2;
    if (height > maxHeight) {
      const shrink = maxHeight / height;
      width *= shrink;
      height *= shrink;
    }

    cursor.ensureSpace(height);
    cursor.page.drawImage(image, { x: MARGIN, y: cursor.y - height, width, height });
    cursor.y -= height + 8;
  } catch {
    // A broken/unreachable image shouldn't fail the whole PDF -- skip it
    // and keep going with the rest of the note.
  }
}

async function drawBlock(cursor: PdfCursor, fonts: Fonts, block: NoteBlock) {
  switch (block.type) {
    case "heading": {
      const size = HEADING_SIZE[block.level];
      cursor.spacer(6);
      cursor.drawTokens(
        inlineToTokens(block.inline, fonts, size).map((t) => ({ ...t, font: fonts.bold })),
      );
      cursor.spacer(4);
      return;
    }
    case "callout": {
      cursor.drawTokens([
        { text: "▤ ", font: fonts.regular, size: BODY_SIZE },
        ...inlineToTokens(block.inline, fonts),
      ]);
      cursor.spacer(4);
      return;
    }
    case "bulletList":
    case "numberedList":
    case "letteredList": {
      block.items.forEach((item, i) => {
        const marker =
          block.type === "bulletList"
            ? "•"
            : block.type === "numberedList"
              ? `${i + 1}.`
              : `${String.fromCharCode(97 + (i % 26))}.`;
        cursor.drawTokens(
          [{ text: `${marker} `, font: fonts.regular, size: BODY_SIZE }, ...inlineToTokens(item, fonts)],
          14,
        );
      });
      cursor.spacer(4);
      return;
    }
    case "table": {
      const rowText = (cells: InlineNode[][]) => cells.map(inlineToPlainText).join("  |  ");
      cursor.drawTokens([{ text: rowText(block.header), font: fonts.bold, size: BODY_SIZE }]);
      for (const row of block.rows) {
        cursor.drawTokens([{ text: rowText(row), font: fonts.regular, size: BODY_SIZE }]);
      }
      cursor.spacer(4);
      return;
    }
    case "codeBlock": {
      const size = 9.5;
      for (const line of block.code.split("\n")) {
        cursor.drawTokens([{ text: line, font: fonts.mono, size }]);
      }
      cursor.spacer(6);
      return;
    }
    case "image":
      await drawImage(cursor, block.url);
      return;
    case "paragraph":
      cursor.drawTokens(inlineToTokens(block.inline, fonts));
      cursor.spacer(6);
      return;
  }
}

// Renders a note/dump's plain-text content (the same syntax RichContent
// interprets) into a real downloadable PDF -- used both for turning work
// in to Classroom (which needs a Drive file to attach, not just a printed
// browser tab) and could back a "download as PDF" button later.
export async function renderNotePdf(title: string, content: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fonts: Fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    italic: await doc.embedFont(StandardFonts.HelveticaOblique),
    mono: await doc.embedFont(StandardFonts.Courier),
  };

  const cursor = new PdfCursor(doc);
  cursor.drawTokens([{ text: title, font: fonts.bold, size: 16 }]);
  cursor.spacer(10);

  for (const block of parseNoteBlocks(content)) {
    await drawBlock(cursor, fonts, block);
  }

  return doc.save();
}
