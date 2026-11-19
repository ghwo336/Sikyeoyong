'use client';

import { Fragment, type ReactNode, useId } from 'react';
import { radioGroupKeyDown, radioTabIndex } from '../radio-group';
import styles from './ChoiceGroup.module.css';

/** What each option needs to act as one radio of the group. */
export interface ChoiceState {
  readonly selected: boolean;
  /** 0 on the one Tab enters, -1 on the rest (WAI-ARIA radio group). */
  readonly tabIndex: 0 | -1;
  readonly select: () => void;
}

/**
 * columns: equal columns, 8 apart (Budget chips, Arrived tiles).
 * row: content width, 10 apart (Name eggs).
 */
export type ChoiceGroupLayout = 'columns' | 'row';

export interface ChoiceGroupProps<T> {
  readonly options: readonly T[];
  /** The picked option; undefined when nothing is picked yet. */
  readonly value: T | undefined;
  /** Saving is the parent's job. Called on press and on arrow keys. */
  readonly onChange: (value: T) => void;
  /** Stable key per option. */
  readonly keyOf: (option: T) => string;
  /** Draws one option as a role="radio" element (a Chip, an egg button). */
  readonly renderOption: (option: T, state: ChoiceState) => ReactNode;
  readonly layout: ChoiceGroupLayout;
  /** Visible question over the choices, 15/600 ("이번 달 배달 예산"). */
  readonly title?: string;
  /** Name for screen readers when there is no visible title ("알"). */
  readonly label?: string;
}

/** Draws a titled group of choices where exactly one is picked, with radio keys (ChoiceGroup.md). */
export function ChoiceGroup<T>({
  options,
  value,
  onChange,
  keyOf,
  renderOption,
  layout,
  title,
  label,
}: ChoiceGroupProps<T>) {
  const titleId = useId();
  const selectedIndex = value === undefined ? -1 : options.indexOf(value);
  const group = (
    <div
      className={styles[layout]}
      role="radiogroup"
      aria-labelledby={title !== undefined ? titleId : undefined}
      aria-label={title === undefined ? label : undefined}
      onKeyDown={radioGroupKeyDown((i) => {
        const o = options[i];
        if (o !== undefined) onChange(o);
      })}
    >
      {options.map((o, i) => (
        // No wrapper: each radio is the grid or flex item itself, as in the designs.
        <Fragment key={keyOf(o)}>
          {renderOption(o, {
            selected: i === selectedIndex,
            tabIndex: radioTabIndex(i, selectedIndex),
            select: () => {
              onChange(o);
            },
          })}
        </Fragment>
      ))}
    </div>
  );
  if (title === undefined) return group;
  return (
    <div className={styles.group}>
      <p id={titleId} className={styles.title}>
        {title}
      </p>
      {group}
    </div>
  );
}
