import { Ruler, Upload, Grid3x3, Package, Sparkles, FileUp, Grid2x2 } from 'lucide-react';

export type ProductFamilyValue =
  | 'BY_SIZE'
  | 'GANG_UPLOAD'
  | 'GANG_BUILDER'
  | 'BLANKS'
  | 'UV_BY_SIZE'
  | 'UV_GANG_UPLOAD'
  | 'UV_GANG_BUILDER';

export type ProductFamilyConfig = {
  value: ProductFamilyValue;
  label: string;
  icon: typeof Ruler;
  description: string;
  example: string;
  showStep3: boolean; // Upload config
  showStep4: boolean; // Print areas & size tiers
};

export const PRODUCT_FAMILIES: ProductFamilyConfig[] = [
  {
    value: 'BY_SIZE',
    label: 'DTF by Size',
    icon: Ruler,
    description: 'Standard DTF transfers with size-based pricing',
    example: 'T-shirt designs in S, M, L, XL sizes',
    showStep3: false,
    showStep4: true,
  },
  {
    value: 'GANG_UPLOAD',
    label: 'DTF Gang Sheet Upload',
    icon: Upload,
    description: 'Customers upload ready-to-print gang sheets',
    example: 'Pre-arranged multi-design sheets',
    showStep3: true,
    showStep4: false,
  },
  {
    value: 'GANG_BUILDER',
    label: 'DTF Gang Sheet Builder',
    icon: Grid3x3,
    description: 'Interactive builder for creating gang sheets',
    example: 'Drag-and-drop multiple designs onto sheet',
    showStep3: true,
    showStep4: true,
  },
  {
    value: 'BLANKS',
    label: 'Blanks',
    icon: Package,
    description: 'Physical products without customization',
    example: 'Pre-printed t-shirts, hoodies, accessories',
    showStep3: false,
    showStep4: true,
  },
  {
    value: 'UV_BY_SIZE',
    label: 'UV DTF by Size',
    icon: Sparkles,
    description: 'UV DTF transfers for hard surfaces',
    example: 'Tumblers, mugs, phone cases',
    showStep3: false,
    showStep4: true,
  },
  {
    value: 'UV_GANG_UPLOAD',
    label: 'UV Gang Sheet Upload',
    icon: FileUp,
    description: 'UV DTF gang sheets for hard surfaces',
    example: 'Multiple UV designs in one upload',
    showStep3: true,
    showStep4: false,
  },
  {
    value: 'UV_GANG_BUILDER',
    label: 'UV Gang Sheet Builder',
    icon: Grid2x2,
    description: 'Interactive UV gang sheet builder',
    example: 'Build UV transfer sheets with multiple designs',
    showStep3: true,
    showStep4: true,
  },
];

export function getFamilyConfig(family: ProductFamilyValue): ProductFamilyConfig {
  return PRODUCT_FAMILIES.find((f) => f.value === family) || PRODUCT_FAMILIES[0];
}

export function calculateVisibleSteps(family: ProductFamilyValue | undefined): number[] {
  if (!family) return [1, 2, 5, 6]; // Default: no conditional steps

  const config = getFamilyConfig(family);
  const steps = [1, 2]; // Always show family selection and basic info

  if (config.showStep3) steps.push(3); // Upload config

  // Only BLANKS should show Print Configuration.
  // BLANKS needs variant images first so Print Configuration can map placements visually.
  if (family === 'BLANKS') {
    steps.push(5);
    if (config.showStep4) steps.push(4);
    steps.push(6);
    return steps;
  }

  // Non-BLANKS families skip Print Configuration.
  steps.push(5, 6); // Always show variants and review

  return steps;
}

export function getStepLabel(stepNumber: number): string {
  const labels: Record<number, string> = {
    1: 'Product Family',
    2: 'Basic Information',
    3: 'Upload Configuration',
    4: 'Print Configuration',
    5: 'Variants & Inventory',
    6: 'Review & Pricing',
  };
  return labels[stepNumber] || 'Unknown Step';
}
