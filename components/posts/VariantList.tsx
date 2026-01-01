'use client';

import { useState } from 'react';
import { getPlatformDisplayName, getPlatformCharLimit } from '@/lib/platforms';
import type { Variant, Platform, VariantStatus } from '@/lib/types';
import { useTranslation, formatDate } from '@/lib/i18n';

interface VariantListProps {
  variants: Variant[];
  onVariantsUpdated?: () => Promise<void>;
}

interface VariantCardProps {
  variant: Variant;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onVariantUpdated?: () => Promise<void>;
}

function VariantCard({ variant, isSelected, onSelect, onVariantUpdated }: VariantCardProps) {
  const { t, language } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduledDateTime, setScheduledDateTime] = useState('');
  const [updateSuccess, setUpdateSuccess] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(variant.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStatusChange = async (newStatus: VariantStatus) => {
    setUpdating(true);
    try {
      const response = await fetch(`/api/variants/${variant.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error(t('variants.alerts.updateStatusFailed'));
      }

      // Show success flash
      setUpdateSuccess(true);
      setTimeout(() => setUpdateSuccess(false), 2000);

      // Notify parent to refetch data instead of router.refresh()
      if (onVariantUpdated) {
        await onVariantUpdated();
      }
    } catch (error) {
      console.error('Status update error:', error);
      alert(t('variants.alerts.updateStatusFailed'));
    } finally {
      setUpdating(false);
    }
  };

  const handleSchedule = async () => {
    if (!scheduledDateTime) {
      alert(t('variants.alerts.selectDateTime'));
      return;
    }

    setUpdating(true);
    try {
      // Convert datetime-local to UTC ISO string
      const localDate = new Date(scheduledDateTime);
      const isoString = localDate.toISOString();

      const response = await fetch(`/api/variants/${variant.id}/schedule`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduled_at: isoString }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || t('variants.alerts.scheduleFailed'));
      }

      setShowScheduleModal(false);
      setScheduledDateTime('');

      // Show success flash
      setUpdateSuccess(true);
      setTimeout(() => setUpdateSuccess(false), 2000);

      // Notify parent to refetch data
      if (onVariantUpdated) {
        await onVariantUpdated();
      }
    } catch (error: any) {
      console.error('Schedule error:', error);
      alert(error.message || t('variants.alerts.scheduleFailed'));
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(t('variants.alerts.confirmDeleteSingle'))) {
      return;
    }

    setUpdating(true);
    try {
      const response = await fetch(`/api/variants/${variant.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(t('variants.alerts.deleteFailed'));
      }

      // Notify parent to refetch data
      if (onVariantUpdated) {
        await onVariantUpdated();
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert(t('variants.alerts.deleteFailed'));
    } finally {
      setUpdating(false);
    }
  };

  const charLimit = getPlatformCharLimit(variant.platform as Platform);
  const isOverLimit = charLimit && variant.content.length > charLimit;

  // Unified status badge style (matches Posts table) - Novera warm professional
  const statusColors = {
    draft: 'bg-secondary text-secondary-foreground',
    approved: 'bg-secondary text-foreground',
    scheduled: 'bg-secondary text-foreground',
    published: 'bg-secondary text-foreground',
  };

  return (
    <div className={`border rounded-lg p-4 transition-all ${
      updateSuccess
        ? 'border-foreground/50 bg-secondary/70'
        : isSelected
        ? 'border-foreground/40 bg-secondary/50'
        : 'border-border hover:border-border-medium'
    }`}>
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-start gap-3 flex-1">
          {/* Selection Checkbox */}
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onSelect(variant.id)}
            className="mt-1 h-4 w-4 text-foreground border-border rounded focus:ring-ring/20"
          />

          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium text-foreground">
                {getPlatformDisplayName(variant.platform as Platform)}
              </span>
              <span className="px-2 py-0.5 bg-secondary text-secondary-foreground text-xs rounded">
                {variant.language.toUpperCase()}
              </span>
              <span
                className={`px-2 py-0.5 rounded text-xs font-medium ${
                  statusColors[variant.status as keyof typeof statusColors]
                }`}
              >
                {variant.status}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className={isOverLimit ? 'text-destructive font-medium' : ''}>
                {variant.character_count || variant.content.length} chars
                {charLimit && ` / ${charLimit}`}
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={handleCopy}
          disabled={updating}
          className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all disabled:opacity-50 ${
            copied
              ? 'bg-secondary text-foreground border border-border'
              : 'bg-card text-muted-foreground border border-border hover:bg-secondary hover:text-foreground'
          }`}
        >
          {copied ? (
            <>
              <span className="inline-block mr-1">✓</span>
              {t('variants.item.copied')}
            </>
          ) : (
            t('variants.item.copy')
          )}
        </button>
      </div>

      <div className="bg-secondary/50 border border-border rounded-lg p-3 text-sm text-foreground whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed">
        {variant.content}
      </div>

      {/* Action Buttons - Novera warm professional */}
      <div className="mt-3 flex flex-col sm:flex-row sm:flex-wrap gap-2">
        {variant.status === 'draft' && (
          <button
            onClick={() => handleStatusChange('approved')}
            disabled={updating}
            className="w-full sm:w-auto px-3 py-1.5 text-sm bg-primary text-primary-foreground font-medium rounded-lg hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {updating ? (
              <>
                <span className="inline-block animate-spin mr-2">⚙</span>
                {t('variants.item.updating')}
              </>
            ) : (
              t('variants.item.markApproved')
            )}
          </button>
        )}
        {variant.status === 'approved' && (
          <>
            <button
              onClick={() => setShowScheduleModal(true)}
              disabled={updating}
              className="w-full sm:w-auto px-3 py-1.5 text-sm bg-card text-foreground font-medium border border-border rounded-lg hover:bg-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('variants.item.schedulePublish')}
            </button>
            <button
              onClick={() => handleStatusChange('published')}
              disabled={updating}
              className="w-full sm:w-auto px-3 py-1.5 text-sm bg-primary text-primary-foreground font-medium rounded-lg hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {updating ? (
                <>
                  <span className="inline-block animate-spin mr-2">⚙</span>
                  {t('variants.item.publishing')}
                </>
              ) : (
                t('variants.item.markPublished')
              )}
            </button>
          </>
        )}

        {/* Delete Button - Available for all statuses */}
        <button
          onClick={handleDelete}
          disabled={updating}
          className="w-full sm:w-auto px-3 py-1.5 text-sm text-destructive font-medium border border-destructive/30 rounded-lg hover:bg-destructive/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {updating ? (
            <>
              <span className="inline-block animate-spin mr-2">⚙</span>
              Deleting...
            </>
          ) : (
            '🗑️ Delete'
          )}
        </button>

        {updateSuccess && (
          <span className="px-3 py-1.5 text-sm bg-secondary text-foreground font-medium rounded-lg border border-border animate-pulse">
            ✓ Updated!
          </span>
        )}
      </div>

      {/* Schedule Modal - Novera warm professional */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-xl max-w-md w-full border border-border">
            <div className="p-5 border-b border-border">
              <h3 className="text-base font-semibold text-foreground">
                {t('variants.scheduleModal.title')}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {t('variants.scheduleModal.singleDescription')}
              </p>
            </div>

            <div className="p-5">
              <label className="block text-xs font-medium text-muted-foreground mb-2">
                {t('variants.scheduleModal.dateTimeLabel')}
              </label>
              <input
                type="datetime-local"
                value={scheduledDateTime}
                onChange={(e) => setScheduledDateTime(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-border bg-card text-sm text-foreground rounded-lg focus:ring-2 focus:ring-ring/20 focus:border-border transition-all dark:bg-secondary"
                min={new Date().toISOString().slice(0, 16)}
              />
            </div>

            <div className="p-5 border-t border-border bg-secondary/30 flex gap-3 rounded-b-xl">
              <button
                onClick={() => {
                  setShowScheduleModal(false);
                  setScheduledDateTime('');
                }}
                disabled={updating}
                className="flex-1 px-4 py-2.5 border border-border text-foreground bg-card font-medium rounded-lg hover:bg-secondary transition-colors disabled:opacity-50"
              >
                {t('variants.scheduleModal.cancel')}
              </button>
              <button
                onClick={handleSchedule}
                disabled={updating || !scheduledDateTime}
                className="flex-1 px-4 py-2.5 bg-primary text-primary-foreground font-medium rounded-lg hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {updating ? (
                  <>
                    <span className="inline-block animate-spin mr-2">⚙</span>
                    {t('variants.item.scheduling')}
                  </>
                ) : (
                  t('variants.scheduleModal.schedule')
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer Info */}
      <div className="mt-3 space-y-1">
        {variant.scheduled_at && (
          <div className="text-xs text-muted-foreground">
            {t('variants.status.scheduledLabel')} {formatDate(variant.scheduled_at, 'dateTimeShort', language)}
          </div>
        )}

        {variant.published_at && (
          <div className="text-xs text-foreground font-medium">
            {t('variants.status.publishedLabel')} {formatDate(variant.published_at, 'dateTimeShort', language)}
          </div>
        )}

        {variant.platform_post_url && (
          <div className="text-xs">
            <a
              href={variant.platform_post_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground hover:text-foreground/80 underline"
            >
              {t('variants.status.viewOnPlatform')}
            </a>
          </div>
        )}

        {isOverLimit && (
          <div className="text-xs text-destructive font-medium">
            {t('variants.status.charLimitWarning')}
          </div>
        )}

        <div className="text-xs text-muted-foreground/70">
          {t('variants.status.createdLabel')} {formatDate(variant.created_at, 'dateTimeShort', language)}
        </div>
      </div>
    </div>
  );
}

export default function VariantList({ variants, onVariantsUpdated }: VariantListProps) {
  const { t } = useTranslation();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [showBulkScheduleModal, setShowBulkScheduleModal] = useState(false);
  const [bulkScheduleDateTime, setBulkScheduleDateTime] = useState('');

  // ============================================
  // Selection Handlers
  // ============================================
  const handleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === variants.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(variants.map((v) => v.id)));
    }
  };

  // ============================================
  // Bulk Action Handlers
  // ============================================
  const handleBulkAction = async (action: 'approve' | 'publish', scheduled_at?: string) => {
    if (selectedIds.size === 0) {
      alert(t('variants.alerts.selectAtLeastOne'));
      return;
    }

    const confirmMessage =
      action === 'approve'
        ? t('variants.alerts.confirmApprove').replace('{count}', selectedIds.size.toString())
        : t('variants.alerts.confirmPublish').replace('{count}', selectedIds.size.toString());

    if (!confirm(confirmMessage)) {
      return;
    }

    setBulkUpdating(true);
    try {
      const response = await fetch('/api/variants/bulk-actions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variant_ids: Array.from(selectedIds),
          action,
          scheduled_at,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || t('variants.alerts.bulkActionFailed'));
      }

      const result = await response.json();
      const successMsg = action === 'approve'
        ? t('variants.alerts.approveSuccess').replace('{count}', result.updated_count.toString())
        : t('variants.alerts.publishSuccess').replace('{count}', result.updated_count.toString());
      alert(successMsg);

      // Clear selection BEFORE refetching to avoid race condition
      setSelectedIds(new Set());

      // Notify parent to refetch data
      if (onVariantsUpdated) {
        await onVariantsUpdated();
      }
    } catch (error: any) {
      console.error('Bulk action error:', error);
      alert(error.message || t('variants.alerts.bulkActionFailed'));
    } finally {
      setBulkUpdating(false);
    }
  };

  const handleBulkSchedule = async () => {
    if (!bulkScheduleDateTime) {
      alert(t('variants.alerts.selectDateTime'));
      return;
    }

    if (selectedIds.size === 0) {
      alert(t('variants.alerts.selectAtLeastOne'));
      return;
    }

    setBulkUpdating(true);
    try {
      // Convert datetime-local to UTC ISO string (same as single schedule)
      const localDate = new Date(bulkScheduleDateTime);
      const isoString = localDate.toISOString();

      const response = await fetch('/api/variants/bulk-actions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variant_ids: Array.from(selectedIds),
          action: 'schedule',
          scheduled_at: isoString,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || t('variants.alerts.scheduleFailed'));
      }

      const result = await response.json();
      alert(t('variants.alerts.scheduleSuccess').replace('{count}', result.updated_count.toString()));

      setShowBulkScheduleModal(false);
      setBulkScheduleDateTime('');

      // Clear selection BEFORE refetching
      setSelectedIds(new Set());

      // Notify parent to refetch data
      if (onVariantsUpdated) {
        await onVariantsUpdated();
      }
    } catch (error: any) {
      console.error('Bulk schedule error:', error);
      alert(error.message || t('variants.alerts.scheduleFailed'));
    } finally {
      setBulkUpdating(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) {
      alert(t('variants.alerts.selectAtLeastOne'));
      return;
    }

    const confirmMessage = `Are you sure you want to delete ${selectedIds.size} variant(s)? This action cannot be undone.`;
    if (!confirm(confirmMessage)) {
      return;
    }

    setBulkUpdating(true);
    try {
      const response = await fetch('/api/variants/bulk-delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variant_ids: Array.from(selectedIds),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete variants');
      }

      const result = await response.json();
      alert(`Successfully deleted ${result.deleted_count} variant(s)`);

      // Clear selection BEFORE refetching
      setSelectedIds(new Set());

      // Notify parent to refetch data
      if (onVariantsUpdated) {
        await onVariantsUpdated();
      }
    } catch (error: any) {
      console.error('Bulk delete error:', error);
      alert(error.message || 'Failed to delete variants');
    } finally {
      setBulkUpdating(false);
    }
  };

  // ============================================
  // Group variants by platform
  // ============================================
  const variantsByPlatform = variants.reduce((acc, variant) => {
    const platform = variant.platform;
    if (!acc[platform]) {
      acc[platform] = [];
    }
    acc[platform].push(variant);
    return acc;
  }, {} as Record<string, Variant[]>);

  if (variants.length === 0) {
    return (
      <div className="text-center py-12 bg-secondary/30 rounded-xl border border-dashed border-border">
        <div className="text-4xl mb-3">📝</div>
        <h3 className="text-base font-medium text-foreground mb-1">
          {t('variants.empty.title')}
        </h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
          {t('variants.empty.description')}
        </p>
        <p className="text-xs text-muted-foreground bg-card px-3 py-1.5 rounded-lg inline-block border border-border">
          💡 Tip: Use the "Generate Variants" button above to create platform-optimized content
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Bulk Actions Toolbar - Novera warm professional */}
      {variants.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4 sticky top-4 z-20">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={handleSelectAll}
                className="px-3 py-1.5 text-sm border border-border text-foreground bg-card font-medium rounded-lg hover:bg-secondary transition-colors"
              >
                {selectedIds.size === variants.length ? t('variants.bulk.deselectAll') : t('variants.bulk.selectAll')}
              </button>
              {selectedIds.size > 0 ? (
                <span className="px-3 py-1.5 bg-secondary border border-border text-foreground font-medium rounded-lg text-sm">
                  {selectedIds.size} {t('variants.bulk.selected')}
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">
                  No variants selected
                </span>
              )}
            </div>

            {selectedIds.size > 0 && (
              <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
                <button
                  onClick={() => handleBulkAction('approve')}
                  disabled={bulkUpdating}
                  className="w-full sm:w-auto px-3 py-1.5 text-sm bg-primary text-primary-foreground font-medium rounded-lg hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {bulkUpdating ? (
                    <>
                      <span className="inline-block animate-spin mr-2">⚙</span>
                      {t('common.updating')}
                    </>
                  ) : (
                    t('variants.bulk.approveSelected')
                  )}
                </button>
                <button
                  onClick={() => setShowBulkScheduleModal(true)}
                  disabled={bulkUpdating}
                  className="w-full sm:w-auto px-3 py-1.5 text-sm bg-card text-foreground font-medium border border-border rounded-lg hover:bg-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('variants.bulk.scheduleSelected')}
                </button>
                <button
                  onClick={() => handleBulkAction('publish')}
                  disabled={bulkUpdating}
                  className="w-full sm:w-auto px-3 py-1.5 text-sm bg-primary text-primary-foreground font-medium rounded-lg hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('variants.bulk.publishSelected')}
                </button>
                <button
                  onClick={handleBulkDelete}
                  disabled={bulkUpdating}
                  className="w-full sm:w-auto px-3 py-1.5 text-sm text-destructive font-medium border border-destructive/30 rounded-lg hover:bg-destructive/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  🗑️ Delete Selected
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bulk Schedule Modal - Novera warm professional */}
      {showBulkScheduleModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-xl max-w-md w-full border border-border">
            <div className="p-5 border-b border-border">
              <h3 className="text-base font-semibold text-foreground">
                {t('variants.scheduleModal.bulkTitle').replace('{count}', selectedIds.size.toString())}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {t('variants.scheduleModal.bulkDescription')}
              </p>
            </div>

            <div className="p-5">
              <label className="block text-xs font-medium text-muted-foreground mb-2">
                {t('variants.scheduleModal.dateTimeLabel')}
              </label>
              <input
                type="datetime-local"
                value={bulkScheduleDateTime}
                onChange={(e) => setBulkScheduleDateTime(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-border bg-card text-sm text-foreground rounded-lg focus:ring-2 focus:ring-ring/20 focus:border-border transition-all dark:bg-secondary"
                min={new Date().toISOString().slice(0, 16)}
              />
            </div>

            <div className="p-5 border-t border-border bg-secondary/30 flex gap-3 rounded-b-xl">
              <button
                onClick={() => {
                  setShowBulkScheduleModal(false);
                  setBulkScheduleDateTime('');
                }}
                disabled={bulkUpdating}
                className="flex-1 px-4 py-2.5 border border-border text-foreground bg-card font-medium rounded-lg hover:bg-secondary transition-colors disabled:opacity-50"
              >
                {t('variants.scheduleModal.cancel')}
              </button>
              <button
                onClick={handleBulkSchedule}
                disabled={bulkUpdating || !bulkScheduleDateTime}
                className="flex-1 px-4 py-2.5 bg-primary text-primary-foreground font-medium rounded-lg hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {bulkUpdating ? (
                  <>
                    <span className="inline-block animate-spin mr-2">⚙</span>
                    {t('variants.item.scheduling')}
                  </>
                ) : (
                  t('variants.scheduleModal.scheduleAll')
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Variant Cards by Platform */}
      {Object.entries(variantsByPlatform).map(([platform, platformVariants]) => (
        <div key={platform} className="space-y-3">
          <div className="flex items-center gap-2.5 pb-2 border-b border-border">
            <h3 className="text-sm font-medium text-foreground">
              {getPlatformDisplayName(platform as Platform)}
            </h3>
            <span className="px-2 py-0.5 bg-secondary text-secondary-foreground text-xs font-medium rounded">
              {platformVariants.length}
            </span>
          </div>
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
            {platformVariants.map((variant) => (
              <VariantCard
                key={variant.id}
                variant={variant}
                isSelected={selectedIds.has(variant.id)}
                onSelect={handleSelect}
                onVariantUpdated={onVariantsUpdated}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
