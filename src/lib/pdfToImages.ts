"use client";

// Renders each PDF page to an image in the browser, so PDFs go through the
// image pipeline (the vision model can't read PDFs).
export async function pdfToImagePages(file: File): Promise<Blob[]> {
  const pdfjsLib = await import("pdfjs-dist");
  // Must match the installed pdfjs-dist version exactly, or every PDF
  // silently fails to load — resolved as a bundled asset (not a CDN URL)
  // so this keeps working offline and never drifts from that version.
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

  const blobs: Blob[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    // Scale 2 renders at roughly double the PDF's native point size —
    // sharp enough for the vision model to read body text, without
    // producing an oversized upload for a typical lecture-slide PDF.
    const viewport = page.getViewport({ scale: 2 });

    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Este navegador no soporta canvas");

    await page.render({ canvasContext: context, viewport }).promise;

    // JPEG at 0.85: text stays legible and pages stay small.
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85),
    );
    if (blob) blobs.push(blob);
  }

  return blobs;
}
