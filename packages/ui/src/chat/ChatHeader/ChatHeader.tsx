import type { DragonSpecies } from '@sikyeoyong/shared';
import { IconButton } from '../../base/IconButton';
import { Dragon, type DragonMood } from '../../dragon/Dragon';
import styles from './ChatHeader.module.css';

export interface ChatHeaderProps {
  /** The dragon's name ("용이"). */
  readonly name: string;
  /** One line under the name, already worded by the parent ("레벨 1, 한 번에 10,000원까지"). */
  readonly caption: string;
  readonly species: DragonSpecies;
  /** Default `default`. */
  readonly mood?: DragonMood;
  /** Opens the dragon's settings. Without it there is no button (LimitChat). */
  readonly onSettings?: () => void;
}

/** Draws the top row of the chat: the dragon, its name and level line, and settings (ChatHeader.md). */
export function ChatHeader({
  name,
  caption,
  species,
  mood = 'default',
  onSettings,
}: ChatHeaderProps) {
  return (
    <div className={styles.header}>
      <Dragon mood={mood} size={44} species={species} />
      <div className={styles.text}>
        <h1 className={styles.name}>{name}</h1>
        <p className={styles.caption}>{caption}</p>
      </div>
      {onSettings ? <IconButton icon="more" label={`${name} 설정`} onPress={onSettings} /> : null}
    </div>
  );
}
