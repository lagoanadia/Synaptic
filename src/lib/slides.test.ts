import { describe, expect, it } from "vitest";
import { slideSourceFor } from "./slides";

describe("slideSourceFor", () => {
  it("opens Google Slides as a PDF, with Google's viewer as fallback", () => {
    expect(slideSourceFor("https://docs.google.com/presentation/d/abc-123_X/edit#slide=id.p")).toEqual({
      kind: "pdf",
      src: "/api/drive/abc-123_X",
      fallback: "https://docs.google.com/presentation/d/abc-123_X/embed?rm=minimal",
    });
  });
  it("reads Drive files from Classroom links, with Google's preview as fallback", () => {
    expect(slideSourceFor("https://drive.google.com/file/d/1AbC/view?usp=drive_web")).toEqual({
      kind: "pdf",
      src: "/api/drive/1AbC",
      fallback: "https://drive.google.com/file/d/1AbC/preview",
    });
    const open = slideSourceFor("https://drive.google.com/open?id=XyZ");
    expect(open?.kind === "pdf" && open.fallback).toBe("https://drive.google.com/file/d/XyZ/preview");
  });
  it("uses the Office viewer for pptx and pdf.js for pdf", () => {
    const pptx = slideSourceFor("https://x.public.blob.vercel-storage.com/ud1-abc.pptx");
    expect(pptx?.src).toBe(
      "https://view.officeapps.live.com/op/embed.aspx?src=https%3A%2F%2Fx.public.blob.vercel-storage.com%2Fud1-abc.pptx",
    );
    expect(slideSourceFor("https://x.dev/deck.PDF")).toEqual({ kind: "pdf", src: "https://x.dev/deck.PDF" });
  });
  it("rejects anything else", () => {
    expect(slideSourceFor("http://drive.google.com/file/d/1/view")).toBeNull();
    expect(slideSourceFor("javascript:alert(1)")).toBeNull();
    expect(slideSourceFor("https://example.com/page")).toBeNull();
    expect(slideSourceFor("not a url")).toBeNull();
  });
});

import { isSlideTitle, unitCode } from "./slides";

describe("unitCode", () => {
  it("reads the unit from file and unit names", () => {
    expect(unitCode("PSP-UD2_cuaderno-de-actividades.pdf")).toBe("UD2");
    expect(unitCode("PSP-UD1-T3_processbuilder.pptx")).toBe("UD1");
    expect(unitCode("U1")).toBe("UD1");
    expect(unitCode("Tema 03 Hilos")).toBe("UD3");
    expect(unitCode("Unidad 12")).toBe("UD12");
    expect(unitCode("Calculo.java")).toBeNull();
  });
});

describe("isSlideTitle", () => {
  it("keeps presentations, PDFs and Google files only", () => {
    expect(isSlideTitle("UD1.pptx")).toBe(true);
    expect(isSlideTitle("Apuntes.pdf")).toBe(true);
    expect(isSlideTitle("Presentación de Google")).toBe(true);
    expect(isSlideTitle("lectura.docx")).toBe(false);
    expect(isSlideTitle("referencia.zip")).toBe(false);
    expect(isSlideTitle("Calculo.java")).toBe(false);
  });
});
