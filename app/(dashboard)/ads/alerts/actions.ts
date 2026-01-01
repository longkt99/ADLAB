'use server';

import { revalidatePath } from 'next/cache';
import {
  markAlertRead,
  toggleAlertResolved,
  updateAlertNote,
  bulkMarkRead,
  bulkMarkUnread,
  bulkResolve,
  bulkReopen,
} from '@/lib/adlab/queries';

export async function markAlertReadAction(id: string, isRead: boolean) {
  const result = await markAlertRead(id, isRead);
  if (result.success) {
    revalidatePath('/ads/alerts');
    revalidatePath(`/ads/alerts/${id}`);
  }
  return result;
}

export async function toggleAlertResolvedAction(id: string, resolved: boolean) {
  const result = await toggleAlertResolved(id, resolved);
  if (result.success) {
    revalidatePath('/ads/alerts');
    revalidatePath(`/ads/alerts/${id}`);
  }
  return result;
}

export async function updateAlertNoteAction(id: string, note: string) {
  const result = await updateAlertNote(id, note);
  if (result.success) {
    revalidatePath(`/ads/alerts/${id}`);
  }
  return result;
}

// ============================================
// Bulk Actions (Phase D2)
// ============================================

export async function bulkMarkReadAction(ids: string[]) {
  const result = await bulkMarkRead(ids);
  if (result.success) {
    revalidatePath('/ads/alerts');
  }
  return result;
}

export async function bulkMarkUnreadAction(ids: string[]) {
  const result = await bulkMarkUnread(ids);
  if (result.success) {
    revalidatePath('/ads/alerts');
  }
  return result;
}

export async function bulkResolveAction(ids: string[]) {
  const result = await bulkResolve(ids);
  if (result.success) {
    revalidatePath('/ads/alerts');
  }
  return result;
}

export async function bulkReopenAction(ids: string[]) {
  const result = await bulkReopen(ids);
  if (result.success) {
    revalidatePath('/ads/alerts');
  }
  return result;
}
