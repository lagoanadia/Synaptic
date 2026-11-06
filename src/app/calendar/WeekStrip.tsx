import Link from "next/link";
import { WEEKDAYS, fromKey, sortItems, type CalItem } from "@/lib/calendar";
import { Pill } from "./Pill";

// Home's "Esta semana": seven days, today ringed, the review marker on today.
export function WeekStrip({ days, today, items }: { days: string[]; today: string; items: CalItem[] }) {
  return (
    <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
      {days.map((d, i) => {
        const list = sortItems(items.filter((x) => x.day === d));
        const isToday = d === today;
        return (
          <Link
            key={d}
            href={`/calendar?m=${d.slice(0, 7)}`}
            className={`flex min-h-24 min-w-0 flex-col gap-1 rounded-lg border p-1.5 hover:bg-[#fbfbfa] sm:min-h-28 sm:p-2.5 ${isToday ? "border-[#e5484d] ring-1 ring-[#e5484d]" : "border-border-subtle"}`}
          >
            <span className="flex items-start justify-between">
              <span className="flex flex-col leading-tight">
                <span className="text-[11px] text-ink-faint">{WEEKDAYS[i]}</span>
                <span className={`text-lg font-semibold ${isToday ? "text-[#e5484d]" : ""}`}>{fromKey(d).getUTCDate()}</span>
              </span>
              {isToday && (
                <span className="hidden size-5 place-items-center rounded bg-accent-soft text-[11px] text-accent sm:grid" title="Repaso de hoy">
                  ▤
                </span>
              )}
            </span>
            <span className="flex flex-col gap-1">
              {list.slice(0, 3).map((x) => (
                <span key={x.id} className="hidden sm:block">
                  <Pill item={x} />
                </span>
              ))}
              {/* Phones: just a dot per event. */}
              <span className="flex flex-wrap gap-0.5 sm:hidden">
                {list.map((x) => (
                  <i key={x.id} className="size-1.5 rounded-full" style={{ background: x.color }} />
                ))}
              </span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}
