// ============================================
// Public Trust Bundle Layout
// ============================================
// PHASE D36: Sales-Ready Trust Bundle Engine.
//
// Minimal layout for public trust bundle viewer.
// No dashboard navigation, no internal links.
// ============================================

import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Trust Bundle | AdLab',
  description: 'Secure, time-limited trust bundle for enterprise security review',
  robots: 'noindex, nofollow',
};

export default function PublicTrustBundleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
