'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PLATFORMS, PLATFORM_DISPLAY_NAMES, type Platform } from '@/lib/platforms';
import { useTranslation, formatDate } from '@/lib/i18n';

// ============================================
// Types
// ============================================
interface CalendarEvent {
  id: string;
  post_id: string;
  post_title: string;
  platform: Platform;
  status: 'scheduled' | 'published';
  content: string;
  date: string;
  scheduled_at: string | null;
  published_at: string | null;
}

interface CalendarData {
  success: boolean;
  year: number;
  month: number;
  total_events: number;
  events: CalendarEvent[];
  events_by_day: { [key: string]: CalendarEvent[] };
  filters: {
    platform: string;
    status: string;
  };
}

// ============================================
// Platform Badge Component - Warm Professional: subtle pills
// ============================================
function PlatformBadge({ platform }: { platform: Platform }) {
  const displayName = PLATFORM_DISPLAY_NAMES[platform] || platform;

  return (
    <span className="inline-block px-2 py-0.5 text-xs bg-secondary text-secondary-foreground rounded">
      {displayName}
    </span>
  );
}

// ============================================
// Platform Emoji Helper
// ============================================
function getPlatformEmoji(platform: Platform): string {
  const emojis: { [key: string]: string } = {
    twitter_x: '𝕏',
    instagram_post: '📷',
    threads: '🧵',
    bluesky: '☁️',
    linkedin: '💼',
    google: '🔍',
    pinterest: '📌',
    youtube_community: '▶️',
  };
  return emojis[platform] || '📄';
}

// ============================================
// Platform Color Helper - Warm Professional: cream/warm tones
// ============================================
function getPlatformColors(platform: Platform): { bg: string; border: string } {
  // Using warm, subtle colors
  const colors: { [key: string]: { bg: string; border: string } } = {
    twitter_x: { bg: 'hsl(40 14% 95%)', border: 'hsl(40 10% 85%)' },
    instagram_post: { bg: 'hsl(40 14% 95%)', border: 'hsl(40 10% 85%)' },
    threads: { bg: 'hsl(40 14% 95%)', border: 'hsl(40 10% 85%)' },
    bluesky: { bg: 'hsl(40 14% 95%)', border: 'hsl(40 10% 85%)' },
    linkedin: { bg: 'hsl(40 14% 95%)', border: 'hsl(40 10% 85%)' },
    google: { bg: 'hsl(40 14% 95%)', border: 'hsl(40 10% 85%)' },
    pinterest: { bg: 'hsl(40 14% 95%)', border: 'hsl(40 10% 85%)' },
    youtube_community: { bg: 'hsl(40 14% 95%)', border: 'hsl(40 10% 85%)' },
  };
  return colors[platform] || { bg: 'hsl(40 14% 95%)', border: 'hsl(40 10% 85%)' };
}

