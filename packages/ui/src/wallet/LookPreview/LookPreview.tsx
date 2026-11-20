import type { DragonSpecies } from '@sikyeoyong/shared';
import { Dragon, SPECIES_INFO } from '../../dragon/Dragon';
import styles from './LookPreview.module.css';

export interface LookPreviewProps {
  /** The dragon's name; changing the look keeps it. */
  readonly name: string;
  /** The species being looked at (picked, not yet saved). */
  readonly species: DragonSpecies;
}

/** Draws the dragon in a species large, with its name, the species and its catchphrase (LookPreview.md). */
export function LookPreview({ name, species }: LookPreviewProps) {
  const info = SPECIES_INFO[species];
  return (
    // Read out when the pick changes, like the egg picker caption.
    <div className={styles.preview} aria-live="polite">
      <Dragon mood="default" size={168} species={species} />
      <div className={styles.nameRow}>
        <span className={styles.name}>{name}</span>
        <span className={styles.badge}>{info.name}</span>
      </div>
      <p className={styles.line}>&quot;{info.line}&quot;</p>
    </div>
  );
}
