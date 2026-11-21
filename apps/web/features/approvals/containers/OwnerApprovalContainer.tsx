'use client';

import { useRef } from 'react';
import { parseAokrw } from '@sikyeoyong/shared';
import { OwnerApprovalCard, type OwnerApprovalStatus } from '@sikyeoyong/ui';
import type { OrderQuote } from '../../../lib/api';
import type { OwnerApproval } from '../owner';
import { useDecideApproval } from '../hooks/useDecideApproval';

/**
 * One order waiting for the owner (new store, 30-day limit). The two buttons are the owner's
 * answer: "허락하기" asks the server, which quotes the order again and returns its confirm card
 * (onQuote opens it; paying is still that sheet's button, CLAUDE.md rule 3). No re-auth: neither
 * reason raises a limit (D-21, D-28 re-auth only the limit raises). "안 시킬래요" stops the order.
 */
export function OwnerApprovalContainer({
  approval,
  onQuote,
  onRejected,
}: {
  readonly approval: OwnerApproval;
  /** The order's confirm card after a yes; the parent opens the sheet. */
  readonly onQuote: (quote: OrderQuote) => void;
  /** After a no, once the server has stopped the order. */
  readonly onRejected?: () => void;
}) {
  const { approve, reject } = useDecideApproval({ onQuote, onRejected });
  // One answer per card, decided at the tap (a ref, not render state: two taps before the next
  // render must still send once). A failed answer gives the card back so it can be sent again.
  const sent = useRef(false);
  // An answer that went through keeps the card busy until the refetch takes it away, so a late
  // second tap cannot answer twice.
  const status: OwnerApprovalStatus =
    approve.isPending || approve.isSuccess
      ? 'approving'
      : reject.isPending || reject.isSuccess
        ? 'rejecting'
        : approve.isError || reject.isError
          ? 'failed'
          : 'idle';
  return (
    <OwnerApprovalCard
      reason={approval.reason}
      store={approval.store}
      amount={parseAokrw(approval.amount)}
      status={status}
      onApprove={() => {
        if (sent.current) return;
        sent.current = true;
        approve.mutate(approval.id, {
          onError: () => {
            sent.current = false;
          },
        });
      }}
      onReject={() => {
        if (sent.current) return;
        sent.current = true;
        reject.mutate(approval.id, {
          onError: () => {
            sent.current = false;
          },
        });
      }}
    />
  );
}
