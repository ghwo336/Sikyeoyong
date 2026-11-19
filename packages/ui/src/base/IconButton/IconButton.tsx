'use client';

import { Icon, type IconName } from '../Icon';
import styles from './IconButton.module.css';

export interface IconButtonProps {
  readonly icon: IconName;
  /** The button's name for screen readers ("뒤로", "용이 설정"). There is no visible text. */
  readonly label: string;
  readonly onPress: () => void;
  /** start: pulled 10px left so the icon lines up with the 20px screen edge (TopBar back). */
  readonly edge?: 'start';
}

/** Draws a 44px button that shows only a 22px icon (IconButton.md). */
export function IconButton({ icon, label, onPress, edge }: IconButtonProps) {
  return (
    <button
      type="button"
      className={styles.button}
      aria-label={label}
      data-edge={edge}
      onClick={onPress}
    >
      <Icon name={icon} className={styles.icon} />
    </button>
  );
}
