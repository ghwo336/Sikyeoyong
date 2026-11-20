import type { ReactNode } from 'react';

// Look.dc.html: 8 20 32 inside, 20 apart, the button at the bottom (like the sign-up screens).
export default function LookLayout({ children }: { children: ReactNode }) {
  return <div className="screen onboarding look">{children}</div>;
}
