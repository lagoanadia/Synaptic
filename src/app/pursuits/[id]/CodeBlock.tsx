import { CopyButton } from "./CopyButton";

// A long line wraps to fit the note's own width instead of forcing
// horizontal scroll — a note card is often narrower than a comfortable
// line of code, and scrolling sideways to read it is worse than a wrapped
// line. Each logical line is its own flex row (number + content) so a
// wrapped line's number still lines up with where that line started,
// instead of a plain line-by-line counter going out of sync.
//
// <details open> gives the collapse/expand for free, with no JS and full
// keyboard/screen-reader support — only the Copy button needs a client
// component at all.
export function CodeBlock({ code }: { code: string }) {
  const lines = code.split("\n");
  const gutterWidth = `${String(lines.length).length + 1}ch`;

  return (
    <details
      open
      className="overflow-hidden rounded-lg border border-black/10 bg-[#1e1e1e] text-white"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 border-b border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/60 [&::-webkit-details-marker]:hidden">
        <span>
          Code · {lines.length} line{lines.length === 1 ? "" : "s"}
        </span>
        <CopyButton text={code} />
      </summary>
      <pre className="px-4 py-3 text-[13px] leading-6">
        <code className="block">
          {lines.map((line, i) => (
            <div key={i} className="flex gap-3">
              <span
                aria-hidden="true"
                className="shrink-0 select-none text-right text-white/30"
                style={{ width: gutterWidth }}
              >
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">
                {line.length ? line : " "}
              </span>
            </div>
          ))}
        </code>
      </pre>
    </details>
  );
}
