// ============================================
// AI Library - Local Storage Service
// ============================================
// Persists saved AI Studio thinking sessions locally.
// Independent from Posts - this is cognitive continuity, not publishing.
//
// BEHAVIOR:
// - Explicit save only (no auto-save to library)
// - Persists across page refresh, Studio reset, new conversation
// - Clearing Studio does NOT delete Library entries
// - Maximum 20 entries, oldest removed when exceeded
// ============================================

import type { ChatMessage, StudioSessionMeta } from '@/types/studio';

const AI_LIBRARY_KEY = 'cm_ai_library_v1';
const MAX_LIBRARY_ENTRIES = 20;

/**
 * Represents a saved session in the AI Library
 */
export interface AILibraryEntry {
  id: string;
  title: string;
  messages: ChatMessage[];
  primaryMessageId: string | null;
  meta: StudioSessionMeta;
  savedAt: number;
  updatedAt: number;
}

/**
 * Derive a human-readable title from session content
 */
function deriveTitle(messages: ChatMessage[], promptInput: string): string {
  // Try to get title from first user message
  const firstUserMessage = messages.find(m => m.role === 'user');
  if (firstUserMessage?.content) {
    const cleaned = firstUserMessage.content.trim().replace(/\n+/g, ' ').replace(/\s+/g, ' ');
    if (cleaned.length <= 50) return cleaned;
    const truncated = cleaned.substring(0, 50);
    const lastSpace = truncated.lastIndexOf(' ');
    return lastSpace > 30 ? truncated.substring(0, lastSpace) + '...' : truncated + '...';
  }

  // Fallback to prompt input
  if (promptInput.trim()) {
    const cleaned = promptInput.trim().replace(/\n+/g, ' ').replace(/\s+/g, ' ');
    if (cleaned.length <= 50) return cleaned;
    return cleaned.substring(0, 47) + '...';
  }

  // Default title with timestamp
  return `Phiên làm việc – ${new Date().toLocaleDateString('vi-VN')}`;
}

/**
 * Load all library entries from localStorage
 */
export function loadAILibrary(): AILibraryEntry[] {
  if (typeof window === 'undefined') return [];

  try {
    const stored = localStorage.getItem(AI_LIBRARY_KEY);
    if (!stored) return [];

    const entries = JSON.parse(stored) as AILibraryEntry[];
    // Sort by most recent first
    return entries.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch (error) {
    console.error('[AI Library] Error loading entries:', error);
    return [];
  }
}

/**
 * Save entries to localStorage
 */
function saveToStorage(entries: AILibraryEntry[]): void {
  if (typeof window === 'undefined') return;

  try {
    // Limit to max entries
    const limited = entries.slice(0, MAX_LIBRARY_ENTRIES);
    localStorage.setItem(AI_LIBRARY_KEY, JSON.stringify(limited));
  } catch (error) {
    console.error('[AI Library] Error saving entries:', error);
  }
}

/**
 * Save or update a session in the AI Library
 * If sessionId already exists, updates it; otherwise creates new entry
 */
export function saveToAILibrary(args: {
  sessionId: string;
  messages: ChatMessage[];
  primaryMessageId: string | null;
  meta: StudioSessionMeta;
}): AILibraryEntry {
  const { sessionId, messages, primaryMessageId, meta } = args;
  const now = Date.now();

  // Load existing entries
  const entries = loadAILibrary();

  // Check if session already exists
  const existingIndex = entries.findIndex(e => e.id === sessionId);

  // Derive title from content
  const title = deriveTitle(messages, meta.promptInput);

  const entry: AILibraryEntry = {
    id: sessionId,
    title,
    messages,
    primaryMessageId,
    meta,
    savedAt: existingIndex >= 0 ? entries[existingIndex].savedAt : now,
    updatedAt: now,
  };

  if (existingIndex >= 0) {
    // Update existing entry
    entries[existingIndex] = entry;
  } else {
    // Add new entry at front
    entries.unshift(entry);
  }

  // Save back to storage
  saveToStorage(entries);

  return entry;
}

/**
 * Get a single library entry by ID
 */
export function getAILibraryEntry(id: string): AILibraryEntry | null {
  const entries = loadAILibrary();
  return entries.find(e => e.id === id) || null;
}

/**
 * Delete a library entry by ID
 */
export function deleteFromAILibrary(id: string): boolean {
  const entries = loadAILibrary();
  const filtered = entries.filter(e => e.id !== id);

  if (filtered.length === entries.length) {
    return false; // Entry not found
  }

  saveToStorage(filtered);
  return true;
}

/**
 * Format relative time for display
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (minutes < 1) return 'Vừa xong';
  if (minutes < 60) return `${minutes} phút trước`;
  if (hours < 24) return `${hours} giờ trước`;
  if (days === 1) return 'Hôm qua';
  if (days < 7) return `${days} ngày trước`;

  return new Date(timestamp).toLocaleDateString('vi-VN');
}
