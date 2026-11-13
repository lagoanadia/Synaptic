import { parseNoteBlocks, type InlineNode, type ListBlock, type NoteBlock } from "@/lib/text";

// Export a page to PDF in Synaptic's look, with the reader's choice of
// letter, colour, rounding and table stripes. One HTML sheet serves the
// preview and the print (the browser's "Save as PDF").

export const FONTS = { inter: "'Inter', system-ui, sans-serif", lora: "'Lora', Georgia, serif", mono: "ui-monospace, Menlo, Consolas, monospace" } as const;
export type FontKey = keyof typeof FONTS;
export const COLORS = ["#2383e2", "#e0457b", "#2fa36b", "#e8912d", "#8b5cf6", "#37352f"] as const;
export const RADII = [0, 8, 16] as const;
export type SheetStyle = { font: FontKey; color: string; radius: number; stripes: boolean };
export const DEFAULT_STYLE: SheetStyle = { font: "inter", color: "#2383e2", radius: 8, stripes: true };

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function inline(nodes: InlineNode[]): string {
  return nodes
    .map((n) => {
      if (n.type === "link") return `<a href="${esc(n.url)}">${esc(n.text)}</a>`;
      const v = esc(n.value);
      return n.type === "bold" ? `<b>${v}</b>` : n.type === "italic" ? `<i>${v}</i>` : n.type === "underline" ? `<u>${v}</u>` : v;
    })
    .join("");
}

function list(b: ListBlock): string {
  const tag = b.type === "bulletList" ? "ul" : "ol";
  const attrs = b.type === "letteredList" ? ' type="a"' : b.type === "numberedList" && b.start && b.start > 1 ? ` start="${b.start}"` : "";
  return `<${tag}${attrs} class="x-list">${b.items.map((it) => `<li>${inline(it.inline)}${it.children.map(list).join("")}</li>`).join("")}</${tag}>`;
}

function block(b: NoteBlock): string {
  switch (b.type) {
    case "heading":
      return `<h${b.level} class="x-h${b.level}">${inline(b.inline)}</h${b.level}>`;
    case "callout":
      return `<div class="x-b x-callout">${inline(b.inline)}</div>`;
    case "paragraph":
      return `<p class="x-text">${inline(b.inline)}</p>`;
    case "image":
      return `<div class="x-b"><img class="x-img" src="${esc(b.url)}" alt=""></div>`;
    case "table":
      return `<div class="x-b"><table class="x-table">${b.header.length ? `<tr>${b.header.map((c) => `<th>${inline(c)}</th>`).join("")}</tr>` : ""}${b.rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</table></div>`;
    case "codeBlock":
      return `<div class="x-b x-code">${b.language ? `<span class="x-lang">${esc(b.language)}</span>` : ""}${esc(b.code)}</div>`;
    default:
      return "type" in b && (b.type === "bulletList" || b.type === "numberedList" || b.type === "letteredList") ? `<div class="x-b-list">${list(b as ListBlock)}</div>` : "";
  }
}

export function sheetHtml(title: string, content: string): string {
  return `<div class="x-sheet"><div class="x-head"><i></i>Synaptic</div><h1 class="x-title">${esc(title)}</h1>${parseNoteBlocks(content).map(block).join("")}</div>`;
}

