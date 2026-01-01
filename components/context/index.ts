// ============================================
// Context Components - Barrel Export
// ============================================
// NOTE: Only client components are exported here.
// Server components must be imported directly to avoid
// mixing server-only code with client bundles.
//
// Server components:
//   import { ProjectSwitcherServer } from '@/components/context/ProjectSwitcherServer';

export { ProjectSwitcher } from './ProjectSwitcher';
export { ProjectSwitcherClient } from './ProjectSwitcherClient';
