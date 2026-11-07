"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { signOutAction } from "./actions";
import { createSection } from "./pursuits/actions";
import { MiniNotebook } from "./Covers";
import { SearchIcon, SearchPalette } from "./SearchPalette";
import { CalendarIcon, CardsIcon, CodeIcon, HomeIcon, XIcon } from "./icons";
import type { NotebookCover } from "@/lib/covers";

type Props = {
  user: { name: string | null; email: string | null; image: string | null };
  plan: string;
  notebooks: { id: string; name: string; cover: NotebookCover }[];
  collapsed?: boolean;
};

// A door with an arrow out: sign out.
const LogoutIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" />
    <path d="M15 8l4 4-4 4M19 12H9" />
  </svg>
);

// Two panels: the toggle that collapses / expands the sidebar.
const PanelIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden>
    <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
    <path d="M9 4.5v15" />
  </svg>
);

const PLAN_LABEL: Record<string, string> = { FREE: "Gratis", PRO: "Student Pro", TEAM: "Team" };

// Notion-style navigation: a fixed sidebar on wide screens (pages, your
// notebooks, account), a bottom tab bar on phones.
export function Sidebar({ user, plan, notebooks, collapsed: startCollapsed = false }: Props) {
  const pathname = usePathname();
  const [sheet, setSheet] = useState(false);
  const [searching, setSearching] = useState(false);
  const [collapsed, setCollapsed] = useState(startCollapsed);
  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    document.documentElement.dataset.sidebar = next ? "collapsed" : "";
    document.cookie = `sidebar=${next ? "collapsed" : "open"}; path=/; max-age=31536000; samesite=lax`;
  }
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
      {collapsed && (
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-[52px] flex-col items-center gap-1 border-r border-border-subtle bg-sidebar py-3 lg:flex" aria-label="Navegación">
          <button type="button" onClick={toggleCollapsed} title="Mostrar la barra lateral" aria-label="Mostrar la barra lateral" className="mb-3 grid size-8 place-items-center rounded-md text-ink-muted hover:bg-[#ebebea] hover:text-ink">
            <PanelIcon />
          </button>
          {[
            { href: "/pursuits", label: "Inicio", icon: <HomeIcon size={16} className="block" />, on: active("/pursuits", true) },
            { href: "/calendar", label: "Calendario", icon: <CalendarIcon size={16} className="block" />, on: active("/calendar") },
            { href: "/review", label: "Repasar", icon: <CardsIcon size={16} className="block" />, on: active("/review") },
            { href: "/challenges", label: "Retos", icon: <CodeIcon size={16} className="block" />, on: active("/challenges") },
          ].map((t) => (
            <Link key={t.href} href={t.href} title={t.label} aria-label={t.label} className={`grid size-8 place-items-center rounded-md ${t.on ? "bg-[#ebebea] text-ink" : "text-ink-muted hover:bg-[#ebebea]/70 hover:text-ink"}`}>
              {t.icon}
            </Link>
          ))}
          <button type="button" onClick={() => setSearching(true)} title="Buscar (Ctrl K)" aria-label="Buscar" className="grid size-8 place-items-center rounded-md text-ink-muted hover:bg-[#ebebea]/70 hover:text-ink">
            <SearchIcon size={16} />
          </button>
          <span className="my-2 h-px w-6 bg-border-subtle" />
          {notebooks.map((n) => (
            <Link key={n.id} href={`/pursuits/s/${n.id}`} title={n.name} aria-label={n.name} className={`grid size-8 place-items-center rounded-md ${active(`/pursuits/s/${n.id}`) ? "bg-[#ebebea]" : "hover:bg-[#ebebea]/70"}`}>
              <MiniNotebook cover={n.cover} size={18} />
            </Link>
          ))}
          <Link href="/billing" title={user.name ?? user.email ?? "Cuenta"} className="mt-auto grid size-8 place-items-center rounded-md hover:bg-[#ebebea]/70">
            <Avatar user={user} />
          </Link>
        </aside>
      )}
      <aside className={`fixed inset-y-0 left-0 z-30 w-60 flex-col gap-5 border-r border-border-subtle bg-sidebar px-2.5 py-3 ${collapsed ? "hidden" : "hidden lg:flex"}`} aria-label="Navegación">
        <div className="flex items-center justify-between">
          <Link href="/pursuits" className="flex items-center gap-2 px-2 py-1 text-sm font-semibold text-ink">
            <span className="grid size-5 place-items-center rounded bg-accent text-[11px] font-bold text-white">S</span>
            Synaptic
          </Link>
          <button type="button" onClick={toggleCollapsed} title="Ocultar la barra lateral" aria-label="Ocultar la barra lateral" className="grid size-7 place-items-center rounded-md text-ink-faint hover:bg-[#ebebea] hover:text-ink">
            <PanelIcon />
          </button>
        </div>
        <nav className="flex flex-col gap-0.5">
          <Link href="/pursuits" className={row(active("/pursuits", true))}>
            <HomeIcon size={16} className="block" /> Inicio
          </Link>
          <button type="button" onClick={() => setSearching(true)} className={`${row(false)} w-full`}>
            <SearchIcon size={16} /> <span className="flex-1 text-left">Buscar</span>
            <kbd className="text-[10px] text-ink-faint">Ctrl K</kbd>
          </button>
          <Link href="/calendar" className={row(active("/calendar"))}>
            <CalendarIcon size={16} className="block" /> Calendario
          </Link>
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
        <div className="mt-auto flex items-center gap-1 border-t border-border-subtle pt-3">
          <Link href="/billing" className={`${row(active("/billing"))} min-w-0 flex-1`}>
            <Avatar user={user} />
            <span className="min-w-0 flex-1 truncate">{user.name ?? user.email}</span>
            <span className="text-[11px] text-accent">{PLAN_LABEL[plan] ?? plan}</span>
          </Link>
          <form action={signOutAction}>
            <button type="submit" title="Cerrar sesión" aria-label="Cerrar sesión" className="grid size-8 place-items-center rounded-md text-ink-faint hover:bg-[#ebebea] hover:text-ink">
              <LogoutIcon />
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
                <button type="submit" title="Cerrar sesión" aria-label="Cerrar sesión" className="grid size-8 place-items-center rounded-md text-ink-muted">
                  <LogoutIcon />
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
