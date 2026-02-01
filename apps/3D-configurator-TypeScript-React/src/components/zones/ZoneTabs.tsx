// src/components/zones/ZoneTabs.tsx
import { useCallback } from 'react';
import { Shirt, ArrowLeft, ArrowRight, Eye, Check, Crosshair } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useConfiguratorStore } from '@/stores';
import { useI18n } from '@/hooks';
import { useCameraMovement } from '@/hooks/useCameraMovement';
import { ZONE_CM } from '@/config';
import type { ZoneKey } from '@/types';

interface ZoneTabsProps {
  className?: string;
  orientation?: 'horizontal' | 'vertical';
}

const ZONE_KEYS: (ZoneKey | 'all')[] = ['front', 'back', 'left_arm', 'right_arm', 'all'];

export function ZoneTabs({ className = '', orientation = 'horizontal' }: ZoneTabsProps) {
  const { t } = useI18n();
  const { moveCameraToZone } = useCameraMovement();

  // Store state
  const activeZoneKey = useConfiguratorStore((s) => s.activeZoneKey);
  const product = useConfiguratorStore((s) => s.product);
  const zoneDrafts = useConfiguratorStore((s) => s.zoneDrafts);
  const currentImage = useConfiguratorStore((s) => s.currentImage);
  const printZone = useConfiguratorStore((s) => s.printZone);

  /**
   * Handle zone change
   */
  const handleZoneChange = useCallback(
    (newZone: ZoneKey | 'all') => {
      if (newZone === activeZoneKey) return;

      // Get store actions directly to avoid dependency issues
      const store = useConfiguratorStore.getState();

      // Save current draft if not in 'all' view
      if (activeZoneKey !== 'all') {
        store.saveDraft(activeZoneKey);
      }

      // Handle 'all' view
      if (newZone === 'all') {
        store.setActiveZone('all');
        store.clearArtwork();
        moveCameraToZone('all');
        return;
      }

      // Set new active zone
      store.setActiveZone(newZone);

      // Update print zone from zones map
      const zones = store.zones;
      if (zones) {
        const zoneRect = zones.get(newZone);
        if (zoneRect) {
          store.setPrintZone(zoneRect);
        }
      }

      // Update print zone CM
      const zoneCM = ZONE_CM[product]?.[newZone];
      if (zoneCM) {
        store.setPrintZoneCM(zoneCM);
      }

      // Load draft for new zone
      store.loadDraft(newZone);

      // Move camera to new zone
      moveCameraToZone(newZone);
    },
    [activeZoneKey, product, moveCameraToZone]
  );

  /**
   * Get icon for zone
   */
  const getZoneIcon = (zone: ZoneKey | 'all') => {
    switch (zone) {
      case 'front':
      case 'back':
        return <Shirt className="h-4 w-4" />;
      case 'left_arm':
        return <ArrowLeft className="h-4 w-4" />;
      case 'right_arm':
        return <ArrowRight className="h-4 w-4" />;
      case 'all':
        return <Eye className="h-4 w-4" />;
    }
  };

  /**
   * Check if zone has draft
   */
  const hasDraft = (zone: ZoneKey): boolean => {
    const draft = zoneDrafts.get(zone);
    return !!(draft?.image && draft?.placement);
  };

  /**
   * Check if zone is locked
   */
  const isLocked = (zone: ZoneKey): boolean => {
    const draft = zoneDrafts.get(zone);
    return draft?.locked ?? false;
  };

  /**
   * Handle auto placement - center and fit image in current zone
   */
  const handleAutoPlacement = useCallback(() => {
    if (!currentImage || !printZone || activeZoneKey === 'all') return;

    const store = useConfiguratorStore.getState();
    store.centerAndFit(printZone);
  }, [currentImage, printZone, activeZoneKey]);

  // Check if auto placement is available
  const canAutoPlace = currentImage && printZone && activeZoneKey !== 'all';

  const isHorizontal = orientation === 'horizontal';

  return (
    <div
      className={`flex ${isHorizontal ? 'flex-row' : 'flex-col'} gap-1 ${className}`}
    >
      {ZONE_KEYS.map((zone) => {
        const isActive = activeZoneKey === zone;
        const hasContent = zone !== 'all' && hasDraft(zone);
        const locked = zone !== 'all' && isLocked(zone);

        return (
          <Button
            key={zone}
            variant={isActive ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleZoneChange(zone)}
            className={`relative ${isHorizontal ? 'px-3' : 'w-full'}`}
            title={t(`zones.${zone}`)}
          >
            {getZoneIcon(zone)}
            <span className={`ml-1.5 ${isHorizontal ? 'hidden sm:inline' : ''}`}>
              {t(`zones.${zone}`)}
            </span>

            {/* Draft indicator */}
            {hasContent && !locked && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full" />
            )}

            {/* Locked indicator */}
            {locked && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                <Check className="h-2.5 w-2.5 text-white" />
              </span>
            )}
          </Button>
        );
      })}

      {/* Auto Placement Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleAutoPlacement}
        disabled={!canAutoPlace}
        className={`${isHorizontal ? 'px-3' : 'w-full'} ${canAutoPlace ? 'border-primary/50 hover:border-primary' : ''}`}
        title={t('actions.autoPlace')}
      >
        <Crosshair className="h-4 w-4" />
        <span className={`ml-1.5 ${isHorizontal ? 'hidden sm:inline' : ''}`}>
          {t('actions.autoPlace')}
        </span>
      </Button>
    </div>
  );
}
