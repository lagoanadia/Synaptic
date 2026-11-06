import { Highlight, themes, type Language } from "prism-react-renderer";
import { CopyButton } from "./CopyButton";

// Languages a `<lang` code block can use; anything else renders plain.
const LANGUAGES: Record<string, { prism: Language; label: string }> = {
  js: { prism: "javascript", label: "JavaScript" },
  javascript: { prism: "javascript", label: "JavaScript" },
  ts: { prism: "typescript", label: "TypeScript" },
  typescript: { prism: "typescript", label: "TypeScript" },
  py: { prism: "python", label: "Python" },
  python: { prism: "python", label: "Python" },
  java: { prism: "java", label: "Java" },
  sql: { prism: "sql", label: "SQL" },
};

// Long lines wrap instead of scrolling sideways. <details open> gives
// collapse/expand without JS.
export function CodeBlock({ code, language }: { code: string; language: string }) {
  const lang = LANGUAGES[language.toLowerCase()];
  const lines = code.split("\n");
  const gutterWidth = `${String(lines.length).length + 1}ch`;

  return (
    <details
      open
      className="-mx-5 overflow-hidden rounded-lg border border-black/10 bg-[#1e1e1e] text-white"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 border-b border-white/10 bg-white/5 px-4 py-1.5 text-xs text-white/60 [&::-webkit-details-marker]:hidden">
        <span>
          {lang ? lang.label : "Código"} · {lines.length} line{lines.length === 1 ? "" : "s"}
        </span>
        <CopyButton text={code} />
      </summary>
      <Highlight theme={themes.vsDark} code={code} language={lang?.prism ?? "plaintext"}>
        {({ tokens, getLineProps, getTokenProps }) => (
          <pre className="px-4 py-3 text-[13px] leading-6">
            <code className="block">
              {tokens.map((lineTokens, i) => {
                const { className, ...lineProps } = getLineProps({ line: lineTokens });
                return (
                  <div key={i} className={`flex gap-3 ${className ?? ""}`} {...lineProps}>
                    <span
                      aria-hidden="true"
                      className="shrink-0 select-none text-right text-white/30"
                      style={{ width: gutterWidth }}
                    >
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">
                      {lineTokens.length === 0
                        ? " "
                        : lineTokens.map((token, key) => {
                            const { className: tokenClassName, ...tokenProps } = getTokenProps({
                              token,
                            });
                            return (
                              <span key={key} className={tokenClassName} {...tokenProps} />
                            );
                          })}
                    </span>
                  </div>
                );
              })}
            </code>
          </pre>
        )}
      </Highlight>
    </details>
  );
}
