// Shown at once when opening a concept (from a term's card, the map…),
// shaped like the page so it doesn't jump when the real one arrives.
export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-4 px-6 py-8 sm:px-12" aria-busy="true">
      <span className="h-4 w-48 animate-pulse rounded bg-chip" />
      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-2">
        <div className="aspect-square w-full animate-pulse rounded-lg bg-chip max-lg:hidden" />
        <div className="flex flex-col gap-4">
          <span className="h-9 w-2/3 animate-pulse rounded-md bg-chip" />
          <span className="h-5 w-full animate-pulse rounded bg-chip" />
          <span className="h-5 w-4/5 animate-pulse rounded bg-chip" />
          <span className="mt-2 h-4 w-full animate-pulse rounded bg-chip" />
          <span className="h-4 w-11/12 animate-pulse rounded bg-chip" />
          <span className="h-4 w-3/4 animate-pulse rounded bg-chip" />
          <span className="mt-2 size-[52px] animate-pulse rounded-full bg-chip" />
        </div>
      </div>
    </div>
  );
}
