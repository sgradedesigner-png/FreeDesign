import { Button } from '@/components/ui/button';

export type PrintAreaOption = {
  id: string;
  name: string;
  label: string;
  maxWidthCm: number;
  maxHeightCm: number;
  isDefault?: boolean;
};

type PlacementSelectorProps = {
  printAreas: PrintAreaOption[];
  selectedAreaIds: string[];
  onToggleArea: (printAreaId: string) => void;
};

export default function PlacementSelector({
  printAreas,
  selectedAreaIds,
  onToggleArea,
}: PlacementSelectorProps) {
  return (
    <div className="space-y-3 rounded-xl border border-border p-4">
      <div>
        <h3 className="font-semibold">Print Areas</h3>
        <p className="text-sm text-muted-foreground">
          Select one or more print positions
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {printAreas.map((area) => {
          const active = selectedAreaIds.includes(area.id);
          return (
            <Button
              key={area.id}
              type="button"
              variant={active ? 'default' : 'outline'}
              onClick={() => onToggleArea(area.id)}
              className="h-auto py-2"
            >
              <span className="text-left">
                <span className="block text-sm font-semibold">{area.label}</span>
                <span className="block text-xs opacity-80">
                  Max {area.maxWidthCm}x{area.maxHeightCm}cm
                </span>
              </span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}

