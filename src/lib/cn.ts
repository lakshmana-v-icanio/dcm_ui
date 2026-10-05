/** Merge class names, filtering falsy values. */
export function cn(...classes: unknown[]): string {
  return classes.filter(Boolean).join(' ');
}
