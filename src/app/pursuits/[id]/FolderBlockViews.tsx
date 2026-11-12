import { getT } from "@/lib/i18n/server";
import Link from "next/link";
import { CheckIcon } from "@/app/icons";
import { LANGUAGE_INFO, asLanguage } from "@/lib/challenge";
import { LANGUAGE_STYLE, difficultyOf } from "@/app/challenges/look";

// "Repaso": today's small batch as a stack of cards, and one button to
// play it. No counts.
export async function ReviewToday({ pursuitId }: { pursuitId: string }) {
  const t = await getT();
  const q = `pursuit=${pursuitId}`;
  return (
    <div className="flex flex-wrap items-center gap-8 rounded-lg bg-sidebar px-6 py-5">
      <div className="relative h-20 w-32 shrink-0" aria-hidden>
        {[-6, 3, 0].map((rot, i) => (
          <span
            key={i}
            className="absolute inset-0 rounded-md bg-white shadow-[0_0_0_1px_rgba(15,15,15,.06),0_4px_10px_rgba(15,15,15,.06)]"
            style={{ transform: `rotate(${rot}deg)`, backgroundImage: "repeating-linear-gradient(var(--paper) 0 15px, var(--paper-line) 15px 16px)" }}
          />
        ))}
      </div>
      <Link href={`/review?${q}`} className="flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white">
        {t("▶ Repasar")}
      </Link>
    </div>
  );
}

// "Retos": this subject's coding challenges, and a way to get more.
export async function ChallengeCards({
  pursuitId,
  items,
}: {
  pursuitId: string;
  items: { id: string; title: string; language: string; difficulty: string; passed: boolean }[];
}) {
  const t = await getT();
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((c) => {
        const lang = asLanguage(c.language);
        const d = difficultyOf(c.difficulty);
        return (
          <Link key={c.id} href={`/challenges/${c.id}`} className={`flex flex-col gap-3 rounded-lg border border-border-subtle p-4 hover:shadow-sm ${c.passed ? "bg-[#f4f8f3]" : "bg-white"}`}>
            <span className={`grid size-8 place-items-center rounded-md font-mono text-[11px] font-bold ${LANGUAGE_STYLE[lang].badge}`}>{LANGUAGE_INFO[lang].short}</span>
            <span className="text-sm font-semibold">{c.title}</span>
            <span className="flex items-center gap-2 text-xs text-ink-muted">
              <span className={`size-2 rounded-full ${d.bar}`} /> {t(d.label)}
              {c.passed && (
                <span className="ml-auto flex items-center gap-1 font-semibold text-[#448361]">
                  <CheckIcon size={12} />{" "}{t("Resuelto")}
                </span>
              )}
            </span>
          </Link>
        );
      })}
      <Link href={`/challenges?pursuit=${pursuitId}`} className="grid min-h-28 place-items-center rounded-lg border border-dashed border-[#d3d1cb] text-sm text-ink-faint hover:text-ink">
        {t("+ Dame 3 retos")}
      </Link>
    </div>
  );
}
