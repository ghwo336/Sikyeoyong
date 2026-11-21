import type { ReactNode } from 'react';

// Budget.dc.html: 8 20 32 inside, 22 between blocks, the button at the bottom.
export default function BudgetLayout({ children }: { children: ReactNode }) {
  return <main className="screen onboarding">{children}</main>;
}
