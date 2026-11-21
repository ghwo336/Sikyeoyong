'use client';

import { DRAGON_SPECIES, type DragonSpecies } from '@sikyeoyong/shared';
import { ChoiceGroup } from '../../base/ChoiceGroup';
import { Egg } from '../../dragon/Egg';
import styles from './EggPicker.module.css';
import { SPECIES_INFO } from '../../dragon/Dragon/species-info';
import { EggPickerCaption } from './EggPickerCaption';

export interface EggPickerProps {
  readonly value: DragonSpecies;
  /** Saving is the parent's job. */
  readonly onChange: (value: DragonSpecies) => void;
}

/** Lets the user pick one of four eggs and shows the picked one large (EggPicker.md). */
export function EggPicker({ value, onChange }: EggPickerProps) {
  return (
    <div className={styles.picker}>
      {/* size.eggHero 132 and size.eggOptionIcon 40 (tokens.json); a test keeps them equal. */}
      <Egg state="closed" species={value} size={132} />
      <EggPickerCaption species={value} />
      <ChoiceGroup
        label="알"
        layout="row"
        options={DRAGON_SPECIES}
        value={value}
        onChange={onChange}
        keyOf={(s) => s}
        renderOption={(s, state) => (
          <button
            type="button"
            data-press
            role="radio"
            aria-checked={state.selected}
            aria-label={`${SPECIES_INFO[s].name} 알`}
            tabIndex={state.tabIndex}
            className={styles.option}
            data-selected={state.selected || undefined}
            onClick={state.select}
          >
            <Egg state="closed" species={s} size={40} />
          </button>
        )}
      />
    </div>
  );
}
