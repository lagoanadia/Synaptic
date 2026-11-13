"use client";

import { useT } from "@/app/LangProvider";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AvatarFace } from "../AvatarFace";
import { BG_COLORS, BROWS, CLOTH_COLORS, EYES, EXTRAS, GLASSES, HAIRS, HAIR_COLORS, MOUTHS, OUTFITS, SKINS, type Avatar } from "@/lib/avatar";
import { saveAvatar, setUsername } from "./actions";
import { UsernameField, type HandleStatus } from "./UsernameField";

type Tab = "Cara" | "Pelo" | "Ropa" | "Extras" | "Fondo";
const TABS: Tab[] = ["Cara", "Pelo", "Ropa", "Extras", "Fondo"];
// Thumbnails zoom into what each row changes.
const FACE = "44 42 112 112";
const HEAD = "14 18 172 172";
const BODY = "30 90 140 140";

export function ProfileEditor({ name, username, suggested, initial, saved: wasSaved }: { name: string; username: string | null; suggested: string; initial: Avatar; saved: boolean }) {
  const t = useT();
  const tr = t;
  const [avatar, setAvatar] = useState(initial);
  const [tab, setTab] = useState<Tab>("Cara");
  const [dirty, setDirty] = useState(!wasSaved);
  const [handle, setHandle] = useState(username ?? suggested);
  const [handleStatus, setHandleStatus] = useState<HandleStatus>("idle");
  const [savedHandle, setSavedHandle] = useState(username ?? "");
  const [handleError, setHandleError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const handleDirty = handle.trim().replace(/^@/, "").toLowerCase() !== savedHandle && handleStatus === "ok";
  // One button saves both: the @usuario (if changed) and the avatar.
  const save = () =>
    start(async () => {
      if (handleDirty && handle.trim()) {
        const r = await setUsername(handle);
        setHandleError(r.error);
        if (r.error) return;
        setHandle(r.username!);
        setSavedHandle(r.username!);
      }
      if (dirty) {
        await saveAvatar(avatar);
        setDirty(false);
      }
      router.refresh();
    });
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
            aria-label={key === "star" ? (v ? t("Con estrella") : t("Sin estrella")) : String(v)}
            title={key === "star" ? (v ? t("Con estrella") : t("Sin estrella")) : String(v)}
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
          aria-label={t("Color {0}", { 0: i + 1 })}
          className={`${big ? "size-11" : "size-9"} rounded-full shadow-[inset_0_0_0_1px_rgba(0,0,0,.12)] ${avatar[key] === i ? "outline-[2.5px] outline-offset-[3px] outline-ink outline-solid" : ""}`}
          style={{ background: c }}
        />
      ))}
    </div>
  );
  const row = (label: string, body: React.ReactNode) => (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold tracking-wide text-ink-faint uppercase">{t(label)}</span>
      {body}
    </div>
  );

  return (
    <div className="flex flex-col gap-10 md:flex-row md:items-start md:gap-14">
      <div className="flex flex-col items-center gap-2 md:w-[280px] md:shrink-0">
        <AvatarFace avatar={avatar} size={240} uid="big" />
        <b className="mt-2 text-xl">{name}</b>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (handleDirty) save();
          }}
        >
          <UsernameField
            value={handle}
            saved={savedHandle || null}
            error={handleError}
            onStatus={setHandleStatus}
            onChange={(v) => {
              setHandle(v);
              setHandleError(null);
            }}
          />
        </form>
        <div className="mt-3 flex gap-2.5">
          <button
            type="button"
            disabled={pending || !(dirty || (handleDirty && handle.trim()))}
            onClick={save}
            className="rounded-lg bg-ink px-5 py-2 font-medium text-white disabled:opacity-50"
          >
            {pending ? t("Guardando…") : dirty || (handleDirty && handle.trim()) ? t("Guardar") : t("Guardado")}
          </button>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-6">
        <div className="flex w-fit max-w-full gap-0.5 overflow-x-auto rounded-[10px] bg-chip p-[3px] text-sm" role="tablist">
          {TABS.map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`rounded-lg px-4 py-1.5 ${tab === t ? "bg-white font-medium text-ink shadow-sm" : "text-ink-muted hover:text-ink"}`}>
              {tr(t)}
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
