"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { signOutAction } from "./actions";
import { createSection } from "./pursuits/actions";
import { MiniNotebook } from "./Covers";
import { SearchIcon, SearchPalette } from "./SearchPalette";
import { CardsIcon, CodeIcon, HomeIcon, XIcon } from "./icons";
import type { NotebookCover } from "@/lib/covers";

type Props = {
  user: { name: string | null; email: string | null; image: string | null };
  plan: string;
  notebooks: { id: string; name: string; cover: NotebookCover }[];
};

const PLAN_LABEL: Record<string, string> = { FREE: "Gratis", PRO: "Student Pro", TEAM: "Team" };

// Notion-style navigation: a fixed sidebar on wide screens (pages, your
// notebooks, account), a bottom tab bar on phones.
export function Sidebar({ user, plan, notebooks }: Props) {
  const pathname = usePathname();
  const [sheet, setSheet] = useState(false);
  const [searching, setSearching] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);
  // Ctrl+K / ⌘K opens search from anywhere.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearching((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setSheet(false);
  }
  const active = (href: string, exact = false) => (exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));
  const row = (on: boolean) =>
    `flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors ${on ? "bg-[#ebebea] font-medium text-ink" : "text-ink-muted hover:bg-[#ebebea]/70 hover:text-ink"}`;

  const notebookList = (
    <div className="flex flex-col gap-0.5">
      {notebooks.map((n) => (
        <Link key={n.id} href={`/pursuits/s/${n.id}`} className={row(active(`/pursuits/s/${n.id}`))}>
          <MiniNotebook cover={n.cover} size={16} />
          <span className="truncate">{n.name}</span>
        </Link>
      ))}
      <NewNotebook className={row(false)} />
    </div>
  );

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col gap-5 border-r border-border-subtle bg-sidebar px-2.5 py-3 lg:flex" aria-label="Navegación">
        <Link href="/pursuits" className="flex items-center gap-2 px-2 py-1 text-sm font-semibold text-ink">
          <span className="grid size-5 place-items-center rounded bg-accent text-[11px] font-bold text-white">S</span>
          Synaptic
        </Link>
        <nav className="flex flex-col gap-0.5">
          <Link href="/pursuits" className={row(active("/pursuits", true))}>
            <HomeIcon size={16} className="block" /> Inicio
          </Link>
          <button type="button" onClick={() => setSearching(true)} className={`${row(false)} w-full`}>
            <SearchIcon size={16} /> <span className="flex-1 text-left">Buscar</span>
            <kbd className="text-[10px] text-ink-faint">Ctrl K</kbd>
          </button>
          <Link href="/review" className={row(active("/review"))}>
            <CardsIcon size={16} className="block" /> Repasar
          </Link>
          <Link href="/challenges" className={row(active("/challenges"))}>
            <CodeIcon size={16} className="block" /> Retos
          </Link>
        </nav>
        <div className="flex flex-col gap-1">
          <span className="px-2 text-xs font-medium text-ink-faint">Libretas</span>
          {notebookList}
        </div>
        <div className="mt-auto flex flex-col gap-0.5 border-t border-border-subtle pt-3">
          <Link href="/billing" className={row(active("/billing"))}>
            <Avatar user={user} />
            <span className="min-w-0 flex-1 truncate">{user.name ?? user.email}</span>
            <span className="text-[11px] text-accent">{PLAN_LABEL[plan] ?? plan}</span>
          </Link>
          <form action={signOutAction}>
            <button type="submit" className={`${row(false)} w-full`}>
              Cerrar sesión
            </button>
          </form>
        </div>
      </aside>

      {/* Phones: tab bar + a sheet with your notebooks. */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex items-stretch justify-around border-t border-border-subtle bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label="Navegación">
        {[
          { href: "/pursuits", label: "Inicio", icon: HomeIcon, on: active("/pursuits", true) },
          { href: "/review", label: "Repasar", icon: CardsIcon, on: active("/review") },
          { href: "/challenges", label: "Retos", icon: CodeIcon, on: active("/challenges") },
        ].map((t) => (
          <Link key={t.href} href={t.href} className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] ${t.on ? "text-ink" : "text-ink-faint"}`}>
            <t.icon size={20} className="block" />
            {t.label}
          </Link>
        ))}
        <button type="button" onClick={() => setSearching(true)} className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] text-ink-faint">
          <SearchIcon size={20} />
          Buscar
        </button>
        <button type="button" onClick={() => setSheet(true)} className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] ${active("/pursuits/s") ? "text-ink" : "text-ink-faint"}`}>
          <span className="flex h-5 items-end gap-0.5" aria-hidden>
            {notebooks.slice(0, 3).map((n) => (
              <MiniNotebook key={n.id} cover={n.cover} size={16} />
            ))}
          </span>
          Libretas
        </button>
      </nav>
      <SearchPalette open={searching} onClose={() => setSearching(false)} notebooks={notebooks} />
      {sheet && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-label="Libretas">
          <button type="button" aria-label="Cerrar" className="absolute inset-0 bg-ink/20" onClick={() => setSheet(false)} />
          <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3 rounded-t-2xl bg-white p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-2xl">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Libretas</span>
              <button type="button" onClick={() => setSheet(false)} aria-label="Cerrar" className="rounded p-1 text-ink-muted">
                <XIcon size={18} className="block" />
              </button>
            </div>
            {notebookList}
            <div className="flex items-center gap-3 border-t border-border-subtle pt-3 text-sm">
              <Link href="/billing" className="flex flex-1 items-center gap-2 text-ink-muted">
                <Avatar user={user} /> {user.name ?? user.email}
              </Link>
              <form action={signOutAction}>
                <button type="submit" className="text-ink-muted">
                  Salir
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Avatar({ user }: { user: Props["user"] }) {
  return user.image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={user.image} alt="" width={18} height={18} className="size-[18px] rounded-full" />
  ) : (
    <span className="grid size-[18px] place-items-center rounded-full bg-accent text-[10px] font-bold text-white">
      {(user.name ?? user.email ?? "?").charAt(0).toUpperCase()}
    </span>
  );
}

// "+ Nueva libreta": click, type the name, Enter.
function NewNotebook({ className }: { className: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className={`${className} text-ink-faint`}>
        <span className="grid w-3 place-items-center text-base leading-none">+</span> Nueva libreta
      </button>
    );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const n = name.trim();
        if (!n) return setOpen(false);
        start(async () => {
          const r = await createSection(n);
          if (r.error) return setError(r.error);
          setName("");
          setOpen(false);
          router.push(`/pursuits/s/${r.id}`);
        });
      }}
      className="px-1"
    >
      <input
        autoFocus
        value={name}
        disabled={pending}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => !name.trim() && setOpen(false)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        placeholder="Nombre"
        aria-label="Nombre de la libreta"
        className="w-full rounded-md border border-border-subtle bg-white px-2 py-1 text-sm"
      />
      {error && <span className="px-1 text-xs text-red-500">{error}</span>}
    </form>
  );
}
