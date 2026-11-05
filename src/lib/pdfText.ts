"use client";

// The text layer of a PDF, page by page ("[p3] ..."), read in the
// browser. Scanned PDFs have no text layer and come back nearly empty.
export async function pdfToText(file: File, maxChars = 60000): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  let out = "";
  for (let n = 1; n <= pdf.numPages && out.length < maxChars; n++) {
    const content = await (await pdf.getPage(n)).getTextContent();
    const text = content.items.map((i) => ("str" in i ? i.str : "")).join(" ").replace(/\s+/g, " ");
    out += `[p${n}] ${text}\n\n`;
  }
  return out.slice(0, maxChars);
}
