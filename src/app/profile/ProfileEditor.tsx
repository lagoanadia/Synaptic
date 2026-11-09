"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "../Avatar";
import {
  BG_COLORS,
  BROWS,
  EXTRAS,
  EYES,
  GLASSES,
  HAIRS,
  HAIR_COLORS,
  MOUTHS,
  SHAPES,
  SKINS,
  TOPS,
  TOP_COLORS,
  randomAvatar,
  type Avatar as AvatarData,
} from "@/lib/avatar";
import { saveAvatar, setUsername } from "./actions";

type Tab = "cara" | "pelo" | "ropa" | "extras" | "fondo";
const TABS: [Tab, string][] = [
  ["cara", "Cara"],
  ["pelo", "Pelo"],
  ["ropa", "Ropa"],
  ["extras", "Extras"],
  ["fondo", "Fondo"],
];

// Dice with five pips: a random avatar.
const DiceIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
    <rect x="4" y="4" width="16" height="16" rx="3.5" />
    {[
      [8.5, 8.5],
      [15.5, 8.5],
      [12, 12],
      [8.5, 15.5],
      [15.5, 15.5],
    ].map(([x, y]) => (
      <circle key={`${x}${y}`} cx={x} cy={y} r="1.1" fill="currentColor" stroke="none" />
    ))}
  </svg>
);

const Label = ({ children }: { children: React.ReactNode }) => <h3 className="mb-2.5 text-[11px] font-semibold tracking-[.12em] text-ink-faint uppercase">{children}</h3>;

  // One option: the whole avatar with that part swapped in.
function Options<K extends keyof AvatarData>({
  a,
  set,
  k,
  values,
  view,
  size = 66,
}: {
  a: AvatarData;
  set: (k: K, v: AvatarData[K]) => void;
  k: K;
  values: readonly AvatarData[K][];
  view: string;
  size?: number;
}) {
  return (
    <div className="flex flex-wrap gap-3">
      {values.map((v) => {
        const on = a[k] === v;
        return (
          <button
            key={String(v)}
            type="button"
            onClick={() => set(k, v)}
            aria-pressed={on}
            title={String(v)}
            className={`rounded-full transition-transform hover:-translate-y-0.5 ${on ? "ring-[2.5px] ring-ink ring-offset-2" : "ring-[3px] ring-white shadow-[0_0_0_4px_#ecebe8]"}`}
          >
            <Avatar avatar={{ ...a, [k]: v, shape: k === "shape" ? (v as AvatarData["shape"]) : "circle" }} view={view} plain={k !== "shape"} size={size} />
          </button>
        );
      })}
    </div>
  );
}

function Swatches<K extends keyof AvatarData>({ a, set, k, values }: { a: AvatarData; set: (k: K, v: AvatarData[K]) => void; k: K; values: readonly AvatarData[K][] }) {
  return (
    <div className="flex flex-wrap gap-2.5">
      {values.map((v) => (
        <button
          key={String(v)}
          type="button"
          onClick={() => set(k, v)}
          aria-pressed={a[k] === v}
          aria-label={String(v)}
          className={`size-11 rounded-full shadow-[inset_0_0_0_1px_rgba(0,0,0,.08)] transition-transform hover:scale-105 ${a[k] === v ? "ring-[2.5px] ring-ink ring-offset-[3px]" : ""}`}
          style={{ background: String(v) }}
        />
      ))}
    </div>
  );
}


