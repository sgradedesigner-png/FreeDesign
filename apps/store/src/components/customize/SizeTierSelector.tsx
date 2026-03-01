import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Ruler } from 'lucide-react';
import type { PrintAreaOption } from './PlacementSelector';

export type PrintSizeTierOption = {
  id: string;
  name: string;
  label: string;
  widthCm: number;
  heightCm: number;
};

type SizeTierSelectorProps = {
  selectedAreaIds: string[];
  printAreas: PrintAreaOption[];
  sizeTiers: PrintSizeTierOption[];
  selectedSizeTierByArea: Record<string, string>;
  onSelectSizeTier: (printAreaId: string, printSizeTierId: string) => void;
};

export default function SizeTierSelector({
  selectedAreaIds,
  printAreas,
  sizeTiers,
  selectedSizeTierByArea,
  onSelectSizeTier,
}: SizeTierSelectorProps) {
  if (selectedAreaIds.length === 0) {
    return null;
  }

  const selectedAreas = printAreas.filter((area) => selectedAreaIds.includes(area.id));
  const formatTierLabel = (tier: PrintSizeTierOption): string => {
    const dims = `${tier.widthCm}x${tier.heightCm}cm`;
    return tier.label.includes(dims) ? tier.label : `${tier.label} (${dims})`;
  };

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div className="flex items-start gap-2">
        <div className="mt-0.5 rounded-md bg-primary/10 p-1.5 text-primary">
          <Ruler className="h-4 w-4" />
        </div>
        <div>
          <h3 className="font-semibold leading-tight">Print Size</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose size tier for each selected area
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {selectedAreas.map((area) => {
          const selectedTier = sizeTiers.find((tier) => tier.id === selectedSizeTierByArea[area.id]);
          return (
            <div
              key={area.id}
              className="rounded-lg border border-border/80 bg-background/30 p-3"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">{area.label}</p>
                <Badge variant="secondary" className="text-[11px]">
                  Area
                </Badge>
              </div>
              <Select
                value={selectedSizeTierByArea[area.id] || undefined}
                onValueChange={(value) => onSelectSizeTier(area.id, value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select size tier" />
                </SelectTrigger>
                <SelectContent>
                  {sizeTiers.map((tier) => (
                    <SelectItem key={tier.id} value={tier.id}>
                      {formatTierLabel(tier)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-2 text-xs text-muted-foreground">
                {selectedTier
                  ? `Selected: ${formatTierLabel(selectedTier)}`
                  : 'Pick a size tier to continue pricing'}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
