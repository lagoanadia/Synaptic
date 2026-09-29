"use client";

// Client-only: renders each page of a PDF to a PNG Blob in the browser,
// using <canvas> — so a PDF can flow through the exact same "it's an
// image" pipeline the app already has (Blob upload, `![image](url)`
// markers, the Groq vision call in organizeDumps) with no server-side
// PDF handling or schema changes at all. Groq's vision models don't
// accept a PDF as a native input, so turning each page into a picture is
// what actually lets the AI "see" it.
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
    if (!context) throw new Error("Canvas not supported in this browser");

    await page.render({ canvasContext: context, viewport }).promise;

    // JPEG, not PNG: a scanned/lecture-slide page is mostly a white
    // background under text, which PNG (lossless) compresses far worse
    // than a photo — a multi-page PDF at PNG quickly produces several
    // multi-MB uploads, each of which Groq's vision endpoint has to fetch
    // and decode within its own timeout. 0.85 quality keeps text legible
    // at a fraction of the size.
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85),
    );
    if (blob) blobs.push(blob);
  }

  return blobs;
}