// Your avatar, built from parts: a big preview, your name and @handle,
// the dice, and the parts in tabs. Each choice is saved as you make it.
export function ProfileEditor({ name, username: initialHandle, initial }: { name: string; username: string; initial: AvatarData }) {
  const router = useRouter();
  const [a, setA] = useState(initial);
  const [tab, setTab] = useState<Tab>("cara");
  const [handle, setHandle] = useState(initialHandle);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialHandle);
  const [handleError, setHandleError] = useState<string | null>(null);
  const [, start] = useTransition();

  function change(next: AvatarData) {
    setA(next);
    start(() => saveAvatar(next));
  }
  const set = <K extends keyof AvatarData>(k: K, v: AvatarData[K]) => change({ ...a, [k]: v });

  async function saveHandle() {
    const r = await setUsername(draft);
    if (r.error) return setHandleError(r.error);
    setHandle(r.username!);
    setHandleError(null);
    setEditing(false);
  }

  return (
    <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-16">
      <div className="flex flex-col items-center gap-3 lg:w-[360px] lg:shrink-0">
        <Avatar avatar={a} size={260} title={name} />
        <p className="mt-3 text-xl font-semibold">{name}</p>
        {editing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveHandle();
            }}
            className="flex flex-col items-center gap-1"
          >
            <span className="flex items-center rounded-md bg-chip px-2 text-sm">
              @
              <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={saveHandle} aria-label="Tu nombre de usuario" className="w-36 bg-transparent py-1 outline-none" />
            </span>
            {handleError && <span className="text-xs text-red-600">{handleError}</span>}
          </form>
        ) : (
          <button type="button" onClick={() => setEditing(true)} title="Cambiar tu @usuario" className="rounded-md bg-chip px-2.5 py-1 text-sm text-ink-muted hover:text-ink">
            @{handle}
          </button>
        )}
        <div className="mt-3 flex gap-3">
          <button type="button" onClick={() => change(randomAvatar())} title="Uno al azar" aria-label="Uno al azar" className="grid size-11 place-items-center rounded-lg bg-chip text-ink-muted hover:text-ink">
            <DiceIcon />
          </button>
          <button
            type="button"
            onClick={() => {
              router.push("/pursuits");
              router.refresh();
            }}
            className="rounded-lg bg-ink px-6 text-sm font-semibold text-white"
          >
            Hecho
          </button>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-7">
        <div className="flex w-fit gap-0.5 rounded-xl bg-chip p-1" role="tablist">
          {TABS.map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={`rounded-lg px-4 py-1.5 text-sm ${tab === k ? "bg-white font-medium text-ink shadow-sm" : "text-ink-muted hover:text-ink"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "cara" && (
          <>
            <section>
              <Label>Piel</Label>
              <Swatches a={a} set={set} k="skin" values={SKINS} />
            </section>
            <section>
              <Label>Ojos</Label>
              <Options a={a} set={set} k="eyes" view="21 30 57 57" values={EYES} />
            </section>
            <section>
              <Label>Cejas</Label>
              <Options a={a} set={set} k="brows" view="21 30 57 57" values={BROWS} />
            </section>
            <section>
              <Label>Boca</Label>
              <Options a={a} set={set} k="mouth" view="21 30 57 57" values={MOUTHS} />
            </section>
          </>
        )}
        {tab === "pelo" && (
          <>
            <section>
              <Label>Peinado</Label>
              <Options a={a} set={set} k="hair" view="12 18 75 75" values={HAIRS} />
            </section>
            <section>
              <Label>Color</Label>
              <Swatches a={a} set={set} k="hairColor" values={HAIR_COLORS} />
            </section>
          </>
        )}
        {tab === "ropa" && (
          <>
            <section>
              <Label>Prenda</Label>
              <Options a={a} set={set} k="top" view="12 32 76 76" values={TOPS} />
            </section>
            <section>
              <Label>Color</Label>
              <Swatches a={a} set={set} k="topColor" values={TOP_COLORS} />
            </section>
          </>
        )}
        {tab === "extras" && (
          <>
            <section>
              <Label>Gafas</Label>
              <Options a={a} set={set} k="glasses" view="21 30 57 57" values={GLASSES} />
            </section>
            <section>
              <Label>Otros</Label>
              <Options a={a} set={set} k="extra" view="21 30 57 57" values={EXTRAS} />
            </section>
          </>
        )}
        {tab === "fondo" && (
          <>
            <section>
              <Label>Color</Label>
              <Swatches a={a} set={set} k="bg" values={BG_COLORS} />
            </section>
            <section>
              <Label>Forma</Label>
              <Options a={a} set={set} k="shape" view="0 0 100 100" values={SHAPES} />
            </section>
          </>
        )}
      </div>
    </div>
  );
}
