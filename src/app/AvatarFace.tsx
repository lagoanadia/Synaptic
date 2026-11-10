import { avatarSvg, type Avatar } from "@/lib/avatar";

// A drawn avatar in a circle. The SVG is built only from whitelisted
// choices (lib/avatar.ts), so it's safe to inline.
export function AvatarFace({ avatar, size, uid, view, plain = false, className = "" }: { avatar: Avatar; size: number; uid: string; view?: string; plain?: boolean; className?: string }) {
  return (
    <span
      className={`block shrink-0 overflow-hidden rounded-full [&>svg]:block [&>svg]:size-full ${className}`}
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: avatarSvg(avatar, uid, view, plain) }}
    />
  );
}
