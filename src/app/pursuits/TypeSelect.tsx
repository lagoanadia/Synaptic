// Free-typed and optional, same pattern as the Section input — no "use
// client" needed since a plain text input + datalist needs no local
// state, unlike the old fixed dropdown (which had to reveal a custom-name
// field when "Other" was picked).
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
