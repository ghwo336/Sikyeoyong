import type { DragonSpecies } from '@sikyeoyong/shared';
import { SPECIES_INFO } from '../../dragon/Dragon/species-info';
import styles from './EggPicker.module.css';

/** The picked species' name and its first line, read out when the pick changes. */
export function EggPickerCaption({ species }: { species: DragonSpecies }) {
  const info = SPECIES_INFO[species];
  return (
    <div className={styles.caption} aria-live="polite">
      <span className={styles.name}>{info.name}</span>
      <span className={styles.line}>&quot;{info.line}&quot;</span>
    </div>
  );
}
