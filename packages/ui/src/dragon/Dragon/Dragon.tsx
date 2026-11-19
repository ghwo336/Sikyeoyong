import type { DragonSpecies } from '@sikyeoyong/shared';
import type { ReactNode } from 'react';
import styles from './Dragon.module.css';

export type DragonMood =
  'default' | 'happy' | 'excited' | 'worried' | 'hiding' | 'sleeping' | 'eating' | 'cooking';
export type DragonSize = 32 | 44 | 56 | 96 | 128;

export interface DragonProps {
  readonly mood: DragonMood;
  readonly size: DragonSize;
  readonly species: DragonSpecies;
  /** Level 3 grows wings (Dragon.md). */
  readonly wings?: boolean;
}

// Paths follow design/screens/Dragons.dc.html (species) and Main, Arrived, Blocked,
// Cap, Done (moods). Temporary art: a real illustration replaces only this file.
const SHELL =
  'M8 38 L14 33 L20 38 L26 33 L32 38 L38 33 L44 38 L50 33 L56 38 C56 52 46 60 32 60 C18 60 8 52 8 38 Z';

function Crest({ species }: { species: DragonSpecies }): ReactNode {
  switch (species) {
    case 'forest':
      return (
        <g data-part="leaf-crest">
          <path className={styles.accent} d="M27 15 C21 12 20 5 25 2 C29 5 30 11 27 15 Z" />
          <path className={styles.accent} d="M37 15 C43 12 44 5 39 2 C35 5 34 11 37 15 Z" />
          <path className={styles.vein} d="M26.5 13 L25 5 M37.5 13 L39 5" />
        </g>
      );
    case 'water':
      return (
        <g data-part="fin-ears">
          <path className={styles.accent} d="M18 25 L7 18 L11 28 L7 37 L18 33 Z" />
          <path className={styles.accent} d="M46 25 L57 18 L53 28 L57 37 L46 33 Z" />
        </g>
      );
    case 'flower':
      return (
        <g data-part="petal-ears">
          <circle className={styles.accent} cx="19" cy="18" r="6" />
          <circle className={styles.accent} cx="45" cy="18" r="6" />
        </g>
      );
    case 'star':
      return null;
  }
}

function HeadDecor({ species }: { species: DragonSpecies }): ReactNode {
  switch (species) {
    case 'water':
      return (
        <path
          data-part="droplet"
          className={styles.white}
          d="M32 15 C34.2 18.5 35.2 20 35.2 21.6 A3.2 3.2 0 0 1 28.8 21.6 C28.8 20 29.8 18.5 32 15 Z"
        />
      );
    case 'flower':
      return (
        <g data-part="flower-crest">
          <circle className={styles.white} cx="32" cy="10.4" r="2.6" />
          <circle className={styles.white} cx="35.2" cy="12.8" r="2.6" />
          <circle className={styles.white} cx="34" cy="16.4" r="2.6" />
          <circle className={styles.white} cx="30" cy="16.4" r="2.6" />
          <circle className={styles.white} cx="28.8" cy="12.8" r="2.6" />
          <circle className={styles.yolk} cx="32" cy="13.8" r="2" />
        </g>
      );
    case 'star':
      return (
        <g data-part="star-horn">
          <path
            className={styles.yolk}
            d="M32 3 L33.76 7.57 L38.66 7.84 L34.85 10.93 L36.11 15.66 L32 13 L27.89 15.66 L29.15 10.93 L25.34 7.84 L30.24 7.57 Z"
          />
          <path
            className={styles.yolkFlat}
            d="M49 13 L49.8 15 L51.8 15.2 L50.3 16.5 L50.8 18.5 L49 17.4 L47.2 18.5 L47.7 16.5 L46.2 15.2 L48.2 15 Z"
          />
          <path
            className={styles.yolkFlat}
            d="M15 15 L15.5 16.3 L16.8 16.4 L15.8 17.2 L16.1 18.5 L15 17.8 L13.9 18.5 L14.2 17.2 L13.2 16.4 L14.5 16.3 Z"
          />
        </g>
      );
    case 'forest':
      return null;
  }
}

