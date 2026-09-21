/** Tiny class-name joiner — no dependency, strips falsy values. */
export function cn(...parts: Array<string | false | null | undefined | 0>): string {
  return parts.filter(Boolean).join(" ");
}
