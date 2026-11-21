import type { ReactNode } from 'react';

// Done.dc.html, Tracking.dc.html: 8 20 24 inside, 16 between blocks.
export default function OrderLayout({ children }: { children: ReactNode }) {
  return <main className="screen padded">{children}</main>;
}
