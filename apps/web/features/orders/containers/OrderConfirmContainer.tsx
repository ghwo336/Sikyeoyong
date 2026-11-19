'use client';

import { type DragonSpecies, parseAokrw } from '@sikyeoyong/shared';
import { OrderConfirmSheet } from '@sikyeoyong/ui';
import { useRouter } from 'next/navigation';
import type { OrderQuote } from '../../../lib/api';
import { routeLine } from '../../../lib/format';
import { useConfirmOrder } from '../hooks/useConfirmOrder';

export interface OrderConfirmContainerProps {
  readonly quote: OrderQuote | undefined;
  readonly open: boolean;
  readonly species: DragonSpecies;
  readonly onClose: () => void;
}

/**
 * The confirm sheet over the chat (Confirm.dc.html). Its button is the only way to pay.
 * Optimistic: the press moves straight to the order status screen while confirm runs.
 */
export function OrderConfirmContainer({
  quote,
  open,
  species,
  onClose,
}: OrderConfirmContainerProps) {
  const router = useRouter();
  const confirm = useConfirmOrder();
  if (!quote) return null;
  const total = parseAokrw(quote.amount);
  return (
    <OrderConfirmSheet
      open={open}
      line={quote.dragonLine}
      species={species}
      route={routeLine(quote.store, quote.destination, quote.etaMin)}
      items={quote.items.map((l) => ({
        name: l.name,
        quantity: l.quantity,
        price: parseAokrw(l.price),
      }))}
      request={quote.request}
      total={total}
      perOrder={{ used: total, max: parseAokrw(quote.perOrderLimit) }}
      period={{ used: parseAokrw(quote.periodUsedAfter), max: parseAokrw(quote.periodCap) }}
      confirming={confirm.isPending}
      onConfirm={() => {
        confirm.mutate(quote.orderId);
        router.push(`/orders/${quote.orderId}`);
      }}
      onCancel={onClose}
    />
  );
}
