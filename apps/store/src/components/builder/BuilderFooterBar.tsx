/**
 * BuilderFooterBar.tsx
 * P3-03 — Bottom bar: autosave indicator, preview status, add-to-cart
 */

import { Loader2, CheckCircle2, Clock, AlertCircle, ShoppingCart, RefreshCw } from 'lucide-react';
import type { PreviewJob } from '@/data/builder.api';

type BuilderFooterBarProps = {
  isSaving:       boolean;
  lastSavedAt:    Date | null;
  itemCount:      number;
  preview:        PreviewJob | null;
  isRequestingPreview: boolean;
  onRequestPreview: () => void;
  onAddToCart:    () => void;
  isAddingToCart: boolean;
};

export function BuilderFooterBar({
  isSaving,
  lastSavedAt,
  itemCount,
  preview,
  isRequestingPreview,
  onRequestPreview,
  onAddToCart,
  isAddingToCart,
}: BuilderFooterBarProps) {
  const canAddToCart = itemCount > 0 && !isSaving;

  // Preview status label
  const previewStatus = preview?.status;
  const previewLabel =
    previewStatus === 'COMPLETE'    ? 'Preview ready' :
    previewStatus === 'PROCESSING'  ? 'Generating...' :
    previewStatus === 'PENDING'     ? 'In queue...'   :
    previewStatus === 'FAILED'      ? 'Preview failed' : null;

  const previewIcon =
    previewStatus === 'COMPLETE'   ? <CheckCircle2 size={14} className="text-green-600" /> :
    previewStatus === 'FAILED'     ? <AlertCircle  size={14} className="text-destructive" /> :
    (previewStatus === 'PENDING' || previewStatus === 'PROCESSING')
                                   ? <Loader2      size={14} className="animate-spin text-muted-foreground" /> : null;

  return (
    <footer className="h-12 border-t bg-card flex items-center justify-between px-4 gap-4 shrink-0">
      {/* Left: autosave */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
        {isSaving ? (
          <>
            <Loader2 size={12} className="animate-spin" />
            <span>Saving…</span>
          </>
        ) : lastSavedAt ? (
          <>
            <CheckCircle2 size={12} className="text-green-600" />
            <span className="hidden sm:block">
              Saved {lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            <span className="sm:hidden">Saved</span>
          </>
        ) : (
          <>
            <Clock size={12} />
            <span>Not saved yet</span>
          </>
        )}
      </div>

      {/* Center: preview */}
      <div className="flex items-center gap-2">
        {previewLabel && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            {previewIcon}
            {previewLabel}
          </span>
        )}
        <button
          type="button"
          onClick={onRequestPreview}
          disabled={isRequestingPreview || itemCount === 0}
          title="Generate preview"
          className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-border hover:bg-accent transition-colors disabled:opacity-40"
        >
          <RefreshCw size={12} className={isRequestingPreview ? 'animate-spin' : ''} />
          Preview
        </button>
      </div>

      {/* Right: add to cart */}
      <button
        type="button"
        onClick={onAddToCart}
        disabled={!canAddToCart || isAddingToCart}
        className="flex items-center gap-2 rounded bg-primary text-primary-foreground px-4 py-1.5 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-40"
        data-testid="builder-add-to-cart"
      >
        {isAddingToCart ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <ShoppingCart size={14} />
        )}
        Add to Cart
      </button>
    </footer>
  );
}
