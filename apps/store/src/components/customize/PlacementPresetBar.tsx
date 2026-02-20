import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import type { EnginePlacement } from '@/hooks/usePlacementEngine';

const PLACEMENT_LABELS: Record<string, string> = {
  front_center: 'Center Chest',
  front_left_chest: 'Left Chest',
  across_chest: 'Across Chest',
  back_center: 'Back Full',
  full_front: 'Full Front',
  oversize_front: 'Oversize Front',
  full_back: 'Full Back',
  top_back: 'Top Back',
  lower_back: 'Lower Back',
  vertical_back: 'Vertical Back',
  sleeve: 'Sleeve',
  front_number: 'Front #',
  back_number: 'Back #',
  back_name: 'Back Name',
};

interface Props {
  placements: EnginePlacement[];
  activePlacementKey?: string | null;
  onPresetSelect: (placement: EnginePlacement) => void;
  onPresetHover?: (placement: EnginePlacement | null) => void;
}

function formatSizeLabel(placement: EnginePlacement): string | null {
  if (
    typeof placement.widthCm === 'number' &&
    typeof placement.heightCm === 'number' &&
    placement.widthCm > 0 &&
    placement.heightCm > 0
  ) {
    return `${placement.widthCm}x${placement.heightCm}cm`;
  }
  return null;
}

export default function PlacementPresetBar({
  placements,
  activePlacementKey,
  onPresetSelect,
  onPresetHover,
}: Props) {
  const [localHover, setLocalHover] = useState<string | null>(null);

  const deduped = useMemo(() => {
    const map = new Map<string, EnginePlacement>();
    for (const placement of placements) {
      if (!map.has(placement.placementKey)) {
        map.set(placement.placementKey, placement);
      }
    }
    return Array.from(map.values());
  }, [placements]);

  if (deduped.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }} aria-label="Placement presets">
      {deduped.map((placement) => {
        const isActive = placement.placementKey === activePlacementKey;
        const isHovered = placement.placementKey === localHover;
        const label =
          placement.label?.trim() ||
          PLACEMENT_LABELS[placement.placementKey] ||
          placement.placementKey;
        const sizeLabel = formatSizeLabel(placement);

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
              'flex min-w-[76px] flex-shrink-0 flex-col items-center rounded-xl border px-3 py-2 text-center',
              'transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
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
            {sizeLabel && (
              <span className="mt-0.5 text-[10px] leading-tight text-muted-foreground">{sizeLabel}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
