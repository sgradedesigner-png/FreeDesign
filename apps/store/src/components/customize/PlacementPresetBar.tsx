/**
 * PlacementPresetBar
 *
 * Horizontally-scrollable row of DTF placement preset buttons shown below the
 * canvas. Each button represents one standard print location (Full Front, Left
 * Chest, etc.) derived from placementStandards.json.
 *
 * The active preset is highlighted with a blue ring.
 * Hovering a preset fires onPresetHover so the canvas can show a ghost rect.
 */

import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { PlacementStandard, ProductType, SizeCategory, ViewName } from '@/types/garment';
import { listPlacements } from '@/lib/placementLoader';
const CENTER_CHEST_OVERRIDE_WIDTH_CM = 15.2;
const CENTER_CHEST_OVERRIDE_HEIGHT_CM = 10.1;
const LEFT_CHEST_OVERRIDE_WIDTH_CM = 7.2;
const LEFT_CHEST_OVERRIDE_HEIGHT_CM = 7.2;
const FULL_FRONT_OVERRIDE_WIDTH_CM = 15.2;
const FULL_FRONT_OVERRIDE_HEIGHT_CM = 20.7;
const OVERSIZE_FRONT_OVERRIDE_WIDTH_CM = 18.7;
const OVERSIZE_FRONT_OVERRIDE_HEIGHT_CM = 25.5;
const ACROSS_CHEST_OVERRIDE_WIDTH_CM = 19.4;
const ACROSS_CHEST_OVERRIDE_HEIGHT_CM = 7.9;
const BACK_FULL_OVERRIDE_WIDTH_CM = 16.9;
const BACK_FULL_OVERRIDE_HEIGHT_CM = 23.1;
const LEFT_SLEEVE_OVERRIDE_WIDTH_CM = 8.6;
const LEFT_SLEEVE_OVERRIDE_HEIGHT_CM = 5.7;
const RIGHT_SLEEVE_OVERRIDE_WIDTH_CM = 8.6;
const RIGHT_SLEEVE_OVERRIDE_HEIGHT_CM = 5.7;

// Human-readable labels per placement key
const PLACEMENT_LABELS: Record<string, string> = {
  front_center:     'Center Chest',
  front_left_chest: 'Left Chest',
  across_chest:     'Across Chest',
  back_center:      'Back Full',
  full_front:       'Full Front',
  oversize_front:   'Oversize Front',
  full_back:        'Full Back',
  top_back:         'Top Back',
  lower_back:       'Lower Back',
  vertical_back:    'Vertical Back',
  sleeve:           'Sleeve',
  front_number:     'Front #',
  back_number:      'Back #',
  back_name:        'Back Name',
};

interface Props {
  productType:       ProductType;
  view:              ViewName;
  sizeCategory:      SizeCategory;
  activePlacementKey?: string | null;
  onPresetSelect:    (placement: PlacementStandard) => void;
  /** Fired on mouse-enter with the hovered placement, null on mouse-leave */
  onPresetHover?:    (placement: PlacementStandard | null) => void;
}

