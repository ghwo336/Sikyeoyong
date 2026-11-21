import type { DragonSpecies } from '@sikyeoyong/shared';
import { Dragon } from '../../dragon/Dragon';
import styles from './Splash.module.css';

/** Splash.dc.html words. */
export const SPLASH_TITLE = '시켜용';
export const SPLASH_TAGLINE = '배달은 용이한테 시켜용';
export const SPLASH_STATUS = '용이를 깨우는 중이에요';
// Splash.dc.html says "마루 테스트넷 데모"; a chain word on screen (D-17, CLAUDE.md 12), so it
// is the plain demo mark until the canvas changes (Splash.md "시안과 다른 점").
export const SPLASH_FOOTER = '체험용 데모';
/** The name of the skip press for keyboards and screen readers. */
export const SPLASH_SKIP_LABEL = '시켜용 시작하기';

// Splash.dc.html: the white sticker edge around the dragon, drawn behind it.
const HALO =
  'M32 61 C17 61 6.5 52 6.5 38 L6.5 36 L14 30.5 L17 32.5 C17 22 23 14.5 25 14 C20 11 19 4 24.5 0.8 C29 3.5 30.5 9 29 13.6 L35 13.6 C33.5 9 35 3.5 39.5 0.8 C45 4 44 11 39 14 C41 14.5 47 22 47 32.5 L50 30.5 L57.5 36 L57.5 38 C57.5 52 47 61 32 61 Z';

export interface SplashProps {
  /** The species to show (the one this device last showed; forest on a first visit). */
  readonly species: DragonSpecies;
  /** A press anywhere: the parent stops waiting on the splash. */
  readonly onSkip?: () => void;
}

/** Draws the full-screen loading splash: the bobbing dragon, the name and "waking" dots (Splash.md). */
export function Splash({ species, onSkip }: SplashProps) {
  return (
    // A press anywhere skips (user-flow 0). For keyboards and screen readers the skip is a real
    // button laid over the screen (last, so it is on top). It is not the root: a button's
    // children are presentational, and the status line must stay announced while it waits.
    // The button's own click (Enter, Space, or a press on it) bubbles to the root's onClick,
    // so onSkip runs once.
    <div className={styles.splash} onClick={onSkip} data-part="splash">
      <div className={styles.figure}>
        <div className={styles.bob} data-part="bob">
          <svg className={styles.halo} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
            <path d={HALO} />
          </svg>
          <Dragon mood="default" size={168} species={species} />
        </div>
        <div className={styles.shadow} aria-hidden="true" />
      </div>
      <div className={styles.words}>
        <p className={styles.title}>{SPLASH_TITLE}</p>
        <p className={styles.tagline}>{SPLASH_TAGLINE}</p>
      </div>
      <div className={styles.status} role="status">
        <span className={styles.dots} aria-hidden="true">
          <span className={styles.dot} />
          <span className={styles.dot} />
          <span className={styles.dot} />
        </span>
        <span>{SPLASH_STATUS}</span>
      </div>
      <p className={styles.footer}>{SPLASH_FOOTER}</p>
      {onSkip ? (
        <button
          type="button"
          className={styles.skip}
          aria-label={SPLASH_SKIP_LABEL}
          data-part="skip"
        />
      ) : null}
    </div>
  );
}
