"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AvatarFace } from "../AvatarFace";
import { BG_COLORS, BROWS, CLOTH_COLORS, EYES, EXTRAS, GLASSES, HAIRS, HAIR_COLORS, MOUTHS, OUTFITS, SKINS, randomAvatar, type Avatar } from "@/lib/avatar";
import { saveAvatar, setUsername } from "./actions";

type Tab = "Cara" | "Pelo" | "Ropa" | "Extras" | "Fondo";
const TABS: Tab[] = ["Cara", "Pelo", "Ropa", "Extras", "Fondo"];
// Thumbnails zoom into what each row changes.
const FACE = "44 42 112 112";
const HEAD = "14 18 172 172";
const BODY = "30 90 140 140";

const DiceIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="4" y="4" width="16" height="16" rx="3" />
    <path d="M8.5 8.5h.01M15.5 8.5h.01M12 12h.01M8.5 15.5h.01M15.5 15.5h.01" />
  </svg>
);

export function ProfileEditor({ name, username, initial, saved: wasSaved }: { name: string; username: string | null; initial: Avatar; saved: boolean }) {
  const [avatar, setAvatar] = useState(initial);
  const [tab, setTab] = useState<Tab>("Cara");
  const [dirty, setDirty] = useState(!wasSaved);
  const [pending, start] = useTransition();
  const router = useRouter();
  const set = (patch: Partial<Avatar>) => {
    setAvatar((a) => ({ ...a, ...patch }));
    setDirty(true);
  };

  const options = <K extends keyof Avatar>(key: K, values: readonly Avatar[K][], view: string, size = 62) => (
    <div className="flex flex-wrap gap-2">
      {values.map((v) => {
        const on = avatar[key] === v;
        return (
          <button
            key={String(v)}
            type="button"
            onClick={() => set({ [key]: v } as Partial<Avatar>)}
            aria-pressed={on}
            aria-label={key === "star" ? (v ? "Con estrella" : "Sin estrella") : String(v)}
            title={key === "star" ? (v ? "Con estrella" : "Sin estrella") : String(v)}
            className={`rounded-full p-0.5 transition-shadow ${on ? "shadow-[0_0_0_2.5px_#37352f]" : "shadow-[0_0_0_1px_rgba(55,53,47,.12)] hover:shadow-[0_0_0_1.5px_rgba(55,53,47,.35)]"}`}
          >
            <AvatarFace avatar={{ ...avatar, ...(key === "eyes" || key === "brows" ? { glasses: "ninguna" } : {}), [key]: v }} size={size} uid={`${String(key)}${String(v)}`} view={view} plain={key !== "star" && key !== "bg"} />
          </button>
        );
      })}
    </div>
  );
  const swatches = (key: "skin" | "hairColor" | "cloth" | "bg", colors: readonly string[], big = false) => (
    <div className="flex flex-wrap gap-2.5">
      {colors.map((c, i) => (
        <button
          key={c}
          type="button"
          onClick={() => set({ [key]: i })}
          aria-pressed={avatar[key] === i}
          aria-label={`Color ${i + 1}`}
          className={`${big ? "size-11" : "size-9"} rounded-full shadow-[inset_0_0_0_1px_rgba(0,0,0,.12)] ${avatar[key] === i ? "outline-[2.5px] outline-offset-[3px] outline-ink outline-solid" : ""}`}
          style={{ background: c }}
        />
      ))}
    </div>
  );
  const row = (label: string, body: React.ReactNode) => (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold tracking-wide text-ink-faint uppercase">{label}</span>
      {body}
    </div>
  );

  return (
    <div className="flex flex-col gap-10 md:flex-row md:items-start md:gap-14">
      <div className="flex flex-col items-center gap-2 md:w-[280px] md:shrink-0">
        <AvatarFace avatar={avatar} size={240} uid="big" />
        <b className="mt-2 text-xl">{name}</b>
        <Handle initial={username} />
        <div className="mt-3 flex gap-2.5">
          <button type="button" onClick={() => set(randomAvatar())} title="Otro al azar" aria-label="Otro al azar" className="grid h-10 w-11 place-items-center rounded-lg bg-chip text-ink-muted hover:text-ink">
            <DiceIcon />
          </button>
          <button
            type="button"
            disabled={pending || !dirty}
            onClick={() =>
              start(async () => {
                await saveAvatar(avatar);
                setDirty(false);
                router.refresh();
              })
            }
            className="rounded-lg bg-ink px-5 py-2 font-medium text-white disabled:opacity-50"
          >
            {pending ? "Guardando…" : dirty ? "Hecho" : "Guardado"}
          </button>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-6">
        <div className="flex w-fit max-w-full gap-0.5 overflow-x-auto rounded-[10px] bg-chip p-[3px] text-sm" role="tablist">
          {TABS.map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`rounded-lg px-4 py-1.5 ${tab === t ? "bg-white font-medium text-ink shadow-sm" : "text-ink-muted hover:text-ink"}`}>
              {t}
            </button>
          ))}
        </div>
        {tab === "Cara" && (
          <>
            {row("Piel", swatches("skin", SKINS))}
            {row("Ojos", options("eyes", EYES, FACE))}
            {row("Cejas", options("brows", BROWS, FACE))}
            {row("Boca", options("mouth", MOUTHS, FACE))}
          </>
        )}
        {tab === "Pelo" && (
          <>
            {row("Peinado", options("hair", HAIRS, HEAD, 70))}
            {row("Color", swatches("hairColor", HAIR_COLORS))}
          </>
        )}
        {tab === "Ropa" && (
          <>
            {row("Prenda", options("outfit", OUTFITS, BODY, 76))}
            {row("Color", swatches("cloth", CLOTH_COLORS))}
          </>
        )}
        {tab === "Extras" && (
          <>
            {row("Gafas", options("glasses", GLASSES, FACE, 70))}
            {row("Otros", options("extra", EXTRAS, HEAD, 70))}
          </>
        )}
        {tab === "Fondo" && (
          <>
            {row("Color", swatches("bg", BG_COLORS, true))}
            {row("Estrella", options("star", [false, true], "0 0 200 200", 70))}
          </>
        )}
      </div>
    </div>
  );
}

// @handle: click to edit, Enter to save.
function Handle({ initial }: { initial: string | null }) {
  const [value, setValue] = useState(initial ?? "");
  const [editing, setEditing] = useState(!initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!editing)
    return (
      <button type="button" onClick={() => setEditing(true)} className="rounded-md bg-chip px-2 py-0.5 text-sm text-ink-muted hover:text-ink" title="Cambiar tu @usuario">
        @{value}
      </button>
    );
  return (
    <form
      className="flex flex-col items-center gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await setUsername(value);
          setError(r.error);
          if (r.username) {
            setValue(r.username);
            setEditing(false);
          }
        });
      }}
    >
      <span className="flex items-center rounded-md border border-border-subtle bg-white px-2 text-sm focus-within:border-ink-faint">
        <span className="text-ink-faint">@</span>
        <input autoFocus={!!initial} value={value} onChange={(e) => setValue(e.target.value)} disabled={pending} placeholder="tu_usuario" aria-label="Tu @usuario" className="w-36 py-1 outline-none" />
      </span>
      {error ? <span className="text-xs text-red-600">{error}</span> : <span className="text-xs text-ink-faint">Así te encuentran tus amigos</span>}
    </form>
  );
}
