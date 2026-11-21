import type { ReactNode } from 'react';

// 주문 내역: the same padded column as the order and dragon screens.
export default function OrderHistoryLayout({ children }: { children: ReactNode }) {
  return <main className="screen padded">{children}</main>;
}
