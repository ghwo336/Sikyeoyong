import styles from './Icon.module.css';

/**
 * back: TopBar "<". chevron-right: ListRow arrow. chevron-down: ReceiptDetails toggle.
 * arrow-right: LimitChangeCard "from -> to". arrow-up: ChatInput send. face-id: LimitChangeCard
 * reauth. kakao: Kakao speech bubble (Start.dc.html, brand guide match unconfirmed).
 * more: ChatHeader settings, three dots (Main.dc.html). receipt: ChatHeader 주문 내역.
 * scooter: ActiveOrderCard mark (Main.dc.html, 2026-11-20).
 */
export type IconName =
  | 'back'
  | 'chevron-right'
  | 'chevron-down'
  | 'arrow-right'
  | 'arrow-up'
  | 'face-id'
  | 'kakao'
  | 'more'
  | 'receipt'
  | 'scooter';

interface Glyph {
  readonly paths: readonly string[];
  /** Line icons: the stroke width from the design. Absent means a filled glyph. */
  readonly stroke?: string;
  /** Round line joins (the face-id drawing has none). */
  readonly roundJoin?: boolean;
}

// Paths copied from the design files (24 by 24). One color: currentColor.
const GLYPHS: Record<IconName, Glyph> = {
  back: { paths: ['M15 5l-7 7 7 7'], stroke: '2', roundJoin: true },
  'chevron-right': { paths: ['M9 6l6 6-6 6'], stroke: '2', roundJoin: true },
  'chevron-down': { paths: ['M6 9l6 6 6-6'], stroke: '2', roundJoin: true },
  'arrow-right': { paths: ['M5 12h14', 'M13 6l6 6-6 6'], stroke: '2', roundJoin: true },
  'arrow-up': { paths: ['M12 19V5', 'M6 11l6-6 6 6'], stroke: '2.2', roundJoin: true },
  'face-id': {
    paths: [
      'M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2',
      'M9 10v1M15 10v1M12 10v4h-1M9.5 16.5c1.4 1 3.6 1 5 0',
    ],
    stroke: '1.8',
  },
  // Main.dc.html settings button: three r 1.2 circles at x 5, 12, 19, a 1.8 line.
  more: {
    paths: [
      'M3.8 12a1.2 1.2 0 1 0 2.4 0a1.2 1.2 0 1 0 -2.4 0',
      'M10.8 12a1.2 1.2 0 1 0 2.4 0a1.2 1.2 0 1 0 -2.4 0',
      'M17.8 12a1.2 1.2 0 1 0 2.4 0a1.2 1.2 0 1 0 -2.4 0',
    ],
    stroke: '1.8',
  },
  // Main.dc.html 주문 내역: a torn-edge slip with three lines, a 1.8 line.
  receipt: {
    paths: ['M6 3h12v18l-3-2-3 2-3-2-3 2z', 'M9 8h6', 'M9 12h6', 'M9 16h3'],
    stroke: '1.8',
    roundJoin: true,
  },
  // Main.dc.html order card: two r 2.5 wheels at x 6 and 18, the body and the handle.
  scooter: {
    paths: [
      'M3.5 17a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0 -5 0',
      'M15.5 17a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0 -5 0',
      'M8.5 17h7',
      'M6 14.5l3-6h4l2 4h3',
      'M13 8.5V6h3',
    ],
    stroke: '1.8',
    roundJoin: true,
  },
  kakao: {
    paths: [
      'M12 4C7 4 3 7.1 3 11c0 2.5 1.7 4.7 4.2 6l-1 3.6c-.1.3.3.6.6.4l4.2-2.8c.3 0 .7.1 1 .1 5 0 9-3.1 9-7s-4-7.3-9-7.3z',
    ],
  },
};

export interface IconProps {
  readonly name: IconName;
  /** Size and color come from the caller's class (each screen has its own icon size token). */
  readonly className?: string;
  /** State hooks for the caller's CSS, e.g. data-open on the details chevron. */
  readonly [data: `data-${string}`]: string | boolean | undefined;
}

/** Draws one single-color icon, hidden from screen readers (Icon.md). */
export function Icon({ name, className, ...data }: IconProps) {
  const g = GLYPHS[name];
  const paint =
    g.stroke === undefined
      ? { fill: 'currentColor' }
      : {
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: g.stroke,
          strokeLinecap: 'round' as const,
          ...(g.roundJoin ? { strokeLinejoin: 'round' as const } : {}),
        };
  return (
    <svg
      className={className ? `${styles.glyph} ${className}` : styles.glyph}
      viewBox="0 0 24 24"
      aria-hidden="true"
      data-icon={name}
      {...paint}
      {...data}
    >
      {g.paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
