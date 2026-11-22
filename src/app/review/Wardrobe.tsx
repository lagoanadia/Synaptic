"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useT } from "@/app/LangProvider";
import { AvatarFace } from "@/app/AvatarFace";
import { Popover } from "@/app/ui/Popover";
import { COSTUMES, DEFAULT_AVATAR } from "@/lib/avatar";
import { buyCostume, getWardrobe, wearCostume, type Wardrobe as W } from "./wardrobe";

// Fired with the new ✦ balance when a test ends (ReviewGames' report()).
export const STARS_EVENT = "synaptic:stars";

// Top right of Repasar: your avatar and ✦. Tap it for the costume shop:
// each test gives up to 5 ✦; costumes are bought with them and worn at once.
export function Wardrobe() {
  const t = useT();
  const [w, setW] = useState<W | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bump, setBump] = useState(false);
  const [pending, start] = useTransition();
  const chip = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    getWardrobe().then(setW).catch(() => {});
    const onStars = (e: Event) => {
      const stars = (e as CustomEvent<number>).detail;
      setW((x) => x && { ...x, stars });
      setBump(true);
      window.setTimeout(() => setBump(false), 900);
    };
    window.addEventListener(STARS_EVENT, onStars);
    return () => window.removeEventListener(STARS_EVENT, onStars);
  }, []);

  if (!w) return null;
  const avatar = w.avatar ?? DEFAULT_AVATAR;
  const act = (fn: () => Promise<{ error: string | null; wardrobe?: W }>) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (r.error) setError(t(r.error));
      else if (r.wardrobe) setW(r.wardrobe);
    });

  return (
    <>
      <button
        ref={chip}
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={t("Tus trajes")}
        aria-label={t("Tus trajes")}
        className={`flex shrink-0 items-center gap-1.5 rounded-full bg-white/10 py-1 pr-3 pl-1 text-sm font-extrabold text-white transition hover:bg-white/15 ${bump ? "scale-110" : ""}`}
      >
        <AvatarFace avatar={avatar} size={26} uid="wardrobe-chip" />
        <span className="text-[#f5b82e]">✦</span>
        <span className="tabular-nums">{w.stars}</span>
      </button>
      <Popover anchor={chip} open={open} onClose={() => setOpen(false)} align="end" label={t("Tus trajes")}>
        <div className="flex w-[330px] flex-col gap-3 p-4 text-ink">
          <div className="flex items-center gap-3">
            <AvatarFace avatar={avatar} size={72} uid="wardrobe-me" />
            <div className="min-w-0">
              <div className="text-base font-extrabold">{t("Tu avatar")}</div>
              <div className="text-xs leading-snug text-ink-muted">{t("Cada test te da hasta 5 ✦ según lo bien que lo hagas.")}</div>
              <div className="mt-1 text-sm font-extrabold">
                <span className="text-[#f5b82e]">✦</span> {w.stars}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {COSTUMES.map((c) => {
              const owned = w.owned.includes(c.id);
              const worn = avatar.costume === c.id;
              const can = w.stars >= c.price;
              return (
                <button
                  key={c.id}
                  type="button"
                  disabled={pending || (!owned && !can)}
                  onClick={() => act(() => (owned ? wearCostume(worn ? "" : c.id) : buyCostume(c.id)))}
                  className={`flex flex-col items-center gap-1 rounded-xl border-2 p-2 text-center transition ${worn ? "border-accent bg-accent-soft" : "border-border-subtle hover:border-ink-faint/40"} disabled:cursor-not-allowed`}
                >
                  <span className={owned || can ? "" : "opacity-45 grayscale"}>
                    <AvatarFace avatar={{ ...avatar, costume: c.id }} size={56} uid={`wardrobe-${c.id}`} />
                  </span>
                  <span className="text-[12px] leading-tight font-bold">{t(c.name)}</span>
                  <span className={`text-[11px] font-extrabold ${worn ? "text-accent" : "text-ink-muted"}`}>
                    {worn ? t("Puesto ✓") : owned ? t("Ponérmelo") : (
                      <>
                        {can ? "" : "🔒 "}
                        <span className="text-[#f5b82e]">✦</span> {c.price}
                      </>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      </Popover>
    </>
  );
}
