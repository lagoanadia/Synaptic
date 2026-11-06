// What the slide panel shows for a URL: Google Slides embed, Drive preview
// (Classroom files), Office viewer for an uploaded .pptx, pdf.js for PDFs.

export type SlideSource = { kind: "iframe"; src: string } | { kind: "pdf"; src: string };

export function slideSourceFor(raw: string): SlideSource | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;

  const slides = url.pathname.match(/^\/presentation\/d\/([\w-]+)/);
  if (url.hostname === "docs.google.com" && slides) {
    return { kind: "iframe", src: `https://docs.google.com/presentation/d/${slides[1]}/embed?rm=minimal` };
  }
  if (url.hostname === "drive.google.com") {
    const id = url.pathname.match(/\/file\/d\/([\w-]+)/)?.[1] ?? url.searchParams.get("id");
    if (id && /^[\w-]+$/.test(id)) return { kind: "iframe", src: `https://drive.google.com/file/d/${id}/preview` };
    return null;
  }
  const path = url.pathname.toLowerCase();
  if (path.endsWith(".pdf")) return { kind: "pdf", src: url.toString() };
  if (path.endsWith(".pptx") || path.endsWith(".ppt")) {
    return { kind: "iframe", src: `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url.toString())}` };
  }
  return null;
}

// Which saved Files look like something the slide panel can show.
export const isSlideFile = (url: string) => slideSourceFor(url) !== null;

// "PSP-UD2_cuaderno.pdf" → "UD2", "Tema 3 - Hilos" → "UD3", "U1 intro" → "UD1".
export function unitCode(name: string): string | null {
  const m = name.match(/(?:^|[^a-z])(?:ud|u|unidad|tema|t)\s*[-_ ]?\s*0*(\d{1,2})(?![\d])/i);
  return m ? `UD${Number(m[1])}` : null;
}

// What counts as slides in a Classroom listing: presentations and PDFs,
// plus Google files (no extension). Not .docx, .zip, .java…
export function isSlideTitle(title: string): boolean {
  const ext = title.match(/\.([a-z0-9]{1,5})$/i)?.[1]?.toLowerCase();
  return !ext || ["ppt", "pptx", "pdf", "key", "odp"].includes(ext);
}
