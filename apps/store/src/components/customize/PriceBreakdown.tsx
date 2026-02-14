import { Button } from '@/components/ui/button';

type PrintFeeLine = {
  printAreaId: string;
  printArea: string;
  printSizeTierId: string;
  printSizeTier: string;
  fee: number;
};

type ExtraSideFeeLine = {
  printAreaId: string;
  printArea: string;
  fee: number;
};

type AddOnFeeLine = {
  id: string;
  name: string;
  fee: number;
};

export type CustomizationPriceBreakdown = {
  basePrice: number;
  quantity: number;
  printFees: PrintFeeLine[];
  printFeeTotalPerItem: number;
  extraSideFee: {
    appliedSides: number;
    lines: ExtraSideFeeLine[];
    perItem: number;
    total: number;
  };
  addOnFee: {
    lines: AddOnFeeLine[];
    perItem: number;
    total: number;
  };
  subtotal: number;
  quantityDiscount: {
    percent: number;
    amount: number;
  };
  rushFee: number;
  grandTotal: number;
};

type PriceBreakdownProps = {
  breakdown: CustomizationPriceBreakdown | null;
  loading: boolean;
  error?: string | null;
  quantity: number;
  rushOrder: boolean;
  onRequestQuote: () => void;
};

function mnt(value: number): string {
  return `MNT ${Number(value || 0).toLocaleString()}`;
}

function addOnLabel(name: string): string {
  return name
    .replace(/^ADD_ON_/i, '')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function PriceBreakdown({
  breakdown,
  loading,
  error,
  quantity,
  rushOrder,
  onRequestQuote,
}: PriceBreakdownProps) {
  return (
    <div className="space-y-3 rounded-xl border border-border p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Price Quote</h3>
          <p className="text-sm text-muted-foreground">
            Quantity: {quantity} {rushOrder ? '• Rush order on' : ''}
          </p>
        </div>
        <Button type="button" variant="outline" onClick={onRequestQuote} disabled={loading}>
          {loading ? 'Calculating...' : 'Refresh Quote'}
        </Button>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {!breakdown ? (
        <p className="text-sm text-muted-foreground">No quote yet. Select options and refresh quote.</p>
      ) : (
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span>Base price</span>
            <span>{mnt(breakdown.basePrice)}</span>
          </div>

          {breakdown.printFees.map((line) => (
            <div key={`${line.printAreaId}:${line.printSizeTierId}`} className="flex items-center justify-between text-muted-foreground">
              <span>
                {line.printArea} • {line.printSizeTier}
              </span>
              <span>{mnt(line.fee)}</span>
            </div>
          ))}

          {breakdown.extraSideFee.total > 0 ? (
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Extra sides</span>
              <span>{mnt(breakdown.extraSideFee.total)}</span>
            </div>
          ) : null}

          {breakdown.addOnFee.lines.map((line) => (
            <div key={line.id} className="flex items-center justify-between text-muted-foreground">
              <span>{addOnLabel(line.name)}</span>
              <span>{mnt(line.fee)}</span>
            </div>
          ))}

          {breakdown.quantityDiscount.amount > 0 ? (
            <div className="flex items-center justify-between text-emerald-600">
              <span>Quantity discount ({breakdown.quantityDiscount.percent}%)</span>
              <span>-{mnt(breakdown.quantityDiscount.amount)}</span>
            </div>
          ) : null}

          {breakdown.rushFee > 0 ? (
            <div className="flex items-center justify-between text-amber-600">
              <span>Rush fee</span>
              <span>{mnt(breakdown.rushFee)}</span>
            </div>
          ) : null}

          <div className="mt-2 border-t border-border pt-2 text-base font-semibold">
            <div className="flex items-center justify-between">
              <span>Grand total</span>
              <span>{mnt(breakdown.grandTotal)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
