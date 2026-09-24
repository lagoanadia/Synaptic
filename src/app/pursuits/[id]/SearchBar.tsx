"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { searchPursuit, type SearchHit, type SearchResults } from "./actions";
import { splitHighlighted } from "@/lib/search";

function Snippet({ text }: { text: string }) {
  return (
    <p className="text-sm text-ink-muted">
      {splitHighlighted(text).map((seg, i) =>
        seg.highlighted ? (
          <mark key={i} className="rounded bg-accent-soft px-0.5 text-ink">
            {seg.text}
          </mark>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </p>
  );
}

function ResultGroup({
  label,
  hits,
  hrefFor,
}: {
  label: string;
  hits: SearchHit[];
  hrefFor: (hit: SearchHit) => string;
}) {
  if (hits.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-ink-faint uppercase">{label}</span>
      {hits.map((hit) => (
        <Link
          key={hit.id}
          href={hrefFor(hit)}
          className="rounded-md border border-transparent p-2 hover:border-border-subtle hover:bg-chip"
        >
          <Snippet text={hit.snippet} />
        </Link>
      ))}
    </div>
  );
}

// Debounced (300ms) so typing a query doesn't fire a database search on
// every single keystroke — a short pause after the user stops typing is
// enough, and it's a much lighter load than one query per character.
export function SearchBar({ pursuitId }: { pursuitId: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.trim() === "") {
      setResults(null);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    debounceRef.current = setTimeout(async () => {
      const r = await searchPursuit(pursuitId, value);
      setResults(r);
      setIsSearching(false);
    }, 300);
  }

  const hasQuery = query.trim() !== "";
  const hasResults = results && (results.dumps.length > 0 || results.notes.length > 0);

  return (
    <div className="relative">
      <input
        type="search"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Search this pursuit…"
        className="w-full rounded-md border border-border-subtle bg-white px-3 py-2 text-sm"
      />
      {hasQuery && (
        <div className="absolute top-full left-0 z-10 mt-1 flex w-full flex-col gap-3 rounded-md border border-border-subtle bg-white p-3 shadow-sm">
          {isSearching && <p className="text-xs text-ink-faint">Searching…</p>}
          {!isSearching && results && !hasResults && (
            <p className="text-xs text-ink-faint">No matches in this pursuit.</p>
          )}
          {results && (
            <>
              <ResultGroup
                label="Brain dumps"
                hits={results.dumps}
                hrefFor={(hit) => `/pursuits/${pursuitId}/dump/${hit.id}`}
              />
              <ResultGroup
                label="Organized notes"
                hits={results.notes}
                hrefFor={(hit) => `/pursuits/${pursuitId}?tab=organized#${hit.id}`}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
