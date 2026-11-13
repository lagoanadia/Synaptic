// Adds new pieces to an organized note without touching what's there:
// each goes at the end of the section whose heading it names (or at the
// end of the note when it names none / one that doesn't exist).
export type Addition = { under: string | null; text: string };

const headingOf = (line: string) => {
  const m = /^(#{1,3})\s+(.*\S)\s*$/.exec(line);
  return m ? { level: m[1].length, text: m[2].replace(/\*\*/g, "").trim().toLowerCase() } : null;
};

export function mergeAdditions(content: string, additions: Addition[]): string {
  let lines = content.replace(/\s+$/, "").split("\n");
  const tail: string[] = [];
  for (const add of additions) {
    const text = add.text.trim();
    if (!text) continue;
    const want = add.under?.replace(/^#+\s*/, "").replace(/\*\*/g, "").trim().toLowerCase();
    const at = want ? lines.findIndex((l) => headingOf(l)?.text === want) : -1;
    if (at < 0) {
      tail.push(text);
      continue;
    }
    const level = headingOf(lines[at])!.level;
    let end = lines.length;
    for (let j = at + 1; j < lines.length; j++) {
      const h = headingOf(lines[j]);
      if (h && h.level <= level) {
        end = j;
        break;
      }
    }
    // Before the section's trailing blank lines.
    while (end > at + 1 && !lines[end - 1].trim()) end--;
    lines = [...lines.slice(0, end), "", text, ...lines.slice(end)];
  }
  const out = lines.join("\n").replace(/\n{3,}/g, "\n\n");
  return tail.length ? `${out}\n\n${tail.join("\n\n")}` : out;
}
