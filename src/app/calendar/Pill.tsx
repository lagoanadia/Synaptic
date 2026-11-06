import type { CalItem } from "@/lib/calendar";

const MARK: Partial<Record<CalItem["kind"], string>> = { exam: "◆ ", task: "☐ " };

// One event in a day: exams solid in the folder's colour, deliverables
// tinted, tasks with a box, the rest outlined (Google in blue).
export function Pill({ item, onClick }: { item: CalItem; onClick?: (e: React.MouseEvent<HTMLElement>) => void }) {
  const c = item.color;
  const style: React.CSSProperties =
    item.kind === "exam"
      ? { background: c, color: "#fff" }
      : item.kind === "due"
        ? { background: `color-mix(in srgb, ${c} 14%, white)`, color: `color-mix(in srgb, ${c} 80%, black)`, borderLeft: `3px solid ${c}` }
        : item.kind === "task"
          ? { background: "#f7f6f3", borderLeft: `3px solid ${c}` }
          : { background: "#fff", borderLeft: `3px solid ${c}`, boxShadow: "inset 0 0 0 1px #e9e8e4" };
  const mark = item.kind === "task" && item.done ? "☑ " : MARK[item.kind];
  const Tag = onClick ? "button" : "span";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      style={style}
      title={item.title}
      className={`block w-full truncate rounded-[4px] px-1.5 py-0.5 text-left text-xs ${item.kind === "exam" ? "font-semibold" : ""} ${item.done ? "line-through opacity-60" : ""}`}
    >
      {mark}
      {item.time && item.kind !== "google" ? `${item.time} ` : ""}
      {item.title}
      {item.time && item.kind === "google" ? ` ${item.time}` : ""}
    </Tag>
  );
}
