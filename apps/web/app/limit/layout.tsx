import type { ReactNode } from 'react';

// Blocked.dc.html, Cap.dc.html, the change card: the same padded column as the order screens.
export default function LimitLayout({ children }: { children: ReactNode }) {
  // D-32: money and warning screens keep the app colors whatever the dragon species.
  return (
    <div className="screen padded" data-theme="fixed">
      {children}
    </div>
  );
}
