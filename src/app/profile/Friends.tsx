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
  const others = [...friends.filter((f) => f.state === "friend"), ...friends.filter((f) => f.state === "sent")];

  const run = (fn: () => Promise<unknown>) => start(async () => void (await fn()));

  return (
    <section className="flex max-w-xl flex-col gap-4 border-t border-border-subtle pt-8">
      <h2 className="text-lg font-semibold">{t("Amigos")}</h2>

      <form
        className="flex flex-col gap-1"
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

      {received.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold tracking-wide text-ink-faint uppercase">{t("Quieren ser tus amigos")}</span>
          {received.map((f) => (
            <Row key={f.id} friend={f}>
              <button type="button" disabled={pending} onClick={() => run(() => acceptFriend(f.id))} className="rounded-md bg-ink px-3 py-1 text-xs font-medium text-white">
                {t("Aceptar")}
              </button>
              <button type="button" disabled={pending} onClick={() => run(() => removeFriend(f.id))} className="rounded-md px-3 py-1 text-xs text-ink-muted hover:bg-chip">
                {t("Rechazar")}
              </button>
            </Row>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {others.length === 0 && <p className="text-sm text-ink-faint">{t("Aún no tienes amigos aquí. Añádelos por su @usuario.")}</p>}
        {others.map((f) => (
          <Row key={f.id} friend={f}>
            {f.state === "sent" && <span className="text-xs text-ink-faint">{t("Pendiente")}</span>}
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (f.state === "sent" || confirm(t("¿Quitar a {0} de tus amigos?", { 0: f.name }))) run(() => removeFriend(f.id));
              }}
              className="rounded-md px-3 py-1 text-xs text-ink-muted hover:bg-chip"
            >
              {f.state === "sent" ? t("Cancelar") : t("Quitar")}
            </button>
          </Row>
        ))}
      </div>
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
