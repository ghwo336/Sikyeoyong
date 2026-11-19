import type { ReactNode } from 'react';

// Name.dc.html: 8 20 32 inside, 22 between blocks, the button at the bottom.
export default function NameLayout({ children }: { children: ReactNode }) {
  return <div className="screen onboarding">{children}</div>;
}
