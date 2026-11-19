import type { DragonSpecies } from '@sikyeoyong/shared';
import type { ReactNode } from 'react';
import { lines } from '../../base/lines';
import { Dragon, type DragonMood } from '../Dragon';
import styles from './DragonLine.module.css';

export type DragonLineLayout = 'chat' | 'inline' | 'sheet' | 'center' | 'greeting';

export interface DragonLineProps {
  /** What the dragon says. A newline starts a second line. Never truncated (DragonLine.md). */
  readonly text: string;
  readonly mood?: DragonMood;
  readonly layout: DragonLineLayout;
  /** Which dragon sits next to the line (D-20). */
  readonly species: DragonSpecies;
  /** Show the small dragon. Default true. */
  readonly avatar?: boolean;
  /**
   * What the dragon hands over with its words (Main: the recommendation card). Drawn under the
   * text in the same column, so it lines up with the words, not the screen edge.
   */
  readonly children?: ReactNode;
}

// Main.dc.html: 32px dragon, text starts at its top. Done.dc.html: 56px dragon beside 17px text.
// Confirm.dc.html: 44px dragon beside 18px text in a sheet.
// Cap.dc.html, Blocked.dc.html: 128px dragon above 19px text.
// Budget.dc.html: 96px dragon beside 20px text.
const AVATAR_SIZE = { chat: 32, inline: 56, sheet: 44, center: 128, greeting: 96 } as const;

/** Nothing to hand over: what `{cond && <X />}` leaves behind (undefined, null, false, ''). */
function hasContent(children: ReactNode): boolean {
  return children !== undefined && children !== null && children !== false && children !== '';
}

/** Draws one or two lines of the dragon's voice in Gowun Dodum, with a small dragon (DragonLine.md). */
export function DragonLine({
  text,
  mood = 'default',
  layout,
  species,
  avatar = true,
  children,
}: DragonLineProps) {
  const words = <p className={styles.text}>{lines(text)}</p>;
  return (
    <div className={`${styles.line} ${styles[layout]}`}>
      {avatar ? <Dragon mood={mood} size={AVATAR_SIZE[layout]} species={species} /> : null}
      {hasContent(children) ? (
        <div className={styles.body}>
          {words}
          {children}
        </div>
      ) : (
        words
      )}
    </div>
  );
}
