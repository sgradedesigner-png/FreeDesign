/**
 * Pricing Calculator for By-Size Products
 * Handles tier pricing and finishing surcharges
 */

export type PriceTier = {
  minQuantity: number;
  maxQuantity: number | null;
  unitPrice: string; // Decimal string from backend
};

export type FinishingOption = 'roll' | 'pre_cut';

export type PricingCalculation = {
  tierUnitPrice: number;
  finishingSurcharge: number;
  finalUnitPrice: number;
  subtotal: number;
  appliedTier: PriceTier | null;
};

/**
 * Finishing surcharge percentage
 * Pre-cut adds 20% to the tier price
 */
const FINISHING_SURCHARGE_PERCENTAGE = 0.2;

/**
 * Find the applicable pricing tier for a given quantity
 */
export function findApplicableTier(
  tiers: PriceTier[],
  quantity: number
): PriceTier | null {
  if (!tiers || tiers.length === 0) return null;

  return (
    tiers.find(
      (tier) =>
        quantity >= tier.minQuantity &&
        (tier.maxQuantity === null || quantity <= tier.maxQuantity)
    ) || null
  );
}

/**
 * Calculate pricing for by-size products with finishing options
 *
 * @param tiers - Pricing tiers from backend
 * @param quantity - Quantity selected by user
 * @param finishing - Finishing option (roll or pre_cut)
 * @param fallbackPrice - Fallback price if no tiers available (variant.price)
 * @returns Pricing calculation breakdown
 */
export function calculateBySizePricing(
  tiers: PriceTier[],
  quantity: number,
  finishing: FinishingOption = 'roll',
  fallbackPrice: number = 0
): PricingCalculation {
  // Find applicable tier
  const appliedTier = findApplicableTier(tiers, quantity);

  // Use tier price or fallback
  const tierUnitPrice = appliedTier
    ? parseFloat(appliedTier.unitPrice)
    : fallbackPrice;

  // Calculate finishing surcharge (20% for pre-cut, 0 for roll)
  const finishingSurcharge =
    finishing === 'pre_cut' ? tierUnitPrice * FINISHING_SURCHARGE_PERCENTAGE : 0;

  // Calculate final unit price and subtotal
  const finalUnitPrice = tierUnitPrice + finishingSurcharge;
  const subtotal = finalUnitPrice * quantity;

  return {
    tierUnitPrice,
    finishingSurcharge,
    finalUnitPrice,
    subtotal,
    appliedTier,
  };
}

/**
 * Format price for display
 */
export function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
}

/**
 * Format tier range for display
 * Examples: "1-10 pcs", "51-100 pcs", "101+ pcs"
 */
export function formatTierRange(tier: PriceTier): string {
  if (tier.maxQuantity === null) {
    return `${tier.minQuantity}+ pcs`;
  }
  if (tier.minQuantity === tier.maxQuantity) {
    return `${tier.minQuantity} pc`;
  }
  return `${tier.minQuantity}-${tier.maxQuantity} pcs`;
}
