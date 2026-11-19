import { Chip } from '../../base/Chip';
import { ChoiceGroup } from '../../base/ChoiceGroup';

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
  const picked = TASTES.find((t) => t.value === value);
  return (
    <ChoiceGroup
      title={`오늘 ${menu} 어땠어요?`}
      layout="columns"
      options={TASTES}
      value={picked}
      onChange={(t) => {
        onPick(t.value);
      }}
      keyOf={(t) => t.value}
      renderOption={(t, s) => (
        <Chip size="tile" selected={s.selected} tabIndex={s.tabIndex} onPress={s.select}>
          {t.label}
        </Chip>
      )}
    />
  );
}
