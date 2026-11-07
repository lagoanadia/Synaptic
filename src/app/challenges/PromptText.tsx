// A challenge's task, readable: paragraphs, "- " lists, **bold**, `code`
// inline, and code blocks (```…```) dark like the editor. Older tasks have
// the example glued to the prose ("Example: f(…) ⇒ 2"); that part is pulled
// out into its own code block.

type Block = { kind: "text"; text: string } | { kind: "list"; items: string[] } | { kind: "code"; text: string };

const EXAMPLE = /\s*(?:Example|Ejemplo|Ejemplos?)\s*:\s*([\s\S]+)$/i;
const looksLikeCode = (line: string) => /\w+\(.*\)\s*(?:=>|⇒|→|->)/.test(line) || /^\s*(?:def |function |const |return )/.test(line);

export function parsePrompt(prompt: string): Block[] {
  const blocks: Block[] = [];
  const parts = prompt.split(/```[a-z]*\n?([\s\S]*?)```/g);
  parts.forEach((part, i) => {
    if (i % 2 === 1) {
      if (part.trim()) blocks.push({ kind: "code", text: part.trimEnd() });
      return;
    }
    for (const para of part.split(/\n{2,}/)) {
      const lines = para.split("\n").filter((l) => l.trim());
      if (!lines.length) continue;
      if (lines.every((l) => /^\s*[-•*]\s+/.test(l))) {
        blocks.push({ kind: "list", items: lines.map((l) => l.replace(/^\s*[-•*]\s+/, "")) });
        continue;
      }
      const text = lines.join("\n");
      const ex = EXAMPLE.exec(text);
      if (!(ex && ex.index > 0) && lines.every(looksLikeCode)) {
        blocks.push({ kind: "code", text });
        continue;
      }
      if (ex && looksLikeCode(ex[1])) {
        const before = text.slice(0, ex.index).trim();
        if (before) blocks.push({ kind: "text", text: before });
        blocks.push({ kind: "code", text: ex[1].trim() });
      } else blocks.push({ kind: "text", text });
    }
  });
  return blocks;
}

function Inline({ text }: { text: string }) {
  return (
    <>
      {text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).map((t, i) =>
        t.startsWith("`") && t.endsWith("`") && t.length > 2 ? (
          <code key={i} className="rounded bg-chip px-1.5 py-0.5 font-mono text-[13px]">
            {t.slice(1, -1)}
          </code>
        ) : t.startsWith("**") && t.endsWith("**") && t.length > 4 ? (
          <b key={i}>{t.slice(2, -2)}</b>
        ) : (
          t
        ),
      )}
    </>
  );
}

export function PromptText({ prompt }: { prompt: string }) {
  return (
    <div className="flex flex-col gap-3 text-[15px] leading-relaxed">
      {parsePrompt(prompt).map((b, i) =>
        b.kind === "code" ? (
          <pre key={i} className="overflow-x-auto rounded-lg bg-[#141417] px-3.5 py-2.5 font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap text-[#e4e4e7]">
            {b.text}
          </pre>
        ) : b.kind === "list" ? (
          <ul key={i} className="flex list-disc flex-col gap-1 pl-5">
            {b.items.map((it, j) => (
              <li key={j}>
                <Inline text={it} />
              </li>
            ))}
          </ul>
        ) : (
          <p key={i} className="whitespace-pre-line">
            <Inline text={b.text} />
          </p>
        ),
      )}
    </div>
  );
}
