import { describe, expect, it } from "vitest";
import { segmentsFromSpans, type Span } from "./pdfSelection";

// A piece of text at (x, y) with letter size fs; width ~ 0.5·fs per letter.
const at = (text: string, x: number, y: number, fs = 14): Span => ({ text, left: x, right: x + text.length * fs * 0.5, top: y, bottom: y + fs, fs });

describe("pdf selection", () => {
  it("reads titles, paragraphs and questions", () => {
    const s = segmentsFromSpans(
      [
        at("Conceptos clave", 90, 0, 30),
        at("Un programa necesita guardar datos que sobrevivan al cerrarlo. Esta unidad va de leer", 90, 60),
        at("y escribir ficheros.", 90, 80),
        at("¿Por qué acceso secuencial?", 90, 120),
        at("Porque hay que revisar todas las filas una vez.", 90, 140),
      ],
      14,
    );
    expect(s).toEqual([
      { type: "h1", text: "Conceptos clave" },
      { type: "text", text: "Un programa necesita guardar datos que sobrevivan al cerrarlo. Esta unidad va de leer y escribir ficheros." },
      { type: "text", text: "¿Por qué acceso secuencial?" },
      { type: "text", text: "Porque hay que revisar todas las filas una vez." },
    ]);
  });

  it("keeps key → definition rows whose text wraps", () => {
    const s = segmentsFromSpans(
      [
        at("Path y Files", 90, 0), at("Path es la dirección de un fichero. Files hace las operaciones: existe, leer,", 270, 0),
        at("copiar, mover.", 270, 22),
        at("try-with-resources", 88, 50), at("Abre un recurso y lo cierra solo, aunque haya un error.", 270, 50),
        at("Codificación", 88, 80), at("Cómo se convierten las letras en bytes. Si te equivocas,", 270, 80),
        at("sale «XoÃ¡n» en vez de «Xoán».", 270, 101),
        at("CSV", 88, 130), at("Texto en columnas separadas por un carácter.", 270, 130),
      ],
      14,
    );
    expect(s).toEqual([
      {
        type: "table",
        rows: [
          ["Path y Files", "Path es la dirección de un fichero. Files hace las operaciones: existe, leer, copiar, mover."],
          ["try-with-resources", "Abre un recurso y lo cierra solo, aunque haya un error."],
          ["Codificación", "Cómo se convierten las letras en bytes. Si te equivocas, sale «XoÃ¡n» en vez de «Xoán»."],
          ["CSV", "Texto en columnas separadas por un carácter."],
        ],
      },
    ]);
  });

  it("lines up centred columns and keeps empty cells", () => {
    const s = segmentsFromSpans(
      [
        at("AD", 115, 0), at("Acceso a Datos", 169, 0), at("UD1 · UD2", 615, 0),
        at("PMDM", 103, 40), at("Programación Multimedia", 169, 40),
        at("SXE", 112, 80), at("Sistemas de Gestión", 169, 80), at("UD1", 615, 80),
      ],
      14,
    );
    expect(s).toEqual([{ type: "table", rows: [["AD", "Acceso a Datos", "UD1 · UD2"], ["PMDM", "Programación Multimedia", ""], ["SXE", "Sistemas de Gestión", "UD1"]] }]);
  });

  it("reads bullets and numbered lists", () => {
    const s = segmentsFromSpans([at("• Código abierto", 90, 0), at("• Licencias como la MIT", 90, 20), at("garantizan esto", 104, 40), at("1. Primero", 90, 70), at("2. Después", 90, 90)], 14);
    expect(s).toEqual([
      { type: "bullet", items: ["Código abierto", "Licencias como la MIT garantizan esto"] },
      { type: "numbered", items: ["Primero", "Después"] },
    ]);
  });
});