export function sheetCss(st: SheetStyle): string {
  const r = st.radius;
  return `
.x-sheet { font-family: ${FONTS[st.font]}; color: #37352f; font-size: 13px; line-height: 1.65; --c: ${st.color}; --r: ${r}px; overflow-wrap: anywhere; }
.x-sheet * { box-sizing: border-box; }
.x-head { font-size: 10.5px; color: #8a8986; display: flex; align-items: center; gap: 7px; margin-bottom: 10px; letter-spacing: .02em; }
.x-head i { width: 9px; height: 9px; border-radius: 50%; background: var(--c); display: inline-block; }
.x-title { font-size: 28px; font-weight: 700; line-height: 1.2; margin: 0 0 16px; letter-spacing: -0.01em; }
.x-b, .x-b-list { break-inside: avoid; margin: 0 0 10px; }
.x-h1 { font-size: 21px; font-weight: 700; margin: 22px 0 8px; break-after: avoid; }
.x-h2 { font-size: 17px; font-weight: 700; color: var(--c); margin: 18px 0 6px; break-after: avoid; }
.x-h3 { font-size: 14.5px; font-weight: 700; margin: 14px 0 4px; break-after: avoid; }
.x-text { margin: 0 0 8px; orphans: 3; widows: 3; }
.x-list { margin: 0; padding-left: 22px; } .x-list li { margin: 2px 0; } .x-list li::marker { color: var(--c); font-weight: 700; }
.x-callout { background: color-mix(in srgb, var(--c) 10%, #fff); border-left: 4px solid var(--c); border-radius: ${Math.max(r - 2, 0)}px; padding: 10px 14px; }
.x-code { background: #1e1e1e; color: #e6e6e6; border-radius: ${Math.max(r - 2, 0)}px; padding: 12px 14px; font: 11.5px/1.55 ui-monospace, Menlo, Consolas, monospace; white-space: pre-wrap; }
.x-lang { display: block; font: 600 9.5px system-ui, sans-serif; color: #9a9a9a; margin-bottom: 6px; text-transform: uppercase; letter-spacing: .06em; }
.x-table { width: 100%; border-collapse: separate; border-spacing: 0; border: 1.5px solid color-mix(in srgb, var(--c) 35%, #fff); border-radius: var(--r); overflow: hidden; font-size: 12.5px; }
.x-table th { background: var(--c); color: #fff; text-align: left; font-weight: 600; padding: 8px 12px; }
.x-table td { padding: 8px 12px; vertical-align: top; }
.x-table tr { break-inside: avoid; }
${st.stripes ? ".x-table tr:nth-child(even) td { background: color-mix(in srgb, var(--c) 7%, #fff); }" : ""}
.x-table td + td, .x-table th + th { border-left: 1px solid color-mix(in srgb, var(--c) 18%, #fff); }
.x-table tr + tr td { border-top: 1px solid color-mix(in srgb, var(--c) 18%, #fff); }
.x-img { max-width: 100%; max-height: 420px; border-radius: var(--r); display: block; margin: 0 auto; }
.x-sheet a { color: var(--c); }`;
}

// Prints the sheet from a hidden frame. The 20 mm margins come from an empty
// header/footer that repeat on every page, so @page can be margin 0 and the
// browser adds no date, URL or page title.
export async function printSheet(html: string, st: SheetStyle, title: string) {
  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  document.body.appendChild(frame);
  const d = frame.contentDocument!;
  d.open();
  d.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Lora:wght@400;700&display=swap" rel="stylesheet">
<style>@page { size: A4; margin: 0; } html, body { margin: 0; background: #fff; } * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.pg { width: 100%; border-collapse: collapse; } .pg td { padding: 0; } .sp { height: 20mm; } .pg-in { padding: 0 20mm; }
${sheetCss(st)}</style></head><body><table class="pg"><thead><tr><td><div class="sp"></div></td></tr></thead><tbody><tr><td><div class="pg-in">${html}</div></td></tr></tbody><tfoot><tr><td><div class="sp"></div></td></tr></tfoot></table></body></html>`);
  d.close();
  await Promise.race([d.fonts.ready, new Promise((r) => setTimeout(r, 2500))]).catch(() => {});
  await Promise.all([...d.images].map((img) => (img.complete ? null : new Promise((r) => { img.onload = img.onerror = r; setTimeout(r, 4000); }))));
  frame.contentWindow!.focus();
  frame.contentWindow!.print();
  setTimeout(() => frame.remove(), 60000);
}
