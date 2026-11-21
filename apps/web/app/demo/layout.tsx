import type { ReactNode } from 'react';

// LeakCompare.dc.html: the same padded column as the wallet screens.
export default function DemoLayout({ children }: { children: ReactNode }) {
  return <main className="screen padded">{children}</main>;
}
