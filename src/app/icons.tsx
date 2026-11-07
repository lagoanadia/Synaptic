// Small line icons for the redesign (calendar / bell / brain / gamepad…).
// Inline SVG with currentColor, so they follow the text color they sit in.
type IconProps = { size?: number; className?: string; title?: string };

function Svg({
  size = 18,
  className,
  title,
  children,
  strokeWidth = 1.8,
}: IconProps & { children: React.ReactNode; strokeWidth?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
    >
      {title && <title>{title}</title>}
      {children}
    </svg>
  );
}

export const CalendarIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </Svg>
);

export const BellIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16Z" />
    <path d="M10 20.5a2 2 0 0 0 4 0" />
  </Svg>
);

export const BrainIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9.5 4.5a3 3 0 0 0-3 3 3 3 0 0 0-2 5.2A3.2 3.2 0 0 0 7.8 18a2.7 2.7 0 0 0 4.2 1V5.8a2.7 2.7 0 0 0-2.5-1.3Z" />
    <path d="M14.5 4.5a3 3 0 0 1 3 3 3 3 0 0 1 2 5.2 3.2 3.2 0 0 1-3.3 5.3 2.7 2.7 0 0 1-4.2 1V5.8a2.7 2.7 0 0 1 2.5-1.3Z" />
  </Svg>
);

export const GamepadIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 8h10a4.5 4.5 0 0 1 4.4 5.4l-.7 3.4a2.4 2.4 0 0 1-4.1 1.1L14.5 16h-5l-2.1 1.9a2.4 2.4 0 0 1-4.1-1.1l-.7-3.4A4.5 4.5 0 0 1 7 8Z" />
    <path d="M8 11v3M6.5 12.5h3M15.5 12h.01M17.5 13.5h.01" />
  </Svg>
);

export const SparkIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" />
  </Svg>
);

export const BoltIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M13 3 5 13.5h6L10 21l8-10.5h-6L13 3Z" />
  </Svg>
);

export const CardsIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="6" y="4" width="13" height="16" rx="2.5" />
    <path d="M4 7.5v10A2.5 2.5 0 0 0 6.5 20" />
  </Svg>
);

export const QuestionIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.6 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.4M12 17h.01" />
  </Svg>
);

export const TrashIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 7h16M10 11v6M14 11v6M5.5 7l1 12a2 2 0 0 0 2 1.8h7a2 2 0 0 0 2-1.8l1-12M9 7V4.5h6V7" />
  </Svg>
);

// Navigation arrows: bold, so they read as buttons, not punctuation.
// "inline" ones sit on the text baseline next to a label.
const arrow = (d: string) =>
  function Arrow({ size = 15, className = "inline-block align-[-3px]", title }: IconProps) {
    return (
      <Svg size={size} className={className} title={title} strokeWidth={2.6}>
        <path d={d} />
      </Svg>
    );
  };

export const ArrowLeft = arrow("M19 12H5M11 6l-6 6 6 6");
export const ArrowRight = arrow("M5 12h14M13 6l6 6-6 6");
export const ArrowDown = arrow("M12 5v14M6 13l6 6 6-6");
export const ArrowUpRight = arrow("M7 17 17 7M8 7h9v9");
export const ChevronLeft = arrow("M15 6l-6 6 6 6");
export const ChevronRight = arrow("M9 6l6 6-6 6");

// UI icons (replace emoji and symbol characters).
const icon = (paths: string[], strokeWidth = 2) =>
  function Icon({ size = 16, className = "inline-block align-[-3px]", title }: IconProps) {
    return (
      <Svg size={size} className={className} title={title} strokeWidth={strokeWidth}>
        {paths.map((d) => (
          <path key={d} d={d} />
        ))}
      </Svg>
    );
  };

export const CheckIcon = icon(["M5 12.5l4.5 4.5L19 7.5"], 2.6);
export const XIcon = icon(["M6 6l12 12M18 6 6 18"], 2.4);
export const LinkIcon = icon(["M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1", "M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"]);
export const ImageIcon = icon(["M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5Z", "M4 16l4.5-4.5 4 4L15 13l5 5", "M15.5 8.5h.01"]);
export const MicIcon = icon(["M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Z", "M6 11.5a6 6 0 0 0 12 0M12 17.5V21"]);
export const StopIcon = icon(["M7 7h10v10H7Z"]);
export const AlertIcon = icon(["M12 4 2.8 19.5h18.4L12 4Z", "M12 10v4.5M12 17.2h.01"]);
export const BellOffIcon = icon(["M9 5.3A6 6 0 0 1 18 11v4M6 11v5l-1.5 2h12M10 20.5a2 2 0 0 0 4 0M3 3l18 18"]);
export const SlidesIcon = icon(["M3.5 5h17v11h-17Z", "M12 16v4M8.5 20h7"]);
export const QuoteIcon = icon(["M5 7h14M5 12h14M5 17h9", "M2.5 5v14"]);
export const GlobeIcon = icon(["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z", "M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3Z"]);
export const MenuIcon = icon(["M4 7h16M4 12h16M4 17h16"], 2.2);
export const HomeIcon = icon(["M4 11 12 4l8 7v8.5a.5.5 0 0 1-.5.5H15v-6H9v6H4.5a.5.5 0 0 1-.5-.5Z"]);
export const SettingsIcon = icon(["M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z", "M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"]);
export const CodeIcon = icon(["M9 8l-4 4 4 4M15 8l4 4-4 4"], 2.2);
export const ChatIcon = icon(["M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-8l-4 3.5V16H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z"]);
// Three linked dots: a concept map.
export const MapIcon = icon(["M6 7a2 2 0 1 0 0-.01M18 9a2 2 0 1 0 0-.01M10 18a2 2 0 1 0 0-.01", "M7.8 7.6l8.3 1.2M7 8.8l2.2 7.4M16.6 10.4l-5 6"]);
export const KanbanIcon = icon(["M4 5h4v14H4ZM10 5h4v9h-4ZM16 5h4v6h-4Z"]);
