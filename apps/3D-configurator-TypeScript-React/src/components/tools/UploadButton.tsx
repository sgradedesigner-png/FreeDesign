// src/components/tools/UploadButton.tsx
import { useRef, useCallback } from 'react';
import { Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useConfiguratorStore } from '@/stores';
import { useI18n } from '@/hooks';

interface UploadButtonProps {
  className?: string;
}

export function UploadButton({ className = '' }: UploadButtonProps) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);

  const currentImage = useConfiguratorStore((s) => s.currentImage);
  const printZone = useConfiguratorStore((s) => s.printZone);
  const activeZoneKey = useConfiguratorStore((s) => s.activeZoneKey);

  const handleClick = () => {
    // Prevent upload in 'all zones' view
    if (activeZoneKey === 'all') return;
    inputRef.current?.click();
  };

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }

      // Load image
      const img = new Image();
      img.onload = () => {
        const store = useConfiguratorStore.getState();
        store.setImage(img);

        // Center and fit if we have a print zone
        if (printZone) {
          store.centerAndFit(printZone);
        } else {
          // Default placement
          store.setPlacement({
            u: 0.5,
            v: 0.5,
            uScale: 0.3,
            vScale: 0.3,
            rotationRad: 0,
          });
        }

        console.log('[Upload] Image loaded:', img.width, 'x', img.height);
      };

      img.onerror = () => {
        alert('Failed to load image');
      };

      img.src = URL.createObjectURL(file);

      // Reset input
      e.target.value = '';
    },
    [printZone]
  );

  const handleClear = useCallback(() => {
    const store = useConfiguratorStore.getState();
    store.clearArtwork();
  }, []);

  const isAllZonesView = activeZoneKey === 'all';

  return (
    <div className={`space-y-2 ${className}`}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
        disabled={isAllZonesView}
      />

      {!currentImage ? (
        <Button
          onClick={handleClick}
          className="w-full"
          variant="default"
          disabled={isAllZonesView}
          title={isAllZonesView ? 'Select a specific zone to upload an image' : undefined}
        >
          <Upload className="h-4 w-4 mr-2" />
          {t('tools.upload')}
        </Button>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
            <img
              src={currentImage.src}
              alt="Uploaded"
              className="w-12 h-12 object-contain rounded"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">Uploaded Image</p>
              <p className="text-xs text-muted-foreground">
                {currentImage.width} x {currentImage.height}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClear}
              className="h-8 w-8 shrink-0"
              disabled={isAllZonesView}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <Button
            onClick={handleClick}
            variant="outline"
            size="sm"
            className="w-full"
            disabled={isAllZonesView}
            title={isAllZonesView ? 'Select a specific zone to change the image' : undefined}
          >
            <Upload className="h-3 w-3 mr-2" />
            Change Image
          </Button>
        </div>
      )}

      {/* Show hint when in all zones view */}
      {isAllZonesView && (
        <p className="text-xs text-muted-foreground text-center italic">
          {t('tools.selectZoneToUpload') || 'Select a specific zone to upload'}
        </p>
      )}
    </div>
  );
}
