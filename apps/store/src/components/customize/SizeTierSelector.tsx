import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

  return (
    <div className="space-y-3 rounded-xl border border-border p-4">
      <div>
        <h3 className="font-semibold">Print Size</h3>
        <p className="text-sm text-muted-foreground">
          Choose size tier for each selected area
        </p>
      </div>

      <div className="space-y-3">
        {selectedAreas.map((area) => (
          <div key={area.id} className="grid gap-2 sm:grid-cols-[180px,1fr] sm:items-center">
            <p className="text-sm font-medium">{area.label}</p>
            <Select
              value={selectedSizeTierByArea[area.id] || undefined}
              onValueChange={(value) => onSelectSizeTier(area.id, value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select size tier" />
              </SelectTrigger>
              <SelectContent>
                {sizeTiers.map((tier) => (
                  <SelectItem key={tier.id} value={tier.id}>
                    {tier.label} ({tier.widthCm}x{tier.heightCm}cm)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
    </div>
  );
}

