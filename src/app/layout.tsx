import type { ReactNode } from 'react';
import './globals.css';

// The <html> tag is rendered in app/[locale]/layout.tsx so it can carry the language.
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
