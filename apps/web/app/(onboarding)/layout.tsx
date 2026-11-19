import type { ReactNode } from 'react';

// Name, Budget.dc.html: 8 20 32 inside, 22 between blocks, the main button at the bottom.
// Verify (24 apart), Start (0 24 32) and Hatch (56 24 32, 28 apart) differ a little (web.md).
export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return <div className="screen onboarding">{children}</div>;
}
