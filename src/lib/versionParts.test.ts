import { describe, expect, it } from "vitest";
import { blocks, compose, defaultChoices, pairParts, sections } from "./versionParts";

const organized = `## Ficheros
- **Path**: la dirección de un fichero. **Files**: las operaciones.
- **try-with-resources** cierra el recurso solo.

## Errores y codificación
- Las excepciones se capturan de la más concreta a la más general.
- Codificación equivocada: sale XoÃ¡n.`;

const original = `ficheros: guardar datos que sobrevivan
Path = dirección, Files = operaciones

excepciones de la mas concreta a la mas general
codificación UTF-8 vs ISO, sale XoÃ¡n (¡me lo preguntó en el oral!)

repasar el viernes`;

describe("version parts", () => {
  it("splits by headings and paragraphs", () => {
    expect(sections(organized)).toHaveLength(2);
    expect(blocks(original)).toHaveLength(3);
  });

  it("pairs each section with the notes about it", () => {
    const parts = pairParts(original, organized);
    expect(parts).toHaveLength(2);
    expect(parts[0].mine).toContain("Path = dirección");
    expect(parts[1].mine).toContain("me lo preguntó");
    // A line about nothing in particular stays with the one before it.
    expect(parts[1].mine).toContain("repasar el viernes");
  });

  it("composes the picked parts in order", () => {
    const parts = pairParts(original, organized);
    const text = compose(parts, ["ia", "mine"]);
    expect(text.startsWith("## Ficheros")).toBe(true);
    expect(text).toContain("me lo preguntó");
    expect(text).not.toContain("Las excepciones se capturan");
    expect(defaultChoices([{ ia: "", mine: "x" }, { ia: "y", mine: "" }])).toEqual(["mine", "ia"]);
  });
});
