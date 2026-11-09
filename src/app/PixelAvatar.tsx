import type { Avatar } from "@/lib/avatar";
import { N, pixelAvatar } from "@/lib/pixelAvatar";

// The pixel-art avatar as crisp SVG squares (runs of one colour per row).
export function PixelAvatar({ avatar, size = 40, className = "", title }: { avatar: Avatar; size?: number; className?: string; title?: string }) {
  const grid = pixelAvatar(avatar);
  const rects: React.ReactNode[] = [];
  grid.forEach((row, y) => {
    let x = 0;
    while (x < N) {
      const c = row[x];
      let w = 1;
      while (x + w < N && row[x + w] === c) w++;
      if (c) rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={w} height={1} fill={c} />);
      x += w;
    }
  });
  return (
    <svg viewBox={`0 0 ${N} ${N}`} width={size} height={size} className={className} shapeRendering="crispEdges" role="img" aria-label={title ?? "Avatar"}>
      {rects}
    </svg>
  );
}
