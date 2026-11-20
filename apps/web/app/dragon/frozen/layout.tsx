import type { ReactNode } from 'react';

// Frozen.dc.html: the padded column on the sleeping ground (sleepGround, FrozenPanel.md).
export default function FrozenLayout({ children }: { children: ReactNode }) {
  return <div className="screen padded sleep">{children}</div>;
}
