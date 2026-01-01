'use client';

// ============================================
// Dashboard Layout with Full Sidebar System
// ============================================
// Architecture:
// - Mobile: sidebarOpen controls slide-in drawer with overlay
// - Desktop: sidebarCollapsed controls width toggle (w-60 ↔ w-16)
// - Two independent state machines for optimal UX
// - Auto-close mobile sidebar on navigation
// - Smooth transitions for all state changes

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ThemeProvider, useTheme } from '@/components/theme/theme-provider';
import { LanguageProvider } from '@/components/i18n/language-provider';
import { useTranslation } from '@/lib/i18n';
import { loadAILibrary, formatRelativeTime, type AILibraryEntry } from '@/lib/studio/aiLibrary';
import { Icon, type IconName } from '@/components/ui/Icon';
import { ProjectSwitcherClient } from '@/components/context';
// STEP 9(B): Adaptive Surface Density
import { recordNavClick, isNavComfortable, recordStudioVisit } from '@/lib/studio/preferenceMemory';

function DashboardContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const { t, language, setLanguage } = useTranslation();

  // Mobile: slide-in drawer state
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Lock body scroll when mobile sidebar is open
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [sidebarOpen]);

  // Desktop: collapsed/expanded state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // AI Library state (local storage based)
  const [libraryEntries, setLibraryEntries] = useState<AILibraryEntry[]>([]);
  const [loadingLibrary, setLoadingLibrary] = useState(true);

  // STEP 9(B): Adaptive Surface Density state
  const [navComfortable, setNavComfortable] = useState(false);

  // Load AI Library entries on mount and when pathname changes to /studio
  const refreshLibrary = useCallback(() => {
    try {
      const entries = loadAILibrary();
      setLibraryEntries(entries);
    } catch (error) {
      console.error('Failed to load AI Library:', error);
    } finally {
      setLoadingLibrary(false);
    }
  }, []);

  useEffect(() => {
    refreshLibrary();
  }, [refreshLibrary]);

  // Refresh library when navigating to studio (to pick up new saves)
  useEffect(() => {
    if (pathname === '/studio') {
      refreshLibrary();
      // STEP 9(B): Record studio visit for adaptive density
      recordStudioVisit();
    }
  }, [pathname, refreshLibrary]);

  // STEP 9(B): Check nav comfort level on mount and after clicks
  useEffect(() => {
    setNavComfortable(isNavComfortable());
  }, []);

  // Listen for storage events to refresh library when saved from another tab/context
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'cm_ai_library_v1') {
        refreshLibrary();
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [refreshLibrary]);

  // Handle clicking on a library entry
  const handleLibraryEntryClick = useCallback((entryId: string) => {
    setSidebarOpen(false);
    // Navigate to studio with the entry ID as a query param
    router.push(`/studio?restore=${entryId}`);
  }, [router]);

  // STEP 9(B): Handle nav link click - record for adaptive density
  const handleNavClick = useCallback(() => {
    setSidebarOpen(false);
    recordNavClick();
    // Update local state after recording
    setNavComfortable(isNavComfortable());
  }, []);

  const navigation: Array<{
    name: string;
    href: string;
    iconName: IconName;
    match: (path: string) => boolean;
  }> = [
    {
      name: t('navigation.posts'),
      href: '/posts',
      iconName: 'posts',
      match: (path: string) => path.startsWith('/posts') && !path.includes('/new')
    },
    {
      name: t('navigation.calendar'),
      href: '/calendar',
      iconName: 'calendar',
      match: (path: string) => path === '/calendar'
    },
    {
      name: t('navigation.studio'),
      href: '/studio',
      iconName: 'sparkles',
      match: (path: string) => path === '/studio'
    },
    {
      name: t('navigation.newPost'),
      href: '/posts/new',
      iconName: 'plus',
      match: (path: string) => path === '/posts/new'
    },
  ];

  // Marketing Lab navigation
  const marketingLabNavigation: Array<{
    name: string;
    href: string;
    iconName: IconName;
    match: (path: string) => boolean;
  }> = [
    {
      name: 'UTM Tracking',
      href: '/utm',
      iconName: 'link',
      match: (path: string) => path.startsWith('/utm')
    },
    {
      name: 'AdLab Dashboard',
      href: '/adlab',
      iconName: 'chart',
      match: (path: string) => path === '/adlab'
    },
  ];

  // AdLab navigation - separate section
  const adLabNavigation: Array<{
    name: string;
    href: string;
    iconName: IconName;
    match: (path: string) => boolean;
  }> = [
    {
      name: 'Overview',
      href: '/ads/overview',
      iconName: 'chart',
      match: (path: string) => path === '/ads/overview'
    },
    {
      name: 'Clients',
      href: '/ads/clients',
      iconName: 'users',
      match: (path: string) => path === '/ads/clients'
    },
    {
      name: 'Campaigns',
      href: '/ads/campaigns',
      iconName: 'folder',
      match: (path: string) => path === '/ads/campaigns'
    },
    {
      name: 'Ad Sets',
      href: '/ads/ad-sets',
      iconName: 'grid',
      match: (path: string) => path === '/ads/ad-sets'
    },
    {
      name: 'Ads',
      href: '/ads/ads',
      iconName: 'megaphone',
      match: (path: string) => path === '/ads/ads'
    },
    {
      name: 'Metrics',
      href: '/ads/metrics',
      iconName: 'target',
      match: (path: string) => path === '/ads/metrics'
    },
    {
      name: 'Alerts',
      href: '/ads/alerts',
      iconName: 'alert',
      match: (path: string) => path === '/ads/alerts'
    },
    {
      name: 'Alert Rules',
      href: '/ads/alert-rules',
      iconName: 'settings',
      match: (path: string) => path === '/ads/alert-rules'
    },
    {
      name: 'Reports',
      href: '/ads/reports',
      iconName: 'document',
      match: (path: string) => path === '/ads/reports'
    },
    {
      name: 'Ingestion',
      href: '/ads/ingestion',
      iconName: 'upload',
      match: (path: string) => path.startsWith('/ads/ingestion')
    },
    {
      name: 'Snapshots',
      href: '/ads/snapshots',
      iconName: 'database',
      match: (path: string) => path.startsWith('/ads/snapshots')
    },
    {
      name: 'Audit Trail',
      href: '/ads/audit',
      iconName: 'document',
      match: (path: string) => path.startsWith('/ads/audit')
    },
  ];

  // ============================================
  // LAYOUT: Viewport-locked dashboard shell
  // ============================================
  // Warm Professional: cream background, white panels,
  // hairline borders, spacious padding, refined typography

  /* ============================================
     BACKUP_SIDEBAR_BEFORE_NOVERA_ALIGNMENT (do not edit)
     ============================================
     Sidebar container (line ~170):
       bg-white/95 dark:bg-card backdrop-blur-sm
       border-r border-zinc-200/80 dark:border-zinc-800/60

     Nav item inactive:
       text-zinc-700 dark:text-zinc-400
       hover:bg-zinc-50 dark:hover:bg-zinc-800/50

     Nav item active:
       bg-zinc-100 dark:bg-zinc-800/70 text-foreground

     Icon inactive:
       text-zinc-500 dark:text-zinc-500

     Header border:
       border-b border-zinc-100 dark:border-zinc-800/60

     Library entry:
       bg-zinc-50 dark:bg-zinc-800/50
       hover:bg-zinc-100 dark:hover:bg-zinc-800
       text-zinc-600 dark:text-zinc-300
     ============================================ */

  return (
    <div className="h-screen overflow-hidden bg-background">
      {/* Mobile Overlay - Calm dim, not harsh */}
      <div
        className={`
          fixed inset-0 z-40 lg:hidden
          transition-opacity duration-200 ease-out
          ${sidebarOpen
            ? 'opacity-100 pointer-events-auto bg-black/40 backdrop-blur-[2px]'
            : 'opacity-0 pointer-events-none'
          }
        `}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      {/* Sidebar - Mobile: Card sheet with rounded corners; Desktop: Standard panel */}
      {/* NOVERA ALIGNED: Uses bg-card token for consistent warm surfaces */}
      <aside className={`
        fixed inset-y-0 left-0
        flex flex-col z-50 transition-all duration-200 ease-out
        ${sidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full shadow-none'}
        lg:translate-x-0 lg:shadow-none lg:rounded-none lg:border-r lg:border-border
        ${sidebarCollapsed ? 'lg:w-16' : 'lg:w-60'}
        w-[280px] max-w-[80vw]
        rounded-r-2xl border-r border-border
        bg-card
      `}>
        {/* Header - Brand left, close X right */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-border flex-shrink-0">
          {/* Logo - Hidden when collapsed on desktop */}
          <Link
            href="/posts"
            onClick={() => setSidebarOpen(false)}
            className={`flex items-center gap-2.5 transition-opacity ${sidebarCollapsed ? 'lg:opacity-0 lg:pointer-events-none' : 'lg:opacity-100'}`}
          >
            <div className="w-7 h-7 bg-zinc-800 dark:bg-zinc-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Icon name="lightning" size={14} className="text-white dark:text-zinc-900" />
            </div>
            <div className={`${sidebarCollapsed ? 'lg:hidden' : ''}`}>
              <div className="text-[14px] font-semibold text-foreground">{t('navigation.contentMachine')}</div>
            </div>
          </Link>

          {/* Mobile Close Button */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
            aria-label={t('accessibility.closeSidebar') || 'Đóng sidebar'}
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        {/* Navigation - clean hierarchy, comfortable touch targets */}
        {/* STEP 9(B2): Tighter vertical rhythm after 3+ nav clicks */}
        <nav className={`flex-1 overflow-y-auto ${sidebarCollapsed ? 'lg:px-2' : 'px-3'} ${navComfortable ? 'py-3 space-y-0.5' : 'py-4 space-y-1'}`}>
          {/* Main Navigation */}
          {navigation.map((item) => {
            const isActive = item.match(pathname);
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={handleNavClick}
                className={`
                  flex items-center rounded-xl text-[13px] transition-colors min-h-[44px]
                  ${sidebarCollapsed ? 'lg:justify-center lg:px-2 lg:py-2.5' : 'gap-3 px-3 py-2.5'}
                  ${isActive
                    ? 'bg-secondary/80 text-foreground'
                    : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                  }
                `}
                title={sidebarCollapsed ? item.name : undefined}
              >
                <Icon
                  name={item.iconName}
                  size={18}
                  className={isActive ? 'text-foreground' : 'text-muted-foreground'}
                />
                <span className={`font-medium ${sidebarCollapsed ? 'lg:hidden' : ''}`}>{item.name}</span>
              </Link>
            );
          })}

          {/* Marketing Lab Section Divider */}
          <div className={`pt-4 pb-2 ${sidebarCollapsed ? 'lg:pt-2 lg:pb-1' : ''}`}>
            <div className={`flex items-center ${sidebarCollapsed ? 'lg:justify-center' : 'gap-2'}`}>
              {!sidebarCollapsed && (
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Marketing Lab
                </span>
              )}
              <Icon name="target" size={sidebarCollapsed ? 14 : 11} className="text-muted-foreground" />
            </div>
          </div>

          {/* Marketing Lab Navigation */}
          {marketingLabNavigation.map((item) => {
            const isActive = item.match(pathname);
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={handleNavClick}
                className={`
                  flex items-center rounded-xl text-[13px] transition-colors min-h-[44px]
                  ${sidebarCollapsed ? 'lg:justify-center lg:px-2 lg:py-2.5' : 'gap-3 px-3 py-2.5'}
                  ${isActive
                    ? 'bg-secondary/80 text-foreground'
                    : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                  }
                `}
                title={sidebarCollapsed ? item.name : undefined}
              >
                <Icon
                  name={item.iconName}
                  size={18}
                  className={isActive ? 'text-foreground' : 'text-muted-foreground'}
                />
                <span className={`font-medium ${sidebarCollapsed ? 'lg:hidden' : ''}`}>{item.name}</span>
              </Link>
            );
          })}

          {/* AdLab Section Divider */}
          <div className={`pt-4 pb-2 ${sidebarCollapsed ? 'lg:pt-2 lg:pb-1' : ''}`}>
            <div className={`flex items-center ${sidebarCollapsed ? 'lg:justify-center' : 'gap-2'}`}>
              {!sidebarCollapsed && (
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  AdLab Details
                </span>
              )}
              <Icon name="megaphone" size={sidebarCollapsed ? 14 : 11} className="text-muted-foreground" />
            </div>
          </div>

          {/* AdLab Navigation */}
          {adLabNavigation.map((item) => {
            const isActive = item.match(pathname);
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={handleNavClick}
                className={`
                  flex items-center rounded-xl text-[13px] transition-colors min-h-[44px]
                  ${sidebarCollapsed ? 'lg:justify-center lg:px-2 lg:py-2.5' : 'gap-3 px-3 py-2.5'}
                  ${isActive
                    ? 'bg-secondary/80 text-foreground'
                    : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                  }
                `}
                title={sidebarCollapsed ? item.name : undefined}
              >
                <Icon
                  name={item.iconName}
                  size={18}
                  className={isActive ? 'text-foreground' : 'text-muted-foreground'}
                />
                <span className={`font-medium ${sidebarCollapsed ? 'lg:hidden' : ''}`}>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* STEP 8: AI Library - Contained with scroll when multiple items */}
        <div className={`border-t border-border ${sidebarCollapsed ? 'lg:px-2' : 'px-3'} pt-4 pb-2 flex-shrink-0`}>
          {/* Section Header */}
          <div className={`flex items-center mb-3 ${sidebarCollapsed ? 'lg:justify-center' : 'justify-between'}`}>
            {!sidebarCollapsed && (
              <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                {t('studio.library.title') || 'Thư viện AI'}
              </h3>
            )}
            <Icon name="bookmark" size={13} className="text-muted-foreground" />
          </div>

          {/* Library Entries List - STEP 8: max-height + scroll for containment */}
          <div className={`space-y-1.5 max-h-[140px] overflow-y-auto pr-1 ${sidebarCollapsed ? 'lg:hidden' : ''}`}>
            {loadingLibrary ? (
              <div className="text-[11px] text-muted-foreground text-center py-4">
                {t('studio.library.loading') || 'Đang tải...'}
              </div>
            ) : libraryEntries.length === 0 ? (
              <div className="text-center py-4 px-2">
                <p className="text-[11px] text-muted-foreground">Chưa có phiên đã lưu</p>
              </div>
            ) : (
              libraryEntries.map((entry) => (
                <button
                  key={entry.id}
                  onClick={() => handleLibraryEntryClick(entry.id)}
                  className="w-full text-left px-3 py-2.5 rounded-xl bg-secondary/50 hover:bg-secondary/80 transition-colors group"
                >
                  <div className="text-[12px] text-secondary-foreground truncate group-hover:text-foreground font-medium">
                    {entry.title}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {formatRelativeTime(entry.updatedAt)}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* User section - anchored at bottom, quiet styling */}
        <div className={`px-3 py-3 border-t border-border flex-shrink-0 ${sidebarCollapsed ? 'lg:px-2' : ''}`}>
          <div className={`flex items-center rounded-xl transition-colors ${sidebarCollapsed ? 'lg:justify-center lg:px-2 lg:py-2' : 'gap-3 px-2 py-2'}`}>
            <div className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center text-muted-foreground text-[12px] font-semibold flex-shrink-0">
              U
            </div>
            <div className={`flex-1 min-w-0 ${sidebarCollapsed ? 'lg:hidden' : ''}`}>
              <div className="text-[13px] text-foreground truncate font-medium">{t('user.defaultName')}</div>
              <div className="text-[10px] text-muted-foreground truncate">{t('user.defaultEmail')}</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      {/* Mobile: Visual de-prioritization when sidebar is open */}
      <div className={`
        h-full flex flex-col transition-all duration-200
        ${sidebarCollapsed ? 'lg:pl-16' : 'lg:pl-60'}
        ${sidebarOpen ? 'lg:opacity-100 opacity-50 pointer-events-none lg:pointer-events-auto' : 'opacity-100'}
      `}>
        {/* Top Header - Utilities only, no page title (title lives in content area) */}
        <header className="flex-shrink-0 h-11 bg-card border-b border-border flex items-center justify-between px-3 sm:px-4 z-20">
          <div className="flex items-center">
            {/* Mobile Hamburger Menu */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary/60 rounded-md transition-colors"
              aria-label={t('accessibility.openSidebar') || 'Mở sidebar'}
            >
              <Icon name="menu" size={18} />
            </button>

            {/* Desktop Sidebar Toggle */}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="hidden lg:flex p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary/60 rounded-md transition-colors"
              aria-label={sidebarCollapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
            >
              <Icon name={sidebarCollapsed ? 'chevronsRight' : 'chevronsLeft'} size={17} />
            </button>

            {/* Screen reader only - page context for accessibility */}
            <span className="sr-only">
              {navigation.find(item => item.match(pathname))?.name || t('navigation.contentMachine')}
            </span>

            {/* Project Switcher - Marketing Lab v2.0 */}
            <div className="ml-2">
              <ProjectSwitcherClient compact />
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Search (placeholder for future) */}
            <button className="p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-secondary/60 transition-colors">
              <Icon name="search" size={15} />
            </button>

            {/* Language Toggle */}
            <button
              onClick={() => setLanguage(language === 'vi' ? 'en' : 'vi')}
              className="px-2 py-1 text-muted-foreground hover:text-foreground rounded-md hover:bg-secondary/60 transition-colors text-[11px] font-medium"
              aria-label={t('accessibility.toggleLanguage')}
            >
              <span className={language === 'vi' ? 'text-foreground' : ''}>VI</span>
              <span className="text-muted-foreground/50 mx-0.5">/</span>
              <span className={language === 'en' ? 'text-foreground' : ''}>EN</span>
            </button>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-secondary/60 transition-colors"
              aria-label={t('accessibility.toggleTheme')}
            >
              <Icon name={theme === 'light' ? 'moon' : 'sun'} size={15} />
            </button>

            {/* Notifications (placeholder for future) */}
            <button className="p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-secondary/60 transition-colors relative">
              <Icon name="notifications" size={15} />
              <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full" style={{ background: 'hsl(var(--warm-accent))' }}></span>
            </button>
          </div>
        </header>

        {/* Page Content - generous padding for breathing room */}
        <main className="flex-1 min-h-0 overflow-auto p-6 sm:p-8 bg-background">
          <div className="max-w-7xl mx-auto h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <DashboardContent>{children}</DashboardContent>
      </LanguageProvider>
    </ThemeProvider>
  );
}
