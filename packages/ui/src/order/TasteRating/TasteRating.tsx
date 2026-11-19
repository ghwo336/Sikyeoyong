import { useId } from 'react';
import { Chip } from '../../base/Chip';
import styles from './TasteRating.module.css';

export type Taste = 'again' | 'okay' | 'meh';

export const TASTES: readonly { readonly value: Taste; readonly label: string }[] = [
  { value: 'again', label: '또 먹을래' },
  { value: 'okay', label: '괜찮았어' },
  { value: 'meh', label: '별로였어' },
];

export interface TasteRatingProps {
  /** Menu in the question ("오늘 돼지국밥 어땠어요?"). */
  readonly menu: string;
  readonly value?: Taste;
  /** Saving the rating is the parent's job. */
  readonly onPick: (value: Taste) => void;
}

/** Lets the user pick one of three taste ratings (TasteRating.md). */
export function TasteRating({ menu, value, onPick }: TasteRatingProps) {
  const questionId = useId();
  return (
    <div className={styles.rating}>
      <p id={questionId} className={styles.question}>
        오늘 {menu} 어땠어요?
      </p>
      <div className={styles.choices} role="radiogroup" aria-labelledby={questionId}>
        {TASTES.map((t) => (
          <Chip
            key={t.value}
            size="tile"
            selected={value === t.value}
            onPress={() => {
              onPick(t.value);
            }}
          >
            {t.label}
          </Chip>
        ))}
      </div>
    </div>
  );
}
