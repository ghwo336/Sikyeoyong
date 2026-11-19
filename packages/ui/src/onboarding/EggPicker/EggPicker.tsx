'use client';

import { DRAGON_SPECIES, type DragonSpecies } from '@sikyeoyong/shared';
import { radioGroupKeyDown, radioTabIndex } from '../../base/radio-group';
import { Egg } from '../../dragon/Egg';
import styles from './EggPicker.module.css';

/** Name and first line per species (design/tokens.json dragonSpecies, D-20). */
export const SPECIES_INFO: Readonly<Record<DragonSpecies, { name: string; line: string }>> = {
  forest: { name: '숲용', line: '천천히 먹어용' },
  water: { name: '물용', line: '국물이 최고예용' },
  flower: { name: '꽃용', line: '오늘도 수고했어용' },
  star: { name: '별용', line: '야식은 반만 먹어용' },
};

export interface EggPickerProps {
  readonly value: DragonSpecies;
  /** Saving is the parent's job. */
  readonly onChange: (value: DragonSpecies) => void;
}

/** Lets the user pick one of four eggs and shows the picked one large (EggPicker.md). */
export function EggPicker({ value, onChange }: EggPickerProps) {
  const info = SPECIES_INFO[value];
  const selected = DRAGON_SPECIES.indexOf(value);
  return (
    <div className={styles.picker}>
      {/* size.eggHero 132 and size.eggOptionIcon 40 (tokens.json); a test keeps them equal. */}
      <Egg state="closed" species={value} size={132} />
      <div className={styles.caption} aria-live="polite">
        <span className={styles.name}>{info.name}</span>
        <span className={styles.line}>&quot;{info.line}&quot;</span>
      </div>
      <div
        className={styles.options}
        role="radiogroup"
        aria-label="알"
        onKeyDown={radioGroupKeyDown((i) => {
          const s = DRAGON_SPECIES[i];
          if (s) onChange(s);
        })}
      >
        {DRAGON_SPECIES.map((s, i) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={s === value}
            aria-label={`${SPECIES_INFO[s].name} 알`}
            tabIndex={radioTabIndex(i, selected)}
            className={styles.option}
            data-selected={s === value || undefined}
            onClick={() => {
              onChange(s);
            }}
          >
            <Egg state="closed" species={s} size={40} />
          </button>
        ))}
      </div>
    </div>
  );
}