export default function PlacementPresetBar({
  productType,
  view,
  sizeCategory,
  activePlacementKey,
  onPresetSelect,
  onPresetHover,
}: Props) {
  const [localHover, setLocalHover] = useState<string | null>(null);
  const applyDisplayOverride = (placement: PlacementStandard): PlacementStandard => {
    const isApparelFront =
      view === 'front' &&
      (productType === 'hoodie' || productType === 'sweatshirt' || productType === 'polo' || productType === 'tanktop');
    const isApparelBack =
      view === 'back' &&
      (productType === 'hoodie' || productType === 'sweatshirt' || productType === 'polo' || productType === 'tanktop');
    const isApparelLeftSleeve =
      view === 'left' &&
      (productType === 'hoodie' || productType === 'sweatshirt' || productType === 'polo');
    const isApparelRightSleeve =
      view === 'right' &&
      (productType === 'hoodie' || productType === 'sweatshirt' || productType === 'polo');
    if (!isApparelFront && !isApparelBack && !isApparelLeftSleeve && !isApparelRightSleeve) return placement;

    if (placement.placementKey === 'front_center') {
      return {
        ...placement,
        widthCm: CENTER_CHEST_OVERRIDE_WIDTH_CM,
        heightCm: CENTER_CHEST_OVERRIDE_HEIGHT_CM,
      };
    }

    if (placement.placementKey === 'front_left_chest') {
      return {
        ...placement,
        widthCm: LEFT_CHEST_OVERRIDE_WIDTH_CM,
        heightCm: LEFT_CHEST_OVERRIDE_HEIGHT_CM,
      };
    }

    if (placement.placementKey === 'full_front') {
      return {
        ...placement,
        widthCm: FULL_FRONT_OVERRIDE_WIDTH_CM,
        heightCm: FULL_FRONT_OVERRIDE_HEIGHT_CM,
      };
    }

    if (placement.placementKey === 'oversize_front') {
      return {
        ...placement,
        widthCm: OVERSIZE_FRONT_OVERRIDE_WIDTH_CM,
        heightCm: OVERSIZE_FRONT_OVERRIDE_HEIGHT_CM,
      };
    }

    if (placement.placementKey === 'across_chest') {
      return {
        ...placement,
        widthCm: ACROSS_CHEST_OVERRIDE_WIDTH_CM,
        heightCm: ACROSS_CHEST_OVERRIDE_HEIGHT_CM,
      };
    }

    if (isApparelBack && (placement.placementKey === 'back_center' || placement.placementKey === 'full_back')) {
      return {
        ...placement,
        widthCm: BACK_FULL_OVERRIDE_WIDTH_CM,
        heightCm: BACK_FULL_OVERRIDE_HEIGHT_CM,
      };
    }

    if (isApparelLeftSleeve && placement.placementKey === 'sleeve') {
      return {
        ...placement,
        widthCm: LEFT_SLEEVE_OVERRIDE_WIDTH_CM,
        heightCm: LEFT_SLEEVE_OVERRIDE_HEIGHT_CM,
      };
    }
    if (isApparelRightSleeve && placement.placementKey === 'sleeve') {
      return {
        ...placement,
        widthCm: RIGHT_SLEEVE_OVERRIDE_WIDTH_CM,
        heightCm: RIGHT_SLEEVE_OVERRIDE_HEIGHT_CM,
      };
    }

    return placement;
  };

  // Build a deduplicated list: one entry per placementKey,
  // preferring the sizeCategory match over the first-seen entry.
  const allPlacements = listPlacements(productType, view);
  const presetMap = new Map<string, PlacementStandard>();
  for (const p of allPlacements) {
    const existing = presetMap.get(p.placementKey);
    if (!existing || p.sizeCategory === sizeCategory) {
      presetMap.set(p.placementKey, p);
    }
  }
  const presets = Array.from(presetMap.values())
    .filter((placement) => placement.placementKey !== 'full_back')
    .map(applyDisplayOverride);

  if (presets.length === 0) return null;

  return (
    <div
      className="flex gap-2 overflow-x-auto pb-1"
      style={{ scrollbarWidth: 'none' }}
      aria-label="Placement presets"
    >
      {presets.map((placement) => {
        const isActive  = placement.placementKey === activePlacementKey;
        const isHovered = placement.placementKey === localHover;
        const label     = PLACEMENT_LABELS[placement.placementKey] ?? placement.placementKey;

        return (
          <button
            key={placement.placementKey}
            type="button"
            onClick={() => onPresetSelect(placement)}
            onMouseEnter={() => {
              setLocalHover(placement.placementKey);
              onPresetHover?.(placement);
            }}
            onMouseLeave={() => {
              setLocalHover(null);
              onPresetHover?.(null);
            }}
            className={cn(
              'flex flex-col items-center flex-shrink-0 rounded-xl border px-3 py-2',
              'min-w-[76px] text-center transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              isActive
                ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500 dark:bg-blue-950/30'
                : isHovered
                ? 'border-blue-300 bg-blue-50/60 dark:bg-blue-950/20'
                : 'border-border bg-card hover:border-blue-200 hover:bg-muted/40'
            )}
          >
            <span
              className={cn(
                'text-xs font-semibold leading-snug',
                isActive ? 'text-blue-700 dark:text-blue-400' : 'text-foreground'
              )}
            >
              {label}
            </span>
            <span className="mt-0.5 text-[10px] leading-tight text-muted-foreground">
              {placement.widthCm}×{placement.heightCm}cm
            </span>
          </button>
        );
      })}
    </div>
  );
}
