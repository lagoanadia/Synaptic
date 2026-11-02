import Link from "next/link";

// A 3-node synapse mark: a "hub" node (bottom-left) connected by two lines
// to a pair of smaller nodes, echoing the app's own idea of raw notes
// connecting into something organized. Monochrome #0D0D0D only, no fills
// beyond that — stays legible down to a 16px favicon.
export function LogoMark({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <line x1="6" y1="18" x2="18" y2="6" stroke="#0d0d0d" strokeWidth="1.7" strokeLinecap="round" />
      <line x1="6" y1="18" x2="18" y2="18" stroke="#0d0d0d" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="6" cy="18" r="3" fill="#0d0d0d" />
      <circle cx="18" cy="6" r="2.3" fill="#0d0d0d" />
      <circle cx="18" cy="18" r="2.3" fill="#0d0d0d" />
    </svg>
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
