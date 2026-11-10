import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { en } from "./en";
import { de } from "./de";

// Every t("…") text in the app needs an English and a German version, so a
// new text never shows up in Spanish for EN/DE users unnoticed.
function keys(dir = "src"): string[] {
  const out = new Set<string>();
  const walk = (d: string) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) {
        if (f !== "generated") walk(p);
      } else if (/\.tsx?$/.test(f) && !f.includes(".test.")) {
        for (const m of readFileSync(p, "utf8").matchAll(/\bt\(\s*"((?:[^"\\]|\\.)*)"/g)) out.add(JSON.parse(`"${m[1]}"`));
      }
    }
  };
  walk(dir);
  return [...out];
}

describe("translations", () => {
  it("every t() text has English and German", () => {
    const all = keys();
    expect(all.filter((k) => !(k in en))).toEqual([]);
    expect(all.filter((k) => !(k in de))).toEqual([]);
  });
});
