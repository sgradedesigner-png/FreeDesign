/**
 * BuilderAssetPanel.tsx
 * P3-03 — Right-hand panel: upload images + size controls for selected item
 */

import { useRef, useState } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { CanvasItem } from '@/data/builder.api';

const API = import.meta.env.VITE_API_URL as string;

type BuilderAssetPanelProps = {
  canvasWidthCm:  number;
  canvasHeightCm: number;
  selected:       CanvasItem | null;
  onAddItem:      (item: Omit<CanvasItem, 'id'>) => void;
  onResizeSelected: (widthCm: number, heightCm: number) => void;
};

export function BuilderAssetPanel({
  canvasWidthCm,
  canvasHeightCm,
  selected,
  onAddItem,
  onResizeSelected,
}: BuilderAssetPanelProps) {
  const fileRef  = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${API}/admin/upload/product-image`, {
        method: 'POST',
        headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
        body: formData,
      });

      if (!res.ok) throw new Error(`Upload failed (${res.status})`);

      const data = await res.json();
      const url: string = data.url;

      // Default size: 10cm wide, keep aspect ratio
      const img = new Image();
      img.src = url;
      await new Promise<void>((resolve) => { img.onload = () => resolve(); img.onerror = () => resolve(); });

      const aspect   = img.naturalHeight > 0 ? img.naturalHeight / img.naturalWidth : 1;
      const widthCm  = Math.min(10, canvasWidthCm * 0.4);
      const heightCm = widthCm * aspect;

      onAddItem({
        assetUrl: url,
        xCm:      (canvasWidthCm  - widthCm)  / 2,
        yCm:      (canvasHeightCm - heightCm) / 2,
        widthCm,
        heightCm,
        rotation: 0,
        zIndex:   Date.now(), // temporary; will be normalised in parent
        flipH:    false,
        flipV:    false,
      });
    } catch (err: any) {
      setError(err.message ?? 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <aside className="w-56 flex-shrink-0 border-l bg-card flex flex-col">
      {/* Upload area */}
      <div className="p-3 border-b">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Add Image</p>
        <label className="block cursor-pointer">
          <div className="border-2 border-dashed rounded-lg p-4 text-center hover:border-primary transition-colors">
            {uploading ? (
              <Loader2 size={20} className="mx-auto animate-spin text-primary" />
            ) : (
              <>
                <Upload size={20} className="mx-auto mb-1 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Click to upload</p>
                <p className="text-[10px] text-muted-foreground">PNG, JPEG, WebP</p>
              </>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={handleFileChange}
            disabled={uploading}
          />
        </label>
        {error && <p className="text-xs text-destructive mt-1">{error}</p>}
      </div>

      {/* Selected item controls */}
      {selected && (
        <div className="p-3 flex-1 overflow-y-auto">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Size (cm)</p>

          <label className="block mb-2">
            <span className="text-xs text-muted-foreground">Width</span>
            <input
              type="number"
              min={0.5}
              max={canvasWidthCm}
              step={0.5}
              value={+selected.widthCm.toFixed(1)}
              onChange={(e) => onResizeSelected(+e.target.value, selected.heightCm)}
              className="mt-1 block w-full rounded border border-border bg-background px-2 py-1 text-sm"
            />
          </label>

          <label className="block">
            <span className="text-xs text-muted-foreground">Height</span>
            <input
              type="number"
              min={0.5}
              max={canvasHeightCm}
              step={0.5}
              value={+selected.heightCm.toFixed(1)}
              onChange={(e) => onResizeSelected(selected.widthCm, +e.target.value)}
              className="mt-1 block w-full rounded border border-border bg-background px-2 py-1 text-sm"
            />
          </label>

          <div className="mt-3 text-xs text-muted-foreground space-y-0.5">
            <p>X: {selected.xCm.toFixed(1)} cm</p>
            <p>Y: {selected.yCm.toFixed(1)} cm</p>
            <p>Rotation: {selected.rotation}°</p>
          </div>
        </div>
      )}
    </aside>
  );
}
