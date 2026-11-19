import type { ReactNode } from 'react';

// Verify.dc.html: 8 20 32 inside, 24 between blocks, the button at the bottom.
export default function VerifyLayout({ children }: { children: ReactNode }) {
  return <div className="screen onboarding verify">{children}</div>;
}
