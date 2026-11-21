import type { ReactNode } from 'react';

// LeakCompare.dc.html: the same padded column as the wallet screens.
export default function DemoLayout({ children }: { children: ReactNode }) {
  return <div className="screen padded">{children}</div>;
}
