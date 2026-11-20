// The app theme follows the dragon's species (D-32): <html data-species="forest|water|flower|star">
// switches the --theme-* colors packages/ui generates from design/tokens.json. The last species
// is kept in this browser so the next visit paints in it before GET /me answers (no flash).
import { DRAGON_SPECIES, type DragonSpecies, isDragonSpecies } from '@sikyeoyong/shared';

export const DEFAULT_SPECIES: DragonSpecies = 'forest';
export const SPECIES_STORAGE_KEY = 'sikyeoyong.species';

/**
 * Paints the app in a species now. remember: false only previews (the egg being picked, the
 * Look screen before saving); the saved species is remembered for the next visit.
 */
export function applySpecies(species: DragonSpecies, { remember = true } = {}): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.species = species;
  if (!remember) return;
  try {
    localStorage.setItem(SPECIES_STORAGE_KEY, species);
  } catch {
    // Without storage the next visit starts in the default and switches once /me answers.
  }
}

/** The species the page shows now (what a preview goes back to). */
export function shownSpecies(): DragonSpecies {
  const now =
    typeof document === 'undefined' ? undefined : document.documentElement.dataset.species;
  return now !== undefined && isDragonSpecies(now) ? now : DEFAULT_SPECIES;
}

/**
 * The remembered species onto <html>, checked against the known list so a stored value
 * cannot put anything else there. Self-contained: it runs as the inline boot script.
 */
export function bootSpecies(key: string, known: readonly string[]): void {
  try {
    const s = localStorage.getItem(key);
    if (s !== null && known.includes(s)) document.documentElement.dataset.species = s;
  } catch {
    // No storage: the default stays until GET /me answers.
  }
}

/** Runs in <head> before the first paint (app/layout.tsx), so a return visit has no flash. */
export const THEME_BOOT_SCRIPT = `(${bootSpecies.toString()})(${JSON.stringify(
  SPECIES_STORAGE_KEY,
)}, ${JSON.stringify(DRAGON_SPECIES)});`;
