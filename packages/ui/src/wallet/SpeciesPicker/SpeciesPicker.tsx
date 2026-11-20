'use client';

import { DRAGON_SPECIES, type DragonSpecies } from '@sikyeoyong/shared';
import { ChoiceGroup } from '../../base/ChoiceGroup';
import { Dragon, SPECIES_INFO } from '../../dragon/Dragon';
import styles from './SpeciesPicker.module.css';

/** Look.dc.html, the line under the choices: what changes and what stays. */
export const LOOK_NOTE = '모습과 말버릇, 앱 색만 바뀌어요. 이름, 용돈, 한도는 그대로예요.';

export interface SpeciesPickerProps {
  /** The species picked on screen (not yet saved). */
  readonly value: DragonSpecies;
  /** Saving is the parent's job. Called on press and on arrow keys. */
  readonly onChange: (value: DragonSpecies) => void;
}

/** Lets the owner pick one of the four dragon looks, with the line on what stays (SpeciesPicker.md). */
export function SpeciesPicker({ value, onChange }: SpeciesPickerProps) {
  return (
    <div className={styles.picker}>
      <ChoiceGroup
        label="용이 모습"
        layout="columns"
        options={DRAGON_SPECIES}
        value={value}
        onChange={onChange}
        keyOf={(s) => s}
        renderOption={(s, state) => (
          <button
            type="button"
            role="radio"
            aria-checked={state.selected}
            tabIndex={state.tabIndex}
            className={styles.option}
            data-selected={state.selected || undefined}
            onClick={state.select}
          >
            <Dragon mood="default" size={56} species={s} />
            <span className={styles.name}>{SPECIES_INFO[s].name}</span>
          </button>
        )}
      />
      <p className={styles.note}>{LOOK_NOTE}</p>
    </div>
  );
}
