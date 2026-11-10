"use client";
import { useT } from "@/app/LangProvider";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CardsIcon } from "./icons";
import { MiniNotebook } from "./Covers";
import { searchEverything, type Found, type FoundKind } from "./search/actions";
import { splitHighlighted } from "@/lib/search";
import type { NotebookCover } from "@/lib/covers";

const GROUPS: { kind: FoundKind; label: string }[] = [
  { kind: "folder", label: "Carpetas" },
  { kind: "page", label: "Páginas" },
  { kind: "concept", label: "Conceptos" },
  { kind: "card", label: "Tarjetas" },
];

export const SearchIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.2-4.2" />
  </svg>
);

const KindIcon = ({ kind }: { kind: FoundKind }) =>
  kind === "card" ? (
    <CardsIcon size={16} className="block" />
  ) : kind === "concept" ? (
    <span className="block size-3 rounded-full border-[1.5px] border-[#a0523f]" />
  ) : kind === "folder" ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden>
      <path d="M3 6.5h6l2 2h10V19H3z" />
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden>
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v4h4" />
    </svg>
  );

function Marked({ text }: { text: string }) {
  return (
    <>
      {splitHighlighted(text).map((s, i) =>
        s.highlighted ? (
          <mark key={i} className="rounded-sm bg-[#fbecc4] px-px text-inherit">
            {s.text}
          </mark>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </>
  );
}

// Ctrl+K (⌘K) from anywhere: everything you can open, optionally in one
// notebook. ↑↓ to move, Enter to open, Esc to close.
export function SearchPalette({ open, onClose, notebooks }: { open: boolean; onClose: () => void; notebooks: { id: string; name: string; cover: NotebookCover }[] }) {
  const t = useT();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [scope, setScope] = useState<string | null>(null);
  const [results, setResults] = useState<Found[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const ticket = useRef(0);
  const list = useRef<HTMLDivElement>(null);

  // Ask as you type, keeping only the latest answer.
  useEffect(() => {
    if (!open) return;
    const n = ++ticket.current;
    const timer = window.setTimeout(async () => {
      if (q.trim().length < 2) {
        setResults([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      const r = await searchEverything(q, scope).catch(() => []);
      if (n !== ticket.current) return;
      setResults(r);
      setIndex(0);
      setLoading(false);
    }, 160);
    return () => window.clearTimeout(timer);
  }, [q, scope, open]);

  const ordered = GROUPS.flatMap((g) => results.filter((r) => r.kind === g.kind));

  function go(r: Found | undefined) {
    if (!r) return;
    onClose();
    router.push(r.href);
  }

  useEffect(() => {
    list.current?.querySelector(`[data-i="${index}"]`)?.scrollIntoView({ block: "nearest" });
  }, [index]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-ink/10 px-3 pt-[12vh]" onMouseDown={onClose} role="dialog" aria-label={t("Buscar")}>
      <div
        className="flex max-h-[72vh] w-full max-w-[640px] flex-col overflow-hidden rounded-xl bg-white shadow-[0_0_0_1px_rgba(15,15,15,.05),0_24px_60px_rgba(15,15,15,.22)]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-border-subtle px-4 py-3">
          <span className="text-ink-faint">
            <SearchIcon size={18} />
          </span>
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setIndex((i) => Math.min(i + 1, ordered.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setIndex((i) => Math.max(i - 1, 0));
              } else if (e.key === "Enter") go(ordered[index]);
              else if (e.key === "Escape") onClose();
            }}
            placeholder={t("Buscar páginas, conceptos, tarjetas…")}
            aria-label={t("Buscar")}
            className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink-faint"
          />
          <kbd className="rounded border border-border-subtle px-1.5 py-0.5 text-[11px] text-ink-faint">{t("Esc")}</kbd>
        </div>

        {notebooks.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto px-3 py-2.5">
            {[{ id: null, name: t("Todo"), cover: null }, ...notebooks].map((n) => (
              <button
                key={n.id ?? "all"}
                type="button"
                onClick={() => setScope(n.id)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ${scope === n.id ? "bg-ink text-white" : "bg-chip text-ink-muted hover:text-ink"}`}
              >
                {n.cover && <MiniNotebook cover={n.cover} size={12} />}
                {n.name}
              </button>
            ))}
          </div>
        )}

        <div ref={list} className="min-h-0 flex-1 overflow-y-auto pb-1">
          {GROUPS.map((g) => {
            const items = results.filter((r) => r.kind === g.kind);
            if (!items.length) return null;
            return (
              <div key={g.kind}>
                <span className="block px-4 pt-2.5 pb-1 text-xs text-ink-faint">{t(g.label)}</span>
                {items.map((r) => {
                  const i = ordered.indexOf(r);
                  return (
                    <button
                      key={`${r.kind}-${r.id}`}
                      type="button"
                      data-i={i}
                      onMouseEnter={() => setIndex(i)}
                      onClick={() => go(r)}
                      className={`flex w-full items-center gap-3 px-4 py-2 text-left ${i === index ? "bg-chip" : ""}`}
                    >
                      <span className="grid w-4 shrink-0 place-items-center text-ink-faint">
                        <KindIcon kind={r.kind} />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-medium">{r.title}</span>
                        {r.snippet && (
                          <span className="truncate text-xs text-ink-muted">
                            <Marked text={r.snippet} />
                          </span>
                        )}
                      </span>
                      {r.where && <span className="hidden max-w-[40%] shrink-0 truncate text-xs text-ink-faint sm:block">{r.where}</span>}
                    </button>
                  );
                })}
              </div>
            );
          })}
          {q.trim().length >= 2 && !loading && results.length === 0 && <p className="px-4 py-6 text-center text-sm text-ink-faint">{t("Nada con “")}{q.trim()}”</p>}
        </div>

        <div className="hidden items-center gap-4 border-t border-border-subtle px-4 py-2 text-xs text-ink-faint sm:flex">
          <span className="flex items-center gap-1.5">
            <kbd className="rounded border border-border-subtle px-1">↑</kbd>
            <kbd className="rounded border border-border-subtle px-1">↓</kbd>{" "}{t("moverte")}
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="rounded border border-border-subtle px-1">↵</kbd>{" "}{t("abrir")}
          </span>
        </div>
      </div>
    </div>
  );
}
