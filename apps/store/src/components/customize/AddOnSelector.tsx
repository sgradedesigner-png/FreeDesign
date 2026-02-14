import { Button } from '@/components/ui/button';

export type AddOnOption = {
  id: string;
  name: string;
  label: string;
  fee: number;
  minQuantity?: number | null;
  maxQuantity?: number | null;
};

type AddOnSelectorProps = {
  quantity: number;
  addOnOptions: AddOnOption[];
  selectedAddOnIds: string[];
  onToggle: (addOnId: string) => void;
};

function formatMnt(value: number): string {
  return `MNT ${Math.max(0, Math.round(value)).toLocaleString()}`;
}

function labelFromName(name: string): string {
  return name
    .replace(/^ADD_ON_/i, '')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function isAvailableForQuantity(
  quantity: number,
  option: { minQuantity?: number | null; maxQuantity?: number | null }
): boolean {
  const minOk = option.minQuantity == null || quantity >= option.minQuantity;
  const maxOk = option.maxQuantity == null || quantity <= option.maxQuantity;
  return minOk && maxOk;
}

export default function AddOnSelector({
  quantity,
  addOnOptions,
  selectedAddOnIds,
  onToggle,
}: AddOnSelectorProps) {
  if (addOnOptions.length === 0) {
    return (
      <div className="space-y-3 rounded-xl border border-border p-4">
        <div>
          <h3 className="font-semibold">Add-ons</h3>
          <p className="text-sm text-muted-foreground">
            No extra add-on options are available for this product.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-border p-4">
      <div>
        <h3 className="font-semibold">Add-ons</h3>
        <p className="text-sm text-muted-foreground">
          Optional finishing services and extras
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {addOnOptions.map((option) => {
          const active = selectedAddOnIds.includes(option.id);
          const available = isAvailableForQuantity(quantity, option);
          const displayLabel = option.label?.trim() || labelFromName(option.name);
          const quantityHint = option.minQuantity != null || option.maxQuantity != null
            ? `Qty ${option.minQuantity ?? 1} - ${option.maxQuantity ?? '+'}`
            : null;

          return (
            <Button
              key={option.id}
              type="button"
              variant={active ? 'default' : 'outline'}
              disabled={!available}
              onClick={() => onToggle(option.id)}
              className="h-auto py-2"
            >
              <span className="text-left">
                <span className="block text-sm font-semibold">{displayLabel}</span>
                <span className="block text-xs opacity-80">{formatMnt(option.fee)} / item</span>
                {quantityHint ? (
                  <span className="block text-[11px] opacity-70">{quantityHint}</span>
                ) : null}
              </span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
