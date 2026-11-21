import { Fragment } from 'react';
import { PastLine, SessionDivider } from '@sikyeoyong/ui';
import type { PastSession } from '../hooks/sessions';

export interface PastConversationsProps {
  readonly sessions: readonly PastSession[];
}

/**
 * Earlier meals folded above the current one (D-34): a date line, then each card as one line of
 * text. Nothing here can be pressed, so an old quote can never be paid.
 */
export function PastConversations({ sessions }: PastConversationsProps) {
  return (
    <>
      {sessions.map((s) => (
        <Fragment key={s.id}>
          <SessionDivider label={s.label} />
          {s.lines.map((line, i) => (
            <PastLine key={`${s.id}-${String(i)}`} text={line} />
          ))}
        </Fragment>
      ))}
    </>
  );
}
