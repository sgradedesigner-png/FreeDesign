import { useTheme } from '../../context/ThemeContext';
import type { PriceTier } from '../../lib/pricingCalculator';
import { formatPrice, formatTierRange } from '../../lib/pricingCalculator';

interface PricingTierTableProps {
  tiers: PriceTier[];
  selectedQuantity?: number;
  finishing?: 'roll' | 'pre_cut';
}

/**
 * PricingTierTable
 * Displays quantity-based pricing tiers for by-size products
 *
 * Features:
 * - Tier quantity ranges (1-10, 11-50, etc.)
 * - Unit price per tier
 * - Finishing surcharge indication
 * - Highlights active tier based on selected quantity
 */
export default function PricingTierTable({
  tiers,
  selectedQuantity,
  finishing = 'roll',
}: PricingTierTableProps) {
  const { language } = useTheme();

  if (!tiers || tiers.length === 0) {
    return null;
  }

  // Calculate finishing surcharge percentage for display
  const SURCHARGE_PERCENTAGE = 20;

  // Find active tier
  const activeTier = selectedQuantity
    ? tiers.find(
        (tier) =>
          selectedQuantity >= tier.minQuantity &&
          (tier.maxQuantity === null || selectedQuantity <= tier.maxQuantity)
      )
    : null;

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="bg-muted px-4 py-2 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">
          {language === 'mn' ? 'Үнийн шат' : 'Quantity Pricing'}
        </h3>
        {finishing === 'pre_cut' && (
          <p className="text-xs text-muted-foreground mt-1">
            {language === 'mn'
              ? `Урьдчилан зүсэлт +${SURCHARGE_PERCENTAGE}%`
              : `Pre-cut finishing +${SURCHARGE_PERCENTAGE}%`}
          </p>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left py-2 px-4 font-medium text-muted-foreground">
                {language === 'mn' ? 'Тоо ширхэг' : 'Quantity'}
              </th>
              <th className="text-right py-2 px-4 font-medium text-muted-foreground">
                {language === 'mn' ? 'Нэгжийн үнэ' : 'Unit Price'}
              </th>
              {finishing === 'pre_cut' && (
                <th className="text-right py-2 px-4 font-medium text-muted-foreground">
                  {language === 'mn' ? 'Зүсэлттэй' : 'With Pre-cut'}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {tiers.map((tier, index) => {
              const isActive = activeTier === tier;
              const tierPrice = parseFloat(tier.unitPrice);
              const finishingPrice =
                finishing === 'pre_cut' ? tierPrice * 1.2 : tierPrice;

              return (
                <tr
                  key={index}
                  className={`border-b border-border last:border-0 transition-colors ${
                    isActive
                      ? 'bg-primary/10 font-semibold'
                      : 'hover:bg-muted/30'
                  }`}
                >
                  <td className="py-2 px-4">
                    <span
                      className={isActive ? 'text-primary' : 'text-foreground'}
                    >
                      {formatTierRange(tier)}
                    </span>
                  </td>
                  <td
                    className={`py-2 px-4 text-right ${
                      isActive ? 'text-primary' : 'text-foreground'
                    }`}
                  >
                    {formatPrice(tierPrice)}
                  </td>
                  {finishing === 'pre_cut' && (
                    <td
                      className={`py-2 px-4 text-right ${
                        isActive ? 'text-primary' : 'text-foreground'
                      }`}
                    >
                      {formatPrice(finishingPrice)}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer note */}
      <div className="bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
        {language === 'mn'
          ? 'Илүү их захиалбал хямд'
          : 'Better pricing for larger quantities'}
      </div>
    </div>
  );
}
