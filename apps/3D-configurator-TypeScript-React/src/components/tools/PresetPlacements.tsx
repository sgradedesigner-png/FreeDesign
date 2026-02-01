// src/components/tools/PresetPlacements.tsx
import { useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { useConfiguratorStore } from '@/stores';
import { useI18n } from '@/hooks';
import { getPresetsForZone, presetToPlacement } from '@/config/placementPresets';
import type { ZoneKey } from '@/types';

interface PresetPlacementsProps {
  className?: string;
}

export function PresetPlacements({ className = '' }: PresetPlacementsProps) {
  const { t } = useI18n();

  // Store state
  const activeZoneKey = useConfiguratorStore((s) => s.activeZoneKey);
  const currentImage = useConfiguratorStore((s) => s.currentImage);
  const printZoneCM = useConfiguratorStore((s) => s.printZoneCM);
  const printZone = useConfiguratorStore((s) => s.printZone);

  // Get presets for current zone
  const presets = useMemo(() => {
    if (activeZoneKey === 'all') return [];
    return getPresetsForZone(activeZoneKey as ZoneKey);
  }, [activeZoneKey]);

  // Handle preset selection
  const handlePresetClick = useCallback(
    (presetId: string) => {
      if (!currentImage || !printZoneCM || activeZoneKey === 'all') return;

      const preset = presets.find((p) => p.id === presetId);
      if (!preset) return;

      // Calculate image aspect ratio
      const imageAspect = currentImage.width / Math.max(1, currentImage.height);

      // Convert preset to placement
      const placement = presetToPlacement(preset, printZoneCM, imageAspect);

      // Get initial rotation from zone's correction angle
      const initialRotation = printZone?.correctionRad ? -printZone.correctionRad : 0;

      // Set placement in store
      const store = useConfiguratorStore.getState();
      store.setPlacement({
        ...placement,
        rotationRad: initialRotation,
      });
    },
    [currentImage, printZoneCM, printZone, activeZoneKey, presets]
  );

  // Check if presets can be used
  const canUsePresets = currentImage && printZoneCM && activeZoneKey !== 'all';

  // Don't render if no presets available
  if (presets.length === 0 || activeZoneKey === 'all') {
    return null;
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <h4 className="text-xs font-medium text-muted-foreground">
        {t('presets.title')}
      </h4>
      <div className="grid grid-cols-2 gap-1.5">
        {presets.map((preset) => (
          <Button
            key={preset.id}
            variant="outline"
            size="sm"
            onClick={() => handlePresetClick(preset.id)}
            disabled={!canUsePresets}
            className="h-auto py-2 px-2 flex flex-col items-center justify-center text-xs"
          >
            <PresetIcon presetId={preset.id} />
            <span className="mt-1 text-[10px] leading-tight text-center">
              {t(preset.nameKey as Parameters<typeof t>[0])}
            </span>
          </Button>
        ))}
      </div>
      {!canUsePresets && (
        <p className="text-[10px] text-muted-foreground text-center">
          {t('presets.uploadFirst')}
        </p>
      )}
    </div>
  );
}

/**
 * Visual icon for preset placement
 */
function PresetIcon({ presetId }: { presetId: string }) {
  // Define visual representations for each preset
  const getIconStyle = (): {
    boxClass: string;
    innerClass: string;
    innerStyle?: React.CSSProperties;
  } => {
    switch (presetId) {
      // Front presets - matching percentage-based placements
      case 'left_chest':
        // W: 20%, H: 20%, Top: 20%, Right: 13% (UV mirrored - right on UV = left chest)
        return {
          boxClass: 'w-8 h-10 border border-muted-foreground/30 rounded-sm relative',
          innerClass: 'absolute bg-primary/60 rounded-[1px]',
          innerStyle: { width: '20%', height: '20%', top: '20%', right: '13%' },
        };
      case 'center_chest':
        // W: 43%, H: 30%, Top: 23%, Center
        return {
          boxClass: 'w-8 h-10 border border-muted-foreground/30 rounded-sm relative',
          innerClass: 'absolute bg-primary/60 rounded-[1px]',
          innerStyle: { width: '43%', height: '30%', top: '23%', left: '28.5%' },
        };
      case 'full_front':
        // W: 57%, H: 68%, Top: 13%, Center
        return {
          boxClass: 'w-8 h-10 border border-muted-foreground/30 rounded-sm relative',
          innerClass: 'absolute bg-primary/60 rounded-[1px]',
          innerStyle: { width: '57%', height: '68%', top: '13%', left: '21.5%' },
        };
      case 'oversize_front':
        // W: 67%, H: 78%, Top: 9%, Center
        return {
          boxClass: 'w-8 h-10 border border-muted-foreground/30 rounded-sm relative',
          innerClass: 'absolute bg-primary/60 rounded-[1px]',
          innerStyle: { width: '67%', height: '78%', top: '9%', left: '16.5%' },
        };
      // Back presets - based on DTF Station standard
      case 'back_collar':
        // W: 17%, H: 12%, Top: 6% (1 inch), Center
        return {
          boxClass: 'w-8 h-10 border border-muted-foreground/30 rounded-sm relative',
          innerClass: 'absolute bg-primary/60 rounded-[1px]',
          innerStyle: { width: '17%', height: '12%', top: '6%', left: '41.5%' },
        };
      case 'upper_back':
        // W: 87%, H: 15%, Top: 10%, Center
        return {
          boxClass: 'w-8 h-10 border border-muted-foreground/30 rounded-sm relative',
          innerClass: 'absolute bg-primary/60 rounded-[1px]',
          innerStyle: { width: '87%', height: '15%', top: '10%', left: '6.5%' },
        };
      case 'full_back':
        // W: 77%, H: 68%, Top: 10%, Center
        return {
          boxClass: 'w-8 h-10 border border-muted-foreground/30 rounded-sm relative',
          innerClass: 'absolute bg-primary/60 rounded-[1px]',
          innerStyle: { width: '77%', height: '68%', top: '10%', left: '11.5%' },
        };
      // Sleeve presets
      case 'sleeve_small':
      case 'right_sleeve_small':
        return {
          boxClass: 'w-8 h-6 border border-muted-foreground/30 rounded-sm relative',
          innerClass: 'absolute bg-primary/60 rounded-[1px]',
          innerStyle: { width: '40%', height: '50%', top: '25%', left: '30%' },
        };
      case 'sleeve_medium':
      case 'right_sleeve_medium':
        return {
          boxClass: 'w-8 h-6 border border-muted-foreground/30 rounded-sm relative',
          innerClass: 'absolute bg-primary/60 rounded-[1px]',
          innerStyle: { width: '60%', height: '65%', top: '18%', left: '20%' },
        };
      case 'sleeve_large':
      case 'right_sleeve_large':
        return {
          boxClass: 'w-8 h-6 border border-muted-foreground/30 rounded-sm relative',
          innerClass: 'absolute bg-primary/60 rounded-[1px]',
          innerStyle: { width: '85%', height: '85%', top: '8%', left: '7.5%' },
        };
      default:
        return {
          boxClass: 'w-8 h-10 border border-muted-foreground/30 rounded-sm relative',
          innerClass: 'absolute bg-primary/60 rounded-[1px]',
          innerStyle: { width: '50%', height: '50%', top: '25%', left: '25%' },
        };
    }
  };

  const { boxClass, innerClass, innerStyle } = getIconStyle();

  return (
    <div className={boxClass}>
      <div className={innerClass} style={innerStyle} />
    </div>
  );
}
