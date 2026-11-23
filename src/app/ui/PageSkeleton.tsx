// Shown the moment you click (Next's loading.tsx), so the click visibly
// worked while the page loads: grey shapes where the page will be.
const Bar = ({ w, h = 14, className = "" }: { w: string | number; h?: number; className?: string }) => <span className={`block animate-pulse rounded-md bg-chip ${className}`} style={{ width: w, height: h }} />;

export function PageSkeleton({ kind = "page" }: { kind?: "home" | "notebook" | "folder" | "page" | "calendar" }) {
  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-1 flex-col gap-8 px-6 pt-6 pb-10 sm:px-12" aria-busy="true" aria-label="Cargando">
      <Bar w={160} h={12} />
      <Bar w="45%" h={34} />
      {kind === "home" && (
        <div className="flex gap-6">
          {[0, 1, 2].map((i) => (
            <Bar key={i} w={92} h={120} />
          ))}
        </div>
      )}
      {(kind === "notebook" || kind === "folder") && (
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Bar key={i} w="100%" h={96} />
          ))}
        </div>
      )}
      {kind === "calendar" ? (
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: 35 }, (_, i) => (
            <Bar key={i} w="100%" h={84} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <Bar w="30%" h={18} />
          <Bar w="100%" />
          <Bar w="92%" />
          <Bar w="78%" />
          {kind !== "page" && <Bar w="100%" h={140} className="mt-4" />}
        </div>
      )}
    </div>
  );
}

// The review game is a dark board: a dark screen with a spinner, not grey bars.
export function GameSkeleton() {
  return (
    <div className="fixed inset-x-0 top-0 bottom-16 z-40 grid place-items-center bg-[#18181b] lg:bottom-0 lg:z-50" aria-busy="true" aria-label="Cargando">
      <span className="block size-9 animate-spin rounded-full border-[3px] border-white/15 border-t-white/70" />
    </div>
  );
}
