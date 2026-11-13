import { describe, expect, it } from "vitest";
import { mergeAdditions } from "./mergeNote";

const note = "# Redes\n\n## Direcciones\n- 127.0.0.1: localhost\n\n## Puertos\nIdentifican el programa.";

describe("mergeAdditions", () => {
  it("adds under the named section and keeps everything else as is", () => {
    const out = mergeAdditions(note, [{ under: "Direcciones", text: "- 0.0.0.0: cualquier interfaz" }]);
    expect(out).toBe("# Redes\n\n## Direcciones\n- 127.0.0.1: localhost\n\n- 0.0.0.0: cualquier interfaz\n\n## Puertos\nIdentifican el programa.");
  });
  it("appends what has no matching section at the end", () => {
    const out = mergeAdditions(note, [{ under: null, text: "## Sockets\nCruzan máquinas." }, { under: "No existe", text: "Otra cosa" }]);
    expect(out.startsWith(note)).toBe(true);
    expect(out.endsWith("## Sockets\nCruzan máquinas.\n\nOtra cosa")).toBe(true);
  });
});
