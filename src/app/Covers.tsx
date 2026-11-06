import { FILTER_FOLDERS, FOLDER_COVERS, PATTERN_NOTEBOOKS, type FolderCover, type NotebookCover } from "@/lib/covers";

// How a cover's rectangle is painted: a pattern fill or a noise filter.
const notebookPaint = (c: NotebookCover) => (PATTERN_NOTEBOOKS.includes(c) ? { fill: `url(#nbp-${c})` } : { filter: `url(#nb-${c})` });
const folderPaint = (c: FolderCover) => (FILTER_FOLDERS.includes(c) ? { filter: `url(#ff-${c})` } : { fill: `url(#fp-${c})` });

// A composition notebook: textured cover, black cloth spine, white label.
export function Notebook({
  cover,
  name,
  width = 92,
  label = true,
  className = "",
}: {
  cover: NotebookCover;
  name?: string;
  width?: number;
  label?: boolean;
  className?: string;
}) {
  const height = Math.round(width * 1.3);
  return (
    <span
      className={`relative block shrink-0 overflow-hidden rounded-[3px_6px_6px_3px] shadow-[0_1px_1px_rgba(0,0,0,.08),0_10px_24px_-8px_rgba(40,30,20,.35)] ${className}`}
      style={{ width, height }}
    >
      <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" aria-hidden>
        <rect width="100%" height="100%" {...notebookPaint(cover)} />
      </svg>
      <span className="absolute inset-y-0 left-0 w-[11%] bg-[#1c1a17] shadow-[inset_-2px_0_3px_rgba(255,255,255,.12)]" />
      {label && width >= 60 && (
        <span className="absolute top-[16%] right-[9%] left-[19%] rounded-[3px] bg-[#fbf8f1] px-1 py-1.5 text-center shadow-[0_1px_2px_rgba(0,0,0,.25)]">
          <span className="pointer-events-none absolute inset-[3px] rounded-[2px] border border-[#2b2a28]" />
          <span className="block truncate text-[7px] leading-[9px] font-bold tracking-[.06em] text-[#2b2a28] uppercase">{name}</span>
          <span className="mx-1.5 mt-1 block h-px bg-[#2b2a28]/50" />
          <span className="mx-1.5 mt-0.5 block h-px bg-[#2b2a28]/50" />
        </span>
      )}
    </span>
  );
}

// A tiny notebook for the sidebar and pickers.
export function MiniNotebook({ cover, size = 16 }: { cover: NotebookCover; size?: number }) {
  return (
    <span className="relative block shrink-0 overflow-hidden rounded-[1px_2px_2px_1px]" style={{ width: Math.round(size * 0.75), height: size }}>
      <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" aria-hidden>
        <rect width="100%" height="100%" {...notebookPaint(cover)} />
      </svg>
    </span>
  );
}

// A file folder with a tab. `sheets` (0–3) peek out of the top: how much
// is left to do in it, shown without numbers. Fluid: give it a width (px)
// or let it fill its container; it keeps its proportions.
export function Folder({
  cover,
  width,
  sheets = 0,
  className = "",
}: {
  cover: FolderCover;
  width?: number;
  sheets?: number;
  className?: string;
}) {
  const color = FOLDER_COVERS[cover];
  return (
    <span className={`relative block shrink-0 ${className}`} style={{ width: width ?? "100%", paddingTop: sheets ? "12%" : 0 }}>
      {sheets > 0 && (
        <span className="absolute inset-x-[10%] top-0 h-[30%]" aria-hidden>
          {[...Array(Math.min(3, sheets))].map((_, i) => (
            <span
              key={i}
              className="absolute h-[200%] rounded-[2px] border border-[#e3ddcf] bg-[#fffef9] shadow-[0_1px_2px_rgba(0,0,0,.08)]"
              style={{
                top: i * 3,
                left: `${4 + i * 6}%`,
                right: `${14 - i * 4}%`,
                transform: `rotate(${[-3, 2, -1][i]}deg)`,
                backgroundImage: "repeating-linear-gradient(transparent 0 5px, #d6dbe4 5px 6px)",
                backgroundSize: "60% 100%",
                backgroundRepeat: "no-repeat",
                backgroundPosition: "12% 6px",
              }}
            />
          ))}
        </span>
      )}
      <span className="relative z-[1] block h-[9px] w-[42%] rounded-t-[6px]" style={{ background: color }} />
      <span className="relative z-[2] block aspect-[3/2] overflow-hidden rounded-[0_6px_6px_6px] shadow-[0_1px_1px_rgba(0,0,0,.08),0_8px_18px_-8px_rgba(40,30,20,.35)]" style={{ background: color }}>
        <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" aria-hidden>
          <rect width="100%" height="100%" {...folderPaint(cover)} />
        </svg>
      </span>
    </span>
  );
}
