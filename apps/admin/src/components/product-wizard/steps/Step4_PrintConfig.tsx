import { useEffect, useState } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { WizardFormData } from '@/hooks/useProductWizard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Loader2, Check } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

type PrintArea = {
  id: string;
  name: string;
  label: string;
  maxWidthCm: number;
  maxHeightCm: number;
  sortOrder: number;
};

type SizeTier = {
  id: string;
  name: string;
  label: string;
  widthCm: number;
  heightCm: number;
  sortOrder: number;
};

type Step4_PrintConfigProps = {
  form: UseFormReturn<WizardFormData>;
};

export function Step4_PrintConfig({ form }: Step4_PrintConfigProps) {
  const [printAreas, setPrintAreas] = useState<PrintArea[]>([]);
  const [sizeTiers, setSizeTiers] = useState<SizeTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const selectedAreas = form.watch('printAreas') || [];
  const selectedTiers = form.watch('sizeTiers') || [];

  useEffect(() => {
    // Fetch print areas and size tiers
    Promise.all([
      api.get('/api/admin/print-areas').then((res) => res.data.areas),
      api.get('/api/admin/size-tiers').then((res) => res.data.tiers),
    ])
      .then(([areas, tiers]) => {
        setPrintAreas(areas);
        setSizeTiers(tiers);
        setLoading(false);
      })
      .catch((error) => {
        console.error('Failed to fetch print areas or size tiers:', error);
        setError('Failed to load print configuration options');
        setLoading(false);
      });
  }, []);

  const toggleArea = (areaId: string) => {
    const next = selectedAreas.includes(areaId)
      ? selectedAreas.filter((id) => id !== areaId)
      : [...selectedAreas, areaId];
    form.setValue('printAreas', next, { shouldValidate: true });
  };

  const setDefaultArea = (areaId: string) => {
    form.setValue('printAreaDefaults', { [areaId]: true }, { shouldValidate: true });
  };

  const toggleTier = (tierId: string) => {
    const next = selectedTiers.includes(tierId)
      ? selectedTiers.filter((id) => id !== tierId)
      : [...selectedTiers, tierId];
    form.setValue('sizeTiers', next, { shouldValidate: true });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="py-8">
          <p className="text-center text-destructive">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Print Areas</CardTitle>
          <CardDescription>
            Select where customers can place designs (e.g., front, back, sleeve)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {printAreas.length === 0 ? (
            <p className="text-sm text-muted-foreground">No print areas available</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {printAreas.map((area) => {
                const isSelected = selectedAreas.includes(area.id);
                const isDefault = form.watch('printAreaDefaults')?.[area.id] || false;

                return (
                  <PrintAreaCard
                    key={area.id}
                    area={area}
                    selected={isSelected}
                    isDefault={isDefault}
                    onToggle={() => toggleArea(area.id)}
                    onSetDefault={() => setDefaultArea(area.id)}
                  />
                );
              })}
            </div>
          )}

          {selectedAreas.length > 0 && (
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <p className="text-sm font-medium mb-2">Selected Print Areas:</p>
              <div className="flex flex-wrap gap-2">
                {selectedAreas.map((areaId) => {
                  const area = printAreas.find((a) => a.id === areaId);
                  if (!area) return null;
                  return (
                    <Badge key={areaId} variant="secondary">
                      {area.label}
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Size Tiers</CardTitle>
          <CardDescription>Select available print sizes for this product</CardDescription>
        </CardHeader>
        <CardContent>
          {sizeTiers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No size tiers available</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {sizeTiers.map((tier) => {
                const isSelected = selectedTiers.includes(tier.id);

                return (
                  <SizeTierCard
                    key={tier.id}
                    tier={tier}
                    selected={isSelected}
                    onToggle={() => toggleTier(tier.id)}
                  />
                );
              })}
            </div>
          )}

          {selectedTiers.length > 0 && (
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <p className="text-sm font-medium mb-2">Selected Size Tiers:</p>
              <div className="flex flex-wrap gap-2">
                {selectedTiers.map((tierId) => {
                  const tier = sizeTiers.find((t) => t.id === tierId);
                  if (!tier) return null;
                  return (
                    <Badge key={tierId} variant="secondary">
                      {tier.label} ({tier.widthCm}×{tier.heightCm} cm)
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PrintAreaCard({
  area,
  selected,
  isDefault,
  onToggle,
  onSetDefault,
}: {
  area: PrintArea;
  selected: boolean;
  isDefault: boolean;
  onToggle: () => void;
  onSetDefault: () => void;
}) {
  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:shadow-md',
        selected && 'ring-2 ring-primary'
      )}
      onClick={onToggle}
    >
      <CardContent className="pt-6">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <Checkbox checked={selected} onCheckedChange={onToggle} />
            <div>
              <p className="font-medium">{area.label}</p>
              <p className="text-xs text-muted-foreground">
                Max: {area.maxWidthCm}×{area.maxHeightCm} cm
              </p>
            </div>
          </div>
          {selected && isDefault && (
            <Badge variant="default" className="text-xs">
              Default
            </Badge>
          )}
        </div>

        {selected && !isDefault && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSetDefault();
            }}
            className="text-xs text-primary hover:underline"
          >
            Set as default
          </button>
        )}
      </CardContent>
    </Card>
  );
}

function SizeTierCard({
  tier,
  selected,
  onToggle,
}: {
  tier: SizeTier;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:shadow-md',
        selected && 'ring-2 ring-primary bg-primary/5'
      )}
      onClick={onToggle}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="font-medium text-sm">{tier.label}</p>
          {selected && <Check size={16} className="text-primary" />}
        </div>
        <p className="text-xs text-muted-foreground">
          {tier.widthCm}×{tier.heightCm} cm
        </p>
      </CardContent>
    </Card>
  );
}
