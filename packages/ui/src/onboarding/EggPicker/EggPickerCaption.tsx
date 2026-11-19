import type { DragonSpecies } from '@sikyeoyong/shared';
import styles from './EggPicker.module.css';

/** Name and first line per species (design/tokens.json dragonSpecies, D-20). */
export const SPECIES_INFO: Readonly<Record<DragonSpecies, { name: string; line: string }>> = {
  forest: { name: '숲용', line: '천천히 먹어용' },
  water: { name: '물용', line: '국물이 최고예용' },
  flower: { name: '꽃용', line: '오늘도 수고했어용' },
  star: { name: '별용', line: '야식은 반만 먹어용' },
};

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
