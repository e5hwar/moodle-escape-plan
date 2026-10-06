import { UserFilledIcon } from "./icons";

/* A user's avatar when there is no profile photo — Figma 1571:3660 "User
 * Profile Photo": a #404040 circle holding the #a8a8a8 person glyph, drawn
 * 47/48 of the circle wide and 7/48 down from the top so the shoulders run off
 * the bottom edge. Every user in this prototype is photo-less, so it replaces
 * the old orange-gradient initials circle everywhere (list item 53). Scales
 * with `size`. */
export function UserAvatar({ size = 48, className = "" }: { size?: number; className?: string }) {
  return (
    <span
      className={`user-avatar${className ? ` ${className}` : ""}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <UserFilledIcon />
    </span>
  );
}
