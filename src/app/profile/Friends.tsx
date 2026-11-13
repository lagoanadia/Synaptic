"use client";

import { useState, useTransition } from "react";
import { useT } from "@/app/LangProvider";
import { AvatarFace } from "../AvatarFace";
import type { Avatar } from "@/lib/avatar";
import { acceptFriend, addFriend, removeFriend } from "./actions";

export type Friend = {
  id: string;
  state: "friend" | "sent" | "received";
  name: string;
  username: string | null;
  avatar: Avatar | null;
};

// Your friends, requests you got (accept / decline) and ones you sent.
export function Friends({ friends, hasHandle }: { friends: Friend[]; hasHandle: boolean }) {
  const t = useT();
  const [handle, setHandle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const received = friends.filter((f) => f.state === "received");
  const others = friends.filter((f) => f.state === "friend");
  const sent = friends.filter((f) => f.state === "sent");

  const run = (fn: () => Promise<unknown>) => start(async () => void (await fn()));

  return (
    <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="flex flex-col gap-5">

      <form
        className="flex max-w-xl flex-col gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await addFriend(handle);
            setError(r.error);
            if (!r.error) setHandle("");
          });
        }}
      >
        <div className="flex gap-2">
          <span className="flex flex-1 items-center rounded-md border border-border-subtle bg-white px-2 text-sm focus-within:border-ink-faint">
            <span className="text-ink-faint">@</span>
            <input value={handle} onChange={(e) => setHandle(e.target.value)} disabled={pending} placeholder={t("usuario de tu amigo")} aria-label={t("Añadir amigo por @usuario")} className="min-w-0 flex-1 py-1.5 outline-none" />
          </span>
          <button type="submit" disabled={pending || !handle.trim()} className="rounded-md bg-ink px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50">
            {t("Añadir")}
          </button>
        </div>
        {error ? (
          <span className="text-xs text-red-600">{t(error)}</span>
        ) : (
          !hasHandle && <span className="text-xs text-ink-faint">{t("Ponte un @usuario arriba para que tus amigos te encuentren.")}</span>
        )}
      </form>

      {/* Friends as cards: their avatar big, name and @username. */}
      {others.length === 0 ? (
        <p className="text-sm text-ink-faint">{t("Aún no tienes amigos aquí. Añádelos por su @usuario.")}</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {others.map((f) => (
            <div key={f.id} className={`group relative flex flex-col items-center gap-2 rounded-xl border border-border-subtle bg-white p-5 text-center ${f.state === "sent" ? "opacity-60" : ""}`}>
              {f.avatar ? (
                <AvatarFace avatar={f.avatar} size={120} uid={`c${f.id}`} />
              ) : (
                <span className="grid size-[120px] place-items-center rounded-full bg-chip text-4xl font-semibold text-ink-muted">{f.name.slice(0, 1).toUpperCase()}</span>
              )}
              <span className="w-full truncate font-semibold">{f.name}</span>
              {f.username && <span className="-mt-1.5 w-full truncate text-sm text-ink-faint">@{f.username}</span>}
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  if (f.state === "sent" || confirm(t("¿Quitar a {0} de tus amigos?", { 0: f.name }))) run(() => removeFriend(f.id));
                }}
                className="absolute top-2 right-2 rounded-md px-2 py-0.5 text-xs text-ink-faint opacity-0 group-hover:opacity-100 hover:bg-chip hover:text-ink focus:opacity-100"
              >
                {f.state === "sent" ? t("Cancelar") : t("Quitar")}
              </button>
            </div>
          ))}
        </div>
      )}
      </div>
      {/* Pending requests, on the side. */}
      <aside className="flex flex-col gap-3 self-start rounded-xl border border-border-subtle bg-callout p-4">
        <span className="text-xs font-semibold tracking-wide text-ink-faint uppercase">{t("Solicitudes pendientes")}</span>
        {received.length === 0 && sent.length === 0 && <span className="text-sm text-ink-faint">{t("Nada pendiente.")}</span>}
        {received.map((f) => (
          <Row key={f.id} friend={f}>
            <button type="button" disabled={pending} onClick={() => run(() => acceptFriend(f.id))} className="rounded-md bg-ink px-2.5 py-1 text-xs font-medium text-white">
              {t("Aceptar")}
            </button>
            <button type="button" disabled={pending} onClick={() => run(() => removeFriend(f.id))} aria-label={t("Rechazar")} title={t("Rechazar")} className="rounded-md px-1.5 py-1 text-xs text-ink-faint hover:bg-white">
              ×
            </button>
          </Row>
        ))}
        {sent.length > 0 && <span className="mt-1 text-xs text-ink-faint">{t("Enviadas")}</span>}
        {sent.map((f) => (
          <Row key={f.id} friend={f}>
            <button type="button" disabled={pending} onClick={() => run(() => removeFriend(f.id))} className="rounded-md px-2 py-1 text-xs text-ink-faint hover:bg-white">
              {t("Cancelar")}
            </button>
          </Row>
        ))}
      </aside>
    </section>
  );
}

function Row({ friend, children }: { friend: Friend; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-lg px-1 py-1">
      {friend.avatar ? (
        <AvatarFace avatar={friend.avatar} size={36} uid={`f${friend.id}`} />
      ) : (
        <span className="grid size-9 place-items-center rounded-full bg-chip text-sm font-semibold text-ink-muted">{friend.name.slice(0, 1).toUpperCase()}</span>
      )}
      <span className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="truncate text-sm font-medium">{friend.name}</span>
        {friend.username && <span className="truncate text-xs text-ink-faint">@{friend.username}</span>}
      </span>
      {children}
    </div>
  );
}
