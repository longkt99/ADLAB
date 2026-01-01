// ============================================
// Public Security Layout
// ============================================
// PHASE D34: Public Customer Security Page.
//
// Minimal layout for public security page.
// No dashboard navigation, no internal links.
// ============================================

import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Security & Trust | AdLab',
  description: 'Security posture, SLA guarantees, and compliance information',
  robots: 'index, follow',
};

export default function PublicSecurityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
