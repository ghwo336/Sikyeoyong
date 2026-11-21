/**
 * Demo scenes (DEMO_MODE) are reachable only in a demo build. next.config.ts inlines
 * NEXT_PUBLIC_DEMO_MODE (or the root .env DEMO_MODE) at build time; anything but "true" is off.
 * The API says 404 on its own when its DEMO_MODE is off, so a mismatch shows nothing, never numbers.
 */
export function isDemoBuild(
  value: string | undefined = process.env.NEXT_PUBLIC_DEMO_MODE,
): boolean {
  return value?.trim().toLowerCase() === 'true';
}
