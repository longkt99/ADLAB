'use client';

import { StudioProvider } from '@/lib/studio/studioContext';

export default function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <StudioProvider>{children}</StudioProvider>;
}
