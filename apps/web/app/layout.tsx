import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
// Tokens first, then the two design fonts by their token family names, then page base.
import '@sikyeoyong/ui/tokens.css';
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import '@fontsource/gowun-dodum/korean-400.css';
import '@fontsource/gowun-dodum/latin-400.css';
import './globals.css';

export const metadata: Metadata = {
  title: '시켜용',
  description: '배달을 대신 시켜 주는 아기 드래곤',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
