import type { ReactNode } from 'react';

// Main.dc.html: a full-height column; the thread scrolls between the budget bar and the input.
export default function MainLayout({ children }: { children: ReactNode }) {
  return <div className="screen">{children}</div>;
}
