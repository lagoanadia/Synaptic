"use client";

import { useT } from "@/app/LangProvider";
import { useActionState, useState } from "react";
import Link from "next/link";
import { AvatarFace } from "@/app/AvatarFace";
import type { Avatar } from "@/lib/avatar";
import { addMember, type FormState } from "./actions";

const initialState: FormState = { error: null };

type Friend = { id: string; name: string; username: string | null; avatar: Avatar | null };

// Share: tap a friend, or type an email / @usuario. The role applies to both.
export function MemberForm({ pursuitId, friends }: { pursuitId: string; friends: Friend[] }) {
  const t = useT();
  const [role, setRole] = useState<"EDITOR" | "VIEWER">("EDITOR");
  const [state, formAction, isPending] = useActionState(addMember.bind(null, pursuitId), initialState);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="role" value={role} />
      {friends.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-ink-faint">{t("Tus amigos")}</span>
          <div className="flex flex-wrap gap-1.5">
            {friends.map((f) => (
              <button
                key={f.id}
                type="submit"
                name="userId"
                value={f.id}
                disabled={isPending}
                title={f.username ? `@${f.username}` : f.name}
                className="flex items-center gap-1.5 rounded-full border border-border-subtle bg-white py-0.5 pr-2.5 pl-0.5 text-sm hover:border-ink-faint disabled:opacity-50"
              >
                {f.avatar ? (
                  <AvatarFace avatar={f.avatar} size={22} uid={`share${f.id}`} />
                ) : (
                  <span className="grid size-[22px] place-items-center rounded-full bg-chip text-[11px] font-semibold text-ink-muted">{f.name.slice(0, 1).toUpperCase()}</span>
                )}
                + {f.name}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          name="email"
          placeholder={t("+ invitar por email o @usuario")}
          disabled={isPending}
          className="w-56 rounded-md border border-dashed border-border-subtle bg-transparent px-2.5 py-1 text-sm focus:outline-none disabled:opacity-50"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as "EDITOR" | "VIEWER")}
          disabled={isPending}
          aria-label={t("Permiso")}
          className="rounded-md border border-dashed border-border-subtle bg-transparent px-2 py-1 text-sm disabled:opacity-50"
        >
          <option value="EDITOR">{t("Edita")}</option>
          <option value="VIEWER">{t("Lee")}</option>
        </select>
      </div>
      {friends.length === 0 && (
        <Link href="/profile" className="text-xs text-ink-faint hover:text-ink hover:underline">
          {t("Añade amigos en tu perfil para compartir con un toque")}
        </Link>
      )}
      {state.error && <span className="max-w-xs text-xs text-red-500">{state.error}</span>}
    </form>
  );
}
