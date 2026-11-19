import type { ReactNode } from 'react';

// Hatch.dc.html: 56 24 32 inside, 28 between; the egg and words fill the middle.
export default function HatchLayout({ children }: { children: ReactNode }) {
  return <div className="screen onboarding hatch">{children}</div>;
}
