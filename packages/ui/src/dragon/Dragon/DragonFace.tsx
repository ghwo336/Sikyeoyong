import type { DragonSpecies } from '@sikyeoyong/shared';
import type { ReactNode } from 'react';
import type { DragonMood } from './Dragon';
import styles from './Dragon.module.css';
import { Crest, HeadDecor } from './DragonSpecies';

// The face by mood (Main, Arrived, Blocked, Cap, Done) on the head of a species.

/** Every mood but hiding shows the whole head. */
export type FaceMood = Exclude<DragonMood, 'hiding'>;

function Eyes({ mood, species }: { mood: FaceMood; species: DragonSpecies }): ReactNode {
  if (mood === 'excited') {
    // Wide open eyes (design Main, second dragon) with the happy open mouth.
    return (
      <g data-part="eyes-big">
        <circle className={styles.ink} cx="26" cy="29" r="2.9" />
        <circle className={styles.ink} cx="38" cy="29" r="2.9" />
        <circle className={styles.white} cx="27" cy="28" r="1" />
        <circle className={styles.white} cx="39" cy="28" r="1" />
      </g>
    );
  }
  if (mood === 'happy') {
    return (
      <g data-part="eyes-arc">
        <path className={styles.line} d="M23.5 29 Q26 26.5 28.5 29" />
        <path className={styles.line} d="M35.5 29 Q38 26.5 40.5 29" />
      </g>
    );
  }
  if (mood === 'sleeping' || mood === 'eating') {
    return (
      <g data-part="eyes-closed">
        <path className={styles.line} d="M23.5 28 Q26 30 28.5 28" />
        <path className={styles.line} d="M35.5 28 Q38 30 40.5 28" />
      </g>
    );
  }
  // Dragons.dc.html: the star winks, in its default face only.
  const wink = species === 'star' && mood === 'default';
  return (
    <g data-part={wink ? 'eyes-wink' : 'eyes-dot'}>
      {mood === 'worried' ? (
        <g data-part="brows">
          <path className={styles.line} d="M23.5 25.5 L28 26.5" />
          <path className={styles.line} d="M40.5 25.5 L36 26.5" />
        </g>
      ) : null}
      <circle className={styles.ink} cx="26" cy="29" r="2.4" />
      <circle className={styles.white} cx="26.8" cy="28.2" r="0.8" />
      {wink ? (
        <path className={styles.line} d="M35.6 29 Q38 26.6 40.4 29" />
      ) : (
        <>
          <circle className={styles.ink} cx="38" cy="29" r="2.4" />
          <circle className={styles.white} cx="38.8" cy="28.2" r="0.8" />
        </>
      )}
    </g>
  );
}

function Mouth({ mood, species }: { mood: FaceMood; species: DragonSpecies }): ReactNode {
  switch (mood) {
    case 'happy':
    case 'excited':
      return <path data-part="mouth-open" className={styles.inkFill} d="M29 33 Q32 38 35 33 Z" />;
    case 'worried':
      return <path data-part="mouth-wavy" className={styles.line} d="M30 35.5 Q32 34 34 35.5" />;
    case 'cooking':
      return <ellipse data-part="mouth-o" className={styles.ink} cx="32" cy="35" rx="2" ry="2.4" />;
    case 'eating':
      return <path data-part="mouth-small" className={styles.line} d="M30 35.5 Q32 34 34 35.5" />;
    case 'sleeping':
      return <path data-part="mouth-sleep" className={styles.line} d="M31 35 Q32 35.8 33 35" />;
    case 'default':
      // Dragons.dc.html: the star's grin is a little wider.
      return species === 'star' ? (
        <path data-part="mouth-grin" className={styles.line} d="M29.5 34 Q32 37 34.5 34" />
      ) : (
        <path data-part="mouth-smile" className={styles.line} d="M30 34.5 Q32 36.5 34 34.5" />
      );
  }
}

/** Blocked.dc.html: head sunk to cy 40 behind the rim; worried brows and eyes show just above it. */
export function HidingHead({ species }: { species: DragonSpecies }): ReactNode {
  return (
    <g data-part="head-lowered">
      <g transform="translate(0 11)">
        <Crest species={species} />
      </g>
      <circle data-part="head" className={styles.body} cx="32" cy="40" r="15" />
      <g transform="translate(0 10)">
        <HeadDecor species={species} />
      </g>
      <g data-part="brows">
        <path className={styles.line} d="M23.5 29.5 L28 30.5" />
        <path className={styles.line} d="M40.5 29.5 L36 30.5" />
      </g>
      <g data-part="eyes-peek">
        <circle className={styles.ink} cx="26.5" cy="33" r="2.2" />
        <circle className={styles.ink} cx="37.5" cy="33" r="2.2" />
      </g>
    </g>
  );
}

/** The head up: crest, head, forehead marks, eyes, cheeks and mouth. */
export function Head({ mood, species }: { mood: FaceMood; species: DragonSpecies }): ReactNode {
  // Dragons.dc.html: the flower's cheeks are a little bigger.
  const rx = species === 'flower' ? 3.2 : 2.8;
  const ry = species === 'flower' ? 2 : 1.7;
  return (
    <g data-part="head-up">
      <Crest species={species} />
      <circle data-part="head" className={styles.body} cx="32" cy="30" r="16" />
      <HeadDecor species={species} />
      <Eyes mood={mood} species={species} />
      <ellipse className={styles.cheek} cx="21.5" cy="34" rx={rx} ry={ry} />
      <ellipse className={styles.cheek} cx="42.5" cy="34" rx={rx} ry={ry} />
      <Mouth mood={mood} species={species} />
    </g>
  );
}
