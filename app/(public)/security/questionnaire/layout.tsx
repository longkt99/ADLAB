// ============================================
// Public Security Questionnaire Layout
// ============================================
// PHASE D35: Customer Security Questionnaire Engine.
//
// Minimal layout for public questionnaire page.
// No dashboard navigation, no internal links.
// ============================================

import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Security Questionnaire | AdLab',
  description: 'Auto-generated security questionnaire with evidence-based responses',
  robots: 'index, follow',
};

export default function PublicQuestionnaireLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
