import { lines } from '../lines';
import styles from './ScreenTitle.module.css';

/**
 * display: Start, 30/700 centered, description 15px 10 below.
 * title: Verify and Name, 26/700 from the left, description 15px 8 below.
 * dragon: Hatch, the dragon's voice 22px centered, description 14px 8 below.
 */
export type ScreenTitleVariant = 'display' | 'title' | 'dragon';

export interface ScreenTitleProps {
  /** The screen's heading. "\n" breaks the line where the design does. */
  readonly title: string;
  /** One or two plain lines under the heading. */
  readonly description?: string;
  readonly variant: ScreenTitleVariant;
}

/** Draws a screen's heading and the short line under it (ScreenTitle.md). */
export function ScreenTitle({ title, description, variant }: ScreenTitleProps) {
  return (
    <div className={`${styles.group} ${styles[variant]}`}>
      <h1 className={styles.heading}>{lines(title)}</h1>
      {description !== undefined && description !== '' ? (
        <p className={styles.description}>{lines(description)}</p>
      ) : null}
    </div>
  );
}
