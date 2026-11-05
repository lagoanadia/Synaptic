// Free-typed with suggestions from existing types.
export function TypeSelect({
  options,
  defaultValue = "",
}: {
  options: string[];
  defaultValue?: string;
}) {
  return (
    <>
      <input
        type="text"
        name="type"
        list="pursuit-types"
        defaultValue={defaultValue}
        placeholder="Type (optional)"
        className="rounded-xl border border-border-subtle bg-white px-3.5 py-2.5 text-sm text-ink"
      />
      <datalist id="pursuit-types">
        {options.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
    </>
  );
}
