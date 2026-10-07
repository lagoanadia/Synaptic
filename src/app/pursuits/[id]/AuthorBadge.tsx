import { AUTHOR_BG, AUTHOR_RING } from "@/lib/authorColor";

// A small profile-photo-or-initial circle, ringed in the author's color
// from the shared Pursuit-card palette — shows who wrote a given Brain
// Dump page at a glance when a Pursuit has more than one collaborator.
export function AuthorBadge({
  name,
  image,
  colorIndex,
}: {
  name: string;
  image: string | null;
  colorIndex: number;
}) {
  const bg = AUTHOR_BG[colorIndex % AUTHOR_BG.length];
  const ring = AUTHOR_RING[colorIndex % AUTHOR_RING.length];
  const initial = (name.trim().charAt(0) || "?").toUpperCase();

  return (
    <span
      title={name}
      className={`flex h-5 w-5 flex-shrink-0 items-center justify-center overflow-hidden rounded-full text-[10px] font-semibold text-white ring-2 ring-offset-1 ring-offset-background ${ring} ${bg}`}
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" className="h-full w-full object-cover" />
      ) : (
        initial
      )}
    </span>
  );
}
