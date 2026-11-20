import type { ReactNode } from 'react';

// Blocked.dc.html, Cap.dc.html, the change card: the same padded column as the order screens.
export default function LimitLayout({ children }: { children: ReactNode }) {
  return <div className="screen padded">{children}</div>;
}
