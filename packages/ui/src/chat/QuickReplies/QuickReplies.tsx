import { Chip } from '../../base/Chip';
import styles from './QuickReplies.module.css';

export interface QuickReply {
  readonly id: string;
  readonly label: string;
}

export interface QuickRepliesProps {
  readonly items: readonly QuickReply[];
  /** Gets the picked id; what it says next is the parent's job. */
  readonly onPick: (id: string) => void;
}

/** Draws a group of quick reply chips under the dragon's line (QuickReplies.md). */
export function QuickReplies({ items, onPick }: QuickRepliesProps) {
  if (items.length === 0) return null;
  return (
    <div className={styles.group} role="group" aria-label="빠른 답장">
      {items.map((item) => (
        <Chip
          key={item.id}
          size="sm"
          onPress={() => {
            onPick(item.id);
          }}
        >
          {item.label}
        </Chip>
      ))}
    </div>
  );
}
