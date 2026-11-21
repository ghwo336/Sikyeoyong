import type { ReactNode } from 'react';

// Start.dc.html: 0 24 32 inside; the egg and title fill the middle (globals.css).
export default function StartLayout({ children }: { children: ReactNode }) {
  return <main className="screen onboarding start">{children}</main>;
}
