"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { signOutAction } from "./actions";
import { setLocale } from "./pursuits/actions";
import { LOCALES, type Locale } from "@/lib/i18n";
import { tileColor } from "@/lib/tileColor";
import { CardsIcon, ChatIcon, CodeIcon, HomeIcon, MenuIcon, SettingsIcon, XIcon } from "./icons";

type Props = {
  user: { name: string | null; email: string | null; image: string | null };
  plan: string;
  locale: string;
  sections: { id: string; name: string }[];
};

const PLAN_LABEL: Record<string, string> = { FREE: "Free", PRO: "Student Pro", TEAM: "Team" };

// The app's only navigation: a menu button in the top-left corner (or M)
// opens a drawer with your sections, the practice areas and your account.
export function NavDrawer({ user, plan, locale, sections }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const [isChangingLocale, startLocale] = useTransition();

  // Close on navigation.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.target as HTMLElement).closest("input, textarea, select, [contenteditable]")) return;
      if (e.key === "Escape") setOpen(false);
      if (e.key === "m" && !e.metaKey && !e.ctrlKey && !e.altKey) setOpen((o) => !o);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const active = (href: string, exact = false) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  const item = (on: boolean) =>
    `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
      on ? "bg-ink text-white" : "text-ink hover:bg-chip"
    }`;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Menu (M)"
        aria-expanded={open}
        className="fixed top-4 left-3 z-40 rounded-xl bg-white/80 p-2.5 text-ink shadow-[0_1px_2px_rgba(13,13,13,0.08)] backdrop-blur hover:bg-white"
      >
        <MenuIcon size={18} className="block" />
      </button>

      <div
        className={`fixed inset-0 z-50 bg-ink/20 transition-opacity ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={() => setOpen(false)}
        aria-hidden
      />
      <nav
        aria-label="Main"
        aria-hidden={!open}
        inert={!open}
        className={`fixed top-0 bottom-0 left-0 z-50 flex w-72 flex-col gap-6 overflow-y-auto bg-background p-4 shadow-2xl transition-transform duration-200 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-3">
          {user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.image} alt="" width={36} height={36} className="rounded-full" />
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent font-bold text-white">
              {(user.name ?? user.email ?? "?").charAt(0).toUpperCase()}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{user.name ?? user.email}</p>
            <p className="text-xs font-medium text-accent">{PLAN_LABEL[plan] ?? plan}</p>
          </div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="rounded-lg p-1.5 text-ink-muted hover:bg-chip">
            <XIcon size={18} className="block" />
          </button>
        </div>

        <div className="flex flex-col gap-1">
          <Link href="/pursuits" className={item(active("/pursuits", true))}>
            <HomeIcon size={18} className="block" /> Home
          </Link>
          {sections.map((s, i) => (
            <Link key={s.id} href={`/pursuits/s/${s.id}`} className={`${item(active(`/pursuits/s/${s.id}`))} pl-9`}>
              <span className={`h-2.5 w-2.5 rounded-full ${tileColor(i)}`} /> {s.name}
            </Link>
          ))}
        </div>

        <div className="flex flex-col gap-1">
          <Link href="/review" className={item(active("/review"))}>
            <CardsIcon size={18} className="block" /> Review
          </Link>
          <Link href="/challenges" className={item(active("/challenges"))}>
            <CodeIcon size={18} className="block" /> Challenges
          </Link>
          <Link href="/arena" className={item(active("/arena"))}>
            <ChatIcon size={18} className="block" /> Arena
          </Link>
        </div>

        <div className="mt-auto flex flex-col gap-1 border-t border-border-subtle pt-4">
          <span className="flex items-center gap-3 px-3 text-xs font-bold text-ink-muted uppercase">
            <SettingsIcon size={14} className="block" /> Settings
          </span>
          <Link href="/billing" className={item(active("/billing"))}>Plan</Link>
          <Link href="/settings/api-keys" className={item(active("/settings"))}>API keys</Link>
          <label className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold">
            Language
            <select
              value={locale}
              disabled={isChangingLocale}
              onChange={(e) =>
                startLocale(async () => {
                  await setLocale(e.target.value as Locale);
                  router.refresh();
                })
              }
              className="rounded-lg border border-border-subtle bg-white px-2 py-1 text-xs"
            >
              {LOCALES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
          <form action={signOutAction}>
            <button type="submit" className={`${item(false)} w-full text-ink-muted`}>
              Sign out
            </button>
          </form>
        </div>
      </nav>
    </>
  );
}
