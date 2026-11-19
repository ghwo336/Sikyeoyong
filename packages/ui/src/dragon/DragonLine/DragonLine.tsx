import type { DragonSpecies } from '@sikyeoyong/shared';
import { Dragon, type DragonMood } from '../Dragon';
import styles from './DragonLine.module.css';

export type DragonLineLayout = 'chat' | 'inline' | 'center';

export interface DragonLineProps {
  /** What the dragon says. A newline starts a second line. Never truncated (DragonLine.md). */
  readonly text: string;
  readonly mood?: DragonMood;
  readonly layout: DragonLineLayout;
  /** Which dragon sits next to the line (D-20). */
  readonly species: DragonSpecies;
  /** Show the small dragon. Default true. */
  readonly avatar?: boolean;
}

// Main.dc.html: 32px dragon, text starts at its top. Done.dc.html: 56px dragon beside 17px text.
// Cap.dc.html, Blocked.dc.html: 128px dragon above 19px text.
const AVATAR_SIZE = { chat: 32, inline: 56, center: 128 } as const;

/** Draws one or two lines of the dragon's voice in Gowun Dodum, with a small dragon (DragonLine.md). */
export function DragonLine({
  text,
  mood = 'default',
  layout,
  species,
  avatar = true,
}: DragonLineProps) {
  const lines = text.split('\n');
  return (
    <div className={`${styles.line} ${styles[layout]}`}>
      {avatar ? <Dragon mood={mood} size={AVATAR_SIZE[layout]} species={species} /> : null}
      <p className={styles.text}>
        {lines.map((l, i) => (
          <span key={i}>
            {i > 0 ? <br /> : null}
            {l}
          </span>
        ))}
      </p>
    </div>
  );
}
