import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
// Tokens first, then the two design fonts by their token family names, then page base.
import '@sikyeoyong/ui/tokens.css';
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import '@fontsource/gowun-dodum/korean-400.css';
import '@fontsource/gowun-dodum/latin-400.css';
import './globals.css';
import { ThemeSync } from '../features/me/containers/ThemeSync';
import { QueryProvider } from '../lib/query-provider';
import { TransitionBridge } from '../lib/transition-router';
import { DEFAULT_SPECIES, THEME_BOOT_SCRIPT } from '../lib/theme';
import tokens from '../../../design/tokens.json';

export const metadata: Metadata = {
  title: '시켜용',
  description: '배달을 대신 시켜 주는 아기 드래곤',
  // Opened from the home screen with no browser bar (D-23): that is the manifest's
  // display standalone (public/manifest.webmanifest, colors repeat tokens.json ground and a test
  // keeps them equal). appleWebApp only gives the title and the status bar style.
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: '시켜용', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: tokens.color.ground,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // data-species: the dragon's theme (D-32). The boot script sets the remembered one before the
    // first paint, so the attribute may differ from the server's; ThemeSync follows GET /me.
    <html lang="ko" data-species={DEFAULT_SPECIES} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body>
        <QueryProvider>
          <ThemeSync />
          <TransitionBridge />
          {children}
        </QueryProvider>
      </body>
    </html>
  );
}
