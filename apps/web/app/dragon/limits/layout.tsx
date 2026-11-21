import type { ReactNode } from 'react';

// Budget's stepper layout without the sign-up words: 8 20 32 inside, 22 between, the button at
// the bottom. Money screen, so the app colors stay fixed whatever the species (D-32).
export default function LimitEditLayout({ children }: { children: ReactNode }) {
  return (
    <div className="screen onboarding" data-theme="fixed">
      {children}
    </div>
  );
}
