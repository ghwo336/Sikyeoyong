import type { ReactNode } from 'react';

// The vault's return page (D-29). No design of its own: the sign-up frame, blocks at the bottom.
export default function PouchiCallbackLayout({ children }: { children: ReactNode }) {
  return <main className="screen onboarding verify">{children}</main>;
}
