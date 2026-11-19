import type { DragonSpecies } from '@sikyeoyong/shared';
import type { ReactNode } from 'react';
import styles from './Dragon.module.css';

// Species decorations (Dragons.dc.html, D-20): what sits on the head and the shell pattern.
// The face is the same for every species (DragonFace.tsx).

/** Ears or crest behind the head. */
export function Crest({ species }: { species: DragonSpecies }): ReactNode {
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

/** Small marks on the forehead. */
export function HeadDecor({ species }: { species: DragonSpecies }): ReactNode {
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
            className={styles.accentHorn}
            d="M32 3 L33.76 7.57 L38.66 7.84 L34.85 10.93 L36.11 15.66 L32 13 L27.89 15.66 L29.15 10.93 L25.34 7.84 L30.24 7.57 Z"
          />
          <path
            className={styles.accentFlat}
            d="M49 13 L49.8 15 L51.8 15.2 L50.3 16.5 L50.8 18.5 L49 17.4 L47.2 18.5 L47.7 16.5 L46.2 15.2 L48.2 15 Z"
          />
          <path
            className={styles.accentFlat}
            d="M15 15 L15.5 16.3 L16.8 16.4 L15.8 17.2 L16.1 18.5 L15 17.8 L13.9 18.5 L14.2 17.2 L13.2 16.4 L14.5 16.3 Z"
          />
        </g>
      );
    case 'forest':
      return null;
  }
}

/** The pattern on the egg shell the dragon sits in. */
export function ShellPattern({ species }: { species: DragonSpecies }): ReactNode {
  switch (species) {
    case 'forest':
      return (
        <g data-part="shell-leaves" className={styles.bodyFlat}>
          <path d="M20 49 C17 47 18 43 21 43 C22 46 21 48 20 49 Z" />
          <path d="M42 52 C40 50 41 47 43 47 C44 49 43 51 42 52 Z" />
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
