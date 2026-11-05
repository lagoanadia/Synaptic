import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import { readPptx, slideLines, slidesToText } from "./pptx";

const slide = (...paras: string[][]) =>
  `<p:sld><p:cSld><p:spTree>${paras
    .map((runs) => `<a:p>${runs.map((r) => `<a:r><a:t>${r}</a:t></a:r>`).join("")}</a:p>`)
    .join("")}</p:spTree></p:cSld></p:sld>`;

describe("pptx", () => {
  it("joins runs into paragraphs and decodes entities", () => {
    expect(slideLines(slide(["Ficheros ", "secuenciales"], ["A &amp; B"], []))).toEqual(["Ficheros secuenciales", "A & B"]);
  });

  it("reads slides in numeric order with their notes", () => {
    const zip = zipSync({
      "ppt/slides/slide10.xml": strToU8(slide(["Ten"])),
      "ppt/slides/slide2.xml": strToU8(slide(["Two"], ["point a"], ["point b"])),
      "ppt/notesSlides/notesSlide2.xml": strToU8(slide(["Say this out loud"], ["2"])),
      "ppt/media/image1.png": strToU8("binary"),
    });
    const slides = readPptx(zip);
    expect(slides.map((s) => s.n)).toEqual([2, 10]);
    expect(slides[0]).toEqual({ n: 2, title: "Two", lines: ["point a", "point b"], notes: "Say this out loud" });
  });

  it("formats slides as a page", () => {
    expect(slidesToText([{ n: 1, title: "Intro", lines: ["a"], notes: "n" }], "UD1")).toBe("# UD1\n\n## Intro\n\n- a\n\n! n");
  });
});
