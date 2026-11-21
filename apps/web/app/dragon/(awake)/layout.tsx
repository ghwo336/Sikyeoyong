import type { ReactNode } from 'react';

// Wallet.dc.html, IdCard.dc.html, Frozen.dc.html: the same padded column as the order screens.
export default function DragonLayout({ children }: { children: ReactNode }) {
  return <main className="screen padded">{children}</main>;
}
