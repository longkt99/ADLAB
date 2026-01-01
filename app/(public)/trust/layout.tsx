// ============================================
// Public Trust Layout (Zero-Auth)
// ============================================
// PHASE D33: Public Trust Portal.
//
// Minimal layout for public trust page.
// No dashboard navigation, no internal links.
// ============================================

import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Trust Verification',
  description: 'Verify security and compliance attestation',
  robots: 'noindex, nofollow',
};

export default function PublicTrustLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