// ============================================
// Date Range Helpers
// ============================================
function getThisWeek(): { start: Date; end: Date } {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 (Sunday) to 6 (Saturday)

  // Calculate days to Monday (start of week)
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  const monday = new Date(now);
  monday.setDate(now.getDate() - daysToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return { start: monday, end: sunday };
}

function formatDateRange(start: Date, end: Date): string {
  const formatOptions: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
  const startStr = start.toLocaleDateString('en-US', formatOptions);
  const endStr = end.toLocaleDateString('en-US', formatOptions);
  return `${startStr} – ${endStr}`;
}

function shiftDateRange(range: { start: Date; end: Date }, direction: 'prev' | 'next'): { start: Date; end: Date } {
  const durationMs = range.end.getTime() - range.start.getTime();
  const shift = direction === 'next' ? durationMs + 1 : -(durationMs + 1);

  const newStart = new Date(range.start.getTime() + shift);
  const newEnd = new Date(range.end.getTime() + shift);

  return { start: newStart, end: newEnd };
}

// ============================================
// Status Badge Component - Warm Professional: subtle pills
// ============================================
function StatusBadge({ status, t }: { status: string; t: (key: string) => string }) {
  // Use translation for status label
  const statusLabel = t(`status.${status}` as any) || status;

  return (
    <span className="inline-block px-2 py-0.5 text-xs bg-secondary text-foreground rounded">
      {statusLabel}
    </span>
  );
}

// ============================================
// Calendar Page Component
// ============================================
export default function CalendarPage() {
  const router = useRouter();
  const { t, language } = useTranslation();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarData, setCalendarData] = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  // View Mode (month, week, agenda)
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'agenda'>('month');

  // Filters
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [weekFilterActive, setWeekFilterActive] = useState(false);
  const [customDateRange, setCustomDateRange] = useState<{ start: Date; end: Date } | null>(null);

  // Day Events Modal State
  const [dayEventsModal, setDayEventsModal] = useState<{ day: number; events: CalendarEvent[] } | null>(null);
  const [dayEventsPage, setDayEventsPage] = useState(1);
  const eventsPerPage = 6;

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1; // JavaScript months are 0-indexed

  // ============================================
  // Filter Event Handlers
  // ============================================
  const handleThisWeekToggle = () => {
    if (weekFilterActive) {
      // Deactivate week filter
      setWeekFilterActive(false);
      setCustomDateRange(null);
    } else {
      // Activate week filter
      setWeekFilterActive(true);
      setCustomDateRange(getThisWeek());
    }
  };

  const handleDateRangeShift = (direction: 'prev' | 'next') => {
    if (customDateRange) {
      const newRange = shiftDateRange(customDateRange, direction);
      setCustomDateRange(newRange);
      // Keep weekFilterActive false when manually navigating
      setWeekFilterActive(false);
    }
  };

  const handleClearDateRange = () => {
    setWeekFilterActive(false);
    setCustomDateRange(null);
  };

  // ============================================
  // Client-Side Event Filtering
  // ============================================
  const applyClientSideFilters = (events: CalendarEvent[]): CalendarEvent[] => {
    let filtered = [...events];

    // 1. Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((event) =>
        event.post_title.toLowerCase().includes(query) ||
        event.content.toLowerCase().includes(query)
      );
    }

    // 2. Apply date range filter (week or custom)
    if (customDateRange) {
      filtered = filtered.filter((event) => {
        const eventDate = new Date(event.date);
        return eventDate >= customDateRange.start && eventDate <= customDateRange.end;
      });
    }

    return filtered;
  };

  // ============================================
  // Fetch Calendar Data
  // ============================================
  const fetchCalendarData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        year: year.toString(),
        month: month.toString(),
      });

      if (platformFilter !== 'all') {
        params.append('platform', platformFilter);
      }

      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      const response = await fetch(`/api/calendar/events?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Failed to fetch calendar data');
      }

      const data: CalendarData = await response.json();
      setCalendarData(data);
    } catch (error) {
      console.error('Error fetching calendar data:', error);
      alert('Failed to load calendar data');
    } finally {
      setLoading(false);
    }
  };

  // Fetch calendar data when dependencies change
  useEffect(() => {
    fetchCalendarData();
  }, [year, month, platformFilter, statusFilter]);

  // Refetch calendar data when page becomes visible (user navigates back)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchCalendarData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [year, month, platformFilter, statusFilter]);

  // ============================================
  // Calendar Navigation
  // ============================================
  const goToPreviousMonth = () => {
    setCurrentDate(new Date(year, month - 2, 1)); // month - 2 because we add 1 for display
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // ============================================
  // Calendar Day Cells
  // ============================================
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    // Returns 0 (Sunday) to 6 (Saturday)
    return new Date(year, month - 1, 1).getDay();
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const daysInMonth = getDaysInMonth(year, month);
  const firstDayOfWeek = getFirstDayOfMonth(year, month);

  // Build calendar grid (6 rows x 7 columns = 42 cells)
  const calendarCells: (number | null)[] = [];

  // Add empty cells for days before the 1st
  for (let i = 0; i < firstDayOfWeek; i++) {
    calendarCells.push(null);
  }

  // Add cells for each day of the month
  for (let day = 1; day <= daysInMonth; day++) {
    calendarCells.push(day);
  }

  // Pad to fill 6 rows (42 cells total)
  while (calendarCells.length < 42) {
    calendarCells.push(null);
  }

  // ============================================
  // Get Events for a Specific Day
  // ============================================
  const getEventsForDay = (day: number | null): CalendarEvent[] => {
    if (!day || !calendarData) return [];

    const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayEvents = calendarData.events_by_day[dateKey] || [];

    // Apply client-side filters (search, date range)
    return applyClientSideFilters(dayEvents);
  };

  // ============================================
  // Check if Day is Today
  // ============================================
  const isToday = (day: number | null): boolean => {
    if (!day) return false;
    const today = new Date();
    return (
      day === today.getDate() &&
      month === today.getMonth() + 1 &&
      year === today.getFullYear()
    );
  };

  // ============================================
  // Day Events Modal (for "+X more")
  // ============================================
  const DayEventsModal = ({ day, events }: { day: number; events: CalendarEvent[] }) => {
    const totalPages = Math.ceil(events.length / eventsPerPage);
    const startIndex = (dayEventsPage - 1) * eventsPerPage;
    const endIndex = startIndex + eventsPerPage;
    const paginatedEvents = events.slice(startIndex, endIndex);

    const handleEventClick = (postId: string) => {
      router.push(`/posts/${postId}`);
    };

    const handleClose = () => {
      setDayEventsModal(null);
      setDayEventsPage(1);
    };

    return (
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        onClick={handleClose}
      >
        <div
          className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="border-b border-gray-200 dark:border-gray-800 p-6 bg-gradient-to-r from-gray-50 dark:from-gray-900 to-white dark:to-gray-900">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {formatDate(new Date(year, month - 1, day), 'dateFull', language)}
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 font-medium">
                  {events.length} {t('calendar.dayEventsModal.events')}
                </p>
              </div>
              <button
                onClick={handleClose}
                className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-all"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Events List */}
          <div className="p-6 space-y-3">
            {paginatedEvents.map((event) => {
              const platformColors = getPlatformColors(event.platform);
              return (
                <button
                  key={event.id}
                  onClick={() => handleEventClick(event.post_id)}
                  className="w-full text-left p-4 rounded-xl border-l-4 hover:shadow-lg transition-all"
                  style={{
                    backgroundColor: platformColors.bg,
                    borderColor: platformColors.border,
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">{getPlatformEmoji(event.platform)}</span>
                        <PlatformBadge platform={event.platform} />
                        <StatusBadge status={event.status} t={t} />
                      </div>
                      <h3 className="font-bold text-gray-900 mb-1 truncate">
                        {event.post_title}
                      </h3>
                      <p className="text-sm text-gray-700 line-clamp-2">
                        {event.content}
                      </p>
                      {event.scheduled_at && (
                        <p className="text-xs text-gray-600 mt-2 flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {formatDate(event.scheduled_at, 'timeOnly', language)}
                        </p>
                      )}
                    </div>
                    <svg className="w-5 h-5 text-gray-400 dark:text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="border-t border-gray-200 dark:border-gray-800 p-6 bg-gray-50 dark:bg-gray-900">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setDayEventsPage(Math.max(1, dayEventsPage - 1))}
                  disabled={dayEventsPage === 1}
                  className="px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-600 transition-all font-semibold text-sm shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('calendar.dayEventsModal.previous')}
                </button>
                <span className="text-sm text-gray-600 dark:text-gray-400 font-semibold">
                  {t('calendar.dayEventsModal.page')} {dayEventsPage} {t('calendar.dayEventsModal.of')} {totalPages}
                </span>
                <button
                  onClick={() => setDayEventsPage(Math.min(totalPages, dayEventsPage + 1))}
                  disabled={dayEventsPage === totalPages}
                  className="px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-600 transition-all font-semibold text-sm shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('calendar.dayEventsModal.next')}
                </button>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="border-t border-gray-200 dark:border-gray-800 p-6 bg-gray-50 dark:bg-gray-900">
            <button
              onClick={handleClose}
              className="w-full px-4 py-2.5 bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors font-semibold"
            >
              {t('calendar.dayEventsModal.close')}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ============================================
  // Event Details Modal
  // ============================================
  const EventModal = ({ event }: { event: CalendarEvent }) => {
    const eventDate = new Date(event.date);
    // Format: "Monday, December 10, 2025, 2:30 PM" (en) or "Thứ Hai, 10/12/2025, 14:30" (vi)
    const formattedDate = formatDate(eventDate, 'dateTimeShort', language);

    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="border-b border-gray-200 dark:border-gray-800 p-6 bg-gradient-to-r from-gray-50 dark:from-gray-900 to-white dark:to-gray-900">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">{t('calendar.eventModal.title')}</h2>
                <div className="flex items-center gap-2 mb-2">
                  <PlatformBadge platform={event.platform} />
                  <StatusBadge status={event.status} t={t} />
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">{formattedDate}</p>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-all"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-5">
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-2">{t('calendar.eventModal.postTitle')}</h3>
              <p className="text-gray-700 dark:text-gray-300 font-medium">{event.post_title}</p>
            </div>

            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-2">{t('calendar.eventModal.content')}</h3>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">{event.content}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-5">
              {event.scheduled_at && (
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-2">{t('calendar.eventModal.scheduledFor')}</h3>
                  <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {formatDate(event.scheduled_at, 'dateTimeShort', language)}
                  </div>
                </div>
              )}

              {event.published_at && (
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-2">{t('calendar.eventModal.publishedAt')}</h3>
                  <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {formatDate(event.published_at, 'dateTimeShort', language)}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 dark:border-gray-800 p-6 bg-gray-50 dark:bg-gray-900">
            <div className="flex items-center justify-between">
              <Link
                href={`/posts/${event.post_id}`}
                className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-semibold text-sm"
              >
                {t('calendar.eventModal.viewFullPost')}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
              <button
                onClick={() => setSelectedEvent(null)}
                className="px-4 py-2.5 bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors font-semibold"
              >
                {t('calendar.eventModal.close')}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ============================================
  // Render
  // ============================================
  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-semibold text-foreground tracking-tight">{t('calendar.title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('calendar.subtitle')}</p>
      </div>

      {/* Enhanced Filter Bar */}
      <div className="bg-card rounded-lg border border-border p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          {/* Search Input */}
          <div className="flex-1 min-w-0">
            <div className="relative">
              <input
                type="text"
                placeholder={t('calendar.search.placeholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2.5 pl-9 border border-border bg-card text-foreground placeholder:text-muted-foreground rounded-lg text-sm focus:ring-2 focus:ring-ring/20 focus:border-border transition-all dark:bg-secondary"
              />
              <svg
                className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </div>

          {/* This Week Button */}
          <button
            onClick={handleThisWeekToggle}
            className={`w-full sm:w-auto px-4 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              weekFilterActive
                ? 'bg-primary text-primary-foreground'
                : 'bg-card text-foreground hover:bg-secondary border border-border'
            }`}
          >
            {t('calendar.toolbar.thisWeek')}
          </button>

          {/* Date Range Selector */}
          {customDateRange && (
            <div className="flex items-center gap-1 overflow-x-auto">
              <button
                onClick={() => handleDateRangeShift('prev')}
                className="p-1.5 hover:bg-accent rounded transition-colors"
                aria-label={t('calendar.toolbar.previousPeriod')}
              >
                <svg className="w-3.5 h-3.5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              <div className="px-3 py-1.5 bg-muted border border-border rounded text-xs text-foreground min-w-[200px] text-center">
                {formatDateRange(customDateRange.start, customDateRange.end)}
              </div>

              <button
                onClick={() => handleDateRangeShift('next')}
                className="p-1.5 hover:bg-accent rounded transition-colors"
                aria-label={t('calendar.toolbar.nextPeriod')}
              >
                <svg className="w-3.5 h-3.5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              <button
                onClick={handleClearDateRange}
                className="p-1.5 hover:bg-accent rounded transition-colors text-muted-foreground hover:text-destructive"
                aria-label={t('calendar.toolbar.clearDateRange')}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* View Mode Toggle + Navigation & Filters */}
      <div className="bg-card rounded-lg border border-border p-4">
          {/* View Toggle Buttons */}
          <div className="flex flex-wrap items-center gap-2 pb-3 mb-3 border-b border-border">
            <span className="text-xs text-muted-foreground mr-2 whitespace-nowrap">{t('calendar.viewMode.label')}</span>
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'month'
                  ? 'bg-secondary text-foreground'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              }`}
            >
              {t('calendar.viewMode.month')}
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'week'
                  ? 'bg-secondary text-foreground'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              }`}
            >
              {t('calendar.viewMode.week')}
            </button>
            <button
              onClick={() => setViewMode('agenda')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'agenda'
                  ? 'bg-secondary text-foreground'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              }`}
            >
              {t('calendar.viewMode.agenda')}
            </button>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            {/* Date Navigation */}
            <div className="flex items-center justify-center lg:justify-start gap-2">
              <button
                onClick={goToPreviousMonth}
                className="p-1.5 hover:bg-secondary rounded-lg transition-colors"
                aria-label={t('calendar.toolbar.previousMonth')}
              >
                <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              <h2 className="text-sm font-medium text-foreground min-w-[140px] text-center">
                {formatDate(new Date(year, month - 1, 1), 'monthYear', language)}
              </h2>

              <button
                onClick={goToNextMonth}
                className="p-1.5 hover:bg-secondary rounded-lg transition-colors"
                aria-label={t('calendar.toolbar.nextMonth')}
              >
                <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              <button
                onClick={goToToday}
                className="ml-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-all text-sm font-medium"
              >
                {t('calendar.toolbar.today')}
              </button>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-1.5">
                <label htmlFor="platform-filter" className="text-xs text-muted-foreground whitespace-nowrap">
                  {t('calendar.filters.platformLabel')}
                </label>
                <select
                  id="platform-filter"
                  value={platformFilter}
                  onChange={(e) => setPlatformFilter(e.target.value)}
                  className="w-full sm:w-auto px-3 py-2 border border-border bg-card text-foreground rounded-lg text-sm focus:ring-2 focus:ring-ring/20 focus:border-border transition-all dark:bg-secondary"
                >
                  <option value="all">{t('calendar.filters.allPlatforms')}</option>
                  {PLATFORMS.map((platform) => (
                    <option key={platform} value={platform}>
                      {PLATFORM_DISPLAY_NAMES[platform]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-1.5">
                <label htmlFor="status-filter" className="text-xs text-muted-foreground whitespace-nowrap">
                  {t('calendar.filters.statusLabel')}
                </label>
                <select
                  id="status-filter"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full sm:w-auto px-3 py-2 border border-border bg-card text-foreground rounded-lg text-sm focus:ring-2 focus:ring-ring/20 focus:border-border transition-all dark:bg-secondary"
                >
                  <option value="all">{t('calendar.filters.allStatuses')}</option>
                  <option value="scheduled">{t('status.scheduled')}</option>
                  <option value="published">{t('status.published')}</option>
                </select>
              </div>
            </div>
          </div>

          {/* Stats */}
          {calendarData && (
            <div className="mt-3 pt-3 border-t border-border">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {t('calendar.stats.showing')} <span className="text-foreground">{applyClientSideFilters(calendarData.events).length}</span> {applyClientSideFilters(calendarData.events).length === 1 ? t('calendar.stats.eventSingular') : t('calendar.stats.eventPlural')} {t('calendar.stats.in')} {formatDate(new Date(year, month - 1, 1), 'monthYear', language)}
                  {(searchQuery || customDateRange) && (
                    <span className="text-muted-foreground"> {t('calendar.stats.filteredFrom')} {calendarData.total_events} {t('calendar.stats.total')}</span>
                  )}
                </p>
                {(searchQuery || customDateRange) && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setWeekFilterActive(false);
                      setCustomDateRange(null);
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    {t('calendar.stats.clearAllFilters')}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

      {/* Calendar Grid */}
      {loading ? (
        <div className="bg-card rounded-xl border border-border p-16 text-center">
          <div className="inline-flex items-center gap-2">
            <svg className="animate-spin w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-sm text-muted-foreground">{t('calendar.loading.message')}</p>
          </div>
        </div>
      ) : viewMode === 'month' ? (
        <div className="min-h-[500px] sm:h-[calc(100vh-320px)]">
          <div className="bg-card rounded-xl border border-border overflow-x-auto h-full flex flex-col">
            {/* Day Headers */}
            <div className="grid grid-cols-7 bg-secondary/50 border-b border-border min-w-[640px]">
              {[
                t('calendar.weekdays.sun'),
                t('calendar.weekdays.mon'),
                t('calendar.weekdays.tue'),
                t('calendar.weekdays.wed'),
                t('calendar.weekdays.thu'),
                t('calendar.weekdays.fri'),
                t('calendar.weekdays.sat')
              ].map((day, index) => (
                <div key={index} className="p-2 text-center text-[11px] font-medium text-muted-foreground uppercase tracking-wide border-r border-border last:border-r-0">
                  {day}
                </div>
              ))}
            </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7 flex-1 min-w-[640px]">
            {calendarCells.map((day, index) => {
              const events = getEventsForDay(day);
              const isTodayCell = isToday(day);

              return (
                <div
                  key={index}
                  className={`min-h-[80px] p-1.5 border-r border-b border-border last:border-r-0 flex flex-col ${
                    day ? 'bg-card hover:bg-accent/30 transition-colors' : 'bg-muted/30'
                  } ${isTodayCell ? 'ring-1 ring-inset ring-primary bg-primary/5' : ''}`}
                >
                  {day && (
                    <>
                      <div className={`text-xs mb-1 ${isTodayCell ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
                        {day}
                      </div>

                      <div className="space-y-0.5 overflow-y-auto flex-1">
                        {events.slice(0, 3).map((event) => {
                          return (
                            <button
                              key={event.id}
                              onClick={() => router.push(`/posts/${event.post_id}`)}
                              className="w-full text-left px-1.5 py-1 rounded text-[10px] bg-accent hover:bg-accent/80 transition-colors border-l-2 border-border"
                            >
                              <div className="truncate text-foreground">
                                {getPlatformEmoji(event.platform)}
                                {' '}
                                {event.post_title}
                              </div>
                            </button>
                          );
                        })}

                        {events.length > 3 && (
                          <button
                            onClick={() => setDayEventsModal({ day: day, events })}
                            className="text-[10px] text-muted-foreground hover:text-foreground pl-1.5"
                          >
                            +{events.length - 3} {t('calendar.dayCell.more')}
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
          </div>
        </div>
      ) : viewMode === 'week' ? (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          {/* Week View - Warm Professional */}
          <div className="p-5">
            <h3 className="text-sm font-medium text-foreground mb-3">{t('calendar.weekView.title')}</h3>
            <div className="grid grid-cols-7 gap-1.5">
              {(() => {
                const startOfWeek = new Date(year, month - 1, 1);
                startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
                return Array.from({ length: 7 }).map((_, i) => {
                  const dayDate = new Date(startOfWeek);
                  dayDate.setDate(dayDate.getDate() + i);
                  const dayNum = dayDate.getDate();
                  const events = calendarData ? applyClientSideFilters(calendarData.events).filter(e => {
                    const eventDate = new Date(e.date);
                    return eventDate.getDate() === dayNum &&
                           eventDate.getMonth() === dayDate.getMonth() &&
                           eventDate.getFullYear() === dayDate.getFullYear();
                  }) : [];
                  const isTodayCell = new Date().toDateString() === dayDate.toDateString();

                  return (
                    <div key={i} className={`p-2 rounded border ${isTodayCell ? 'border-primary bg-primary/5' : 'border-border'}`}>
                      <div className={`text-[10px] mb-1 ${isTodayCell ? 'text-primary' : 'text-muted-foreground'}`}>
                        {formatDate(dayDate, 'dateShort', language)}
                      </div>
                      <div className={`text-lg font-medium mb-2 ${isTodayCell ? 'text-primary' : 'text-foreground'}`}>
                        {dayNum}
                      </div>
                      <div className="space-y-1">
                        {events.slice(0, 5).map((event) => {
                          return (
                            <button
                              key={event.id}
                              onClick={() => router.push(`/posts/${event.post_id}`)}
                              className="w-full text-left px-1.5 py-1 rounded text-[10px] bg-accent hover:bg-accent/80 transition-colors border-l-2 border-border"
                            >
                              <div className="truncate text-foreground">
                                {getPlatformEmoji(event.platform)} {event.post_title}
                              </div>
                            </button>
                          );
                        })}
                        {events.length > 5 && (
                          <p className="text-[10px] text-muted-foreground pl-1.5">+{events.length - 5} {t('calendar.dayCell.more')}</p>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          {/* Agenda View - Warm Professional */}
          <div className="p-5">
            <h3 className="text-sm font-medium text-foreground mb-3">{t('calendar.agendaView.title')}</h3>
            <div className="space-y-3">
              {(() => {
                const allEvents = calendarData ? applyClientSideFilters(calendarData.events) : [];
                const eventsByDate = allEvents.reduce((acc, event) => {
                  const dateKey = new Date(event.date).toDateString();
                  if (!acc[dateKey]) acc[dateKey] = [];
                  acc[dateKey].push(event);
                  return acc;
                }, {} as { [key: string]: CalendarEvent[] });

                return Object.entries(eventsByDate).sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime()).map(([dateStr, events]) => {
                  const date = new Date(dateStr);
                  return (
                    <div key={dateStr} className="border-l-2 border-border pl-3">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="text-xs font-medium text-foreground">
                          {formatDate(date, 'dateFull', language)}
                        </div>
                        <span className="px-1.5 py-0.5 bg-muted text-muted-foreground text-[10px] rounded">
                          {events.length} {events.length === 1 ? t('common.event') : t('common.events')}
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {events.map((event) => (
                          <div key={event.id} className="flex items-start gap-2 p-2 bg-accent/50 rounded hover:bg-accent transition-colors">
                            <div className="flex-1">
                              <div className="flex items-center gap-1.5 mb-1">
                                <PlatformBadge platform={event.platform} />
                                <StatusBadge status={event.status} t={t} />
                              </div>
                              <button
                                onClick={() => router.push(`/posts/${event.post_id}`)}
                                className="text-sm text-foreground hover:text-primary text-left"
                              >
                                {event.post_title}
                              </button>
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                {event.content}
                              </p>
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              {event.scheduled_at ? formatDate(event.scheduled_at, 'timeOnly', language) :
                               event.published_at ? formatDate(event.published_at, 'timeOnly', language) : '-'}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                });
              })()}
              {calendarData && applyClientSideFilters(calendarData.events).length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <p className="text-sm">{t('calendar.agendaView.noEvents')}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Legend - Warm Professional: minimal */}
      <div className="bg-card rounded-xl border border-border p-4">
        <h3 className="text-xs font-medium text-foreground mb-3">{t('calendar.legend.title')}</h3>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-accent border border-border"></div>
            <span className="text-xs text-muted-foreground">{t('calendar.legend.scheduled')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-accent border border-border"></div>
            <span className="text-xs text-muted-foreground">{t('calendar.legend.published')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded ring-1 ring-primary bg-primary/10"></div>
            <span className="text-xs text-muted-foreground">{t('calendar.legend.today')}</span>
          </div>
        </div>
      </div>

      {/* Event Details Modal */}
      {selectedEvent && <EventModal event={selectedEvent} />}

      {/* Day Events Modal */}
      {dayEventsModal && <DayEventsModal day={dayEventsModal.day} events={dayEventsModal.events} />}
    </div>
  );
}
