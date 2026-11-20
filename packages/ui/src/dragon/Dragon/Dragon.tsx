import type { DragonSpecies } from '@sikyeoyong/shared';
import styles from './Dragon.module.css';
import { Bowl, Extras, Wings } from './DragonEffects';
import { Head, HidingHead } from './DragonFace';
import { ShellPattern } from './DragonSpecies';

export type DragonMood =
  'default' | 'happy' | 'excited' | 'worried' | 'hiding' | 'sleeping' | 'eating' | 'cooking';
export type DragonSize = 32 | 44 | 56 | 64 | 96 | 104 | 128 | 168;

export interface DragonProps {
  readonly mood: DragonMood;
  readonly size: DragonSize;
  readonly species: DragonSpecies;
  /** Stage 3 grows wings: a per-order limit over 30,000 (shared dragonStage, Dragon.md). */
  readonly wings?: boolean;
}

// Paths follow design/screens/Dragons.dc.html (species) and Main, Arrived, Blocked,
// Cap, Done (moods). Temporary art: a real illustration replaces only this folder.
// Parts: DragonSpecies.tsx (crest, forehead, shell pattern), DragonFace.tsx (head and face
// by mood), DragonEffects.tsx (Zz, sweat, steam, bowl, wings). This file puts them in order.
const SHELL =
  'M8 38 L14 33 L20 38 L26 33 L32 38 L38 33 L44 38 L50 33 L56 38 C56 52 46 60 32 60 C18 60 8 52 8 38 Z';
// Blocked.dc.html: hiding uses a slightly higher rim with the head sunk behind it.
const SHELL_HIDING =
  'M8 36 L14 32 L20 36.5 L26 32.5 L32 37 L38 32.5 L44 36.5 L50 32 L56 36 C56 51 46 60 32 60 C18 60 8 51 8 36 Z';

/** Draws the baby dragon for a species, mood and size (Dragon.md). Decorative: hidden from screen readers. */
export function Dragon({ mood, size, species, wings = false }: DragonProps) {
  const hiding = mood === 'hiding';
  return (
    <svg
      className={styles.dragon}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
      data-species={species}
      data-mood={mood}
    >
      {wings ? <Wings /> : null}
      {hiding ? <HidingHead species={species} /> : <Head mood={mood} species={species} />}
      <Extras mood={mood} />
      <path
        data-part={hiding ? 'shell-hiding' : 'shell'}
        className={styles.shell}
        d={hiding ? SHELL_HIDING : SHELL}
      />
      <ShellPattern species={species} />
      {mood === 'eating' ? <Bowl /> : null}
    </svg>
  );
}
