import Link from "next/link";

// The original blue node/circuit mark (public/logo-mark.png) — already
// used on the landing page's own nav before this rebranding pass. Kept
// as-is rather than replaced by a new monochrome mark: asked for back by
// name ("el azulito") after the monochrome version was tried.
export function LogoMark({ size = 22 }: { size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo-mark.png"
      alt=""
      width={size}
      height={size}
      className="rounded-[22%]"
    />
  );
}

export function Logo({
  href = "/pursuits",
  withWordmark = true,
  size = 22,
  className = "",
}: {
  href?: string;
  withWordmark?: boolean;
  size?: number;
  className?: string;
}) {
  return (
    <Link href={href} className={`flex items-center gap-2 text-ink ${className}`}>
      <LogoMark size={size} />
      {withWordmark && <span className="text-base font-semibold">Synaptic</span>}
    </Link>
  );
}