function Eyes({ mood, species }: { mood: DragonMood; species: DragonSpecies }): ReactNode {
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
  const wink = species === 'star' && mood === 'default';
  return (
    <g data-part={wink ? 'eyes-wink' : 'eyes-dot'}>
      {mood === 'worried' || mood === 'hiding' ? (
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

function Mouth({ mood }: { mood: DragonMood }): ReactNode {
  switch (mood) {
    case 'happy':
    case 'excited':
      return <path data-part="mouth-open" className={styles.inkFill} d="M29 33 Q32 38 35 33 Z" />;
    case 'worried':
    case 'hiding':
      return <path data-part="mouth-wavy" className={styles.line} d="M30 35.5 Q32 34 34 35.5" />;
    case 'cooking':
      return <ellipse data-part="mouth-o" className={styles.ink} cx="32" cy="35" rx="2" ry="2.4" />;
    case 'eating':
      return <path data-part="mouth-small" className={styles.line} d="M30 35.5 Q32 34 34 35.5" />;
    case 'sleeping':
      return <path data-part="mouth-sleep" className={styles.line} d="M31 35 Q32 35.8 33 35" />;
    case 'default':
      return <path data-part="mouth-smile" className={styles.line} d="M30 34.5 Q32 36.5 34 34.5" />;
  }
}

function ShellPattern({ species }: { species: DragonSpecies }): ReactNode {
  switch (species) {
    case 'forest':
      return (
        <g data-part="shell-leaves">
          <path className={styles.bodyFlat} d="M20 49 C17 47 18 43 21 43 C22 46 21 48 20 49 Z" />
          <path className={styles.bodyFlat} d="M42 52 C40 50 41 47 43 47 C44 49 43 51 42 52 Z" />
        </g>
      );
    case 'water':
      return (
        <path
          data-part="shell-wave"
          className={styles.wave}
          d="M14 47 Q19 44 24 47 T34 47 T44 47 T51 46"
        />
      );
    case 'flower':
      return (
        <g data-part="shell-petals" className={styles.bodyFlat}>
          <circle cx="20" cy="48" r="1.7" />
          <circle cx="22.8" cy="48" r="1.7" />
          <circle cx="21.4" cy="45.8" r="1.7" />
          <circle cx="21.4" cy="50.2" r="1.7" />
          <circle cx="43" cy="51" r="1.4" />
        </g>
      );
    case 'star':
      return (
        <g data-part="shell-stars" className={styles.bodyFlat}>
          <path d="M21 44 L21.9 46.2 L24.2 46.3 L22.4 47.8 L23 50 L21 48.7 L19 50 L19.6 47.8 L17.8 46.3 L20.1 46.2 Z" />
          <circle cx="43" cy="50" r="1.4" />
        </g>
      );
  }
}

function Extras({ mood }: { mood: DragonMood }): ReactNode {
  switch (mood) {
    case 'sleeping':
      return (
        <g data-part="zz">
          <path className={styles.zz} d="M46 12 H52 L46 18 H52" />
          <path className={styles.zzSmall} d="M54 4 H58 L54 8 H58" />
        </g>
      );
    case 'worried':
      return (
        <path
          data-part="sweat"
          className={styles.sweat}
          d="M47 18 C49 21 50 22.5 50 24 A3 3 0 0 1 44 24 C44 22.5 45 21 47 18 Z"
        />
      );
    case 'cooking':
      return (
        <g data-part="steam">
          <path className={styles.steam} d="M27 12 Q29 8 27 4" />
          <path className={styles.steam} d="M33 11 Q35 7 33 3" />
        </g>
      );
    default:
      return null;
  }
}

/** Draws the baby dragon for a species, mood and size (Dragon.md). Decorative: hidden from screen readers. */
export function Dragon({ mood, size, species, wings = false }: DragonProps) {
  const lowered = mood === 'hiding';
  return (
    <svg
      className={styles.dragon}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
      data-species={species}
      data-mood={mood}
    >
      {wings ? (
        <g data-part="wings">
          <path className={styles.body} d="M10 24 C4 20 4 12 8 10 C10 16 14 18 18 20 Z" />
          <path className={styles.body} d="M54 24 C60 20 60 12 56 10 C54 16 50 18 46 20 Z" />
        </g>
      ) : null}
      <g
        transform={lowered ? 'translate(0 10)' : undefined}
        data-part={lowered ? 'head-lowered' : 'head-up'}
      >
        <Crest species={species} />
        <circle className={styles.body} cx="32" cy="30" r="16" />
        <HeadDecor species={species} />
        <Eyes mood={mood} species={species} />
        <ellipse className={styles.cheek} cx="21.5" cy="34" rx="2.8" ry="1.7" />
        <ellipse className={styles.cheek} cx="42.5" cy="34" rx="2.8" ry="1.7" />
        <Mouth mood={mood} />
      </g>
      <Extras mood={mood} />
      <path className={styles.shell} d={SHELL} />
      <ShellPattern species={species} />
      {mood === 'eating' ? (
        <g data-part="bowl">
          <path className={styles.line} d="M24 50 C24 44 40 44 40 50" />
          <rect className={styles.bowl} x="20" y="44" width="24" height="9" rx="3" />
          <path className={styles.steam} d="M26 48.5 H38" />
        </g>
      ) : null}
    </svg>
  );
}
