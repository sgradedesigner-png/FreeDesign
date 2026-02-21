import { useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import type { WizardFormData } from '@/hooks/useProductWizard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, AlertCircle, DollarSign } from 'lucide-react';
import { getFamilyConfig } from '../product-family/familyConfig';
import { api } from '@/lib/api';

type Step6_ReviewProps = {
  form: UseFormReturn<WizardFormData>;
  onSave: () => void;
  isSubmitting: boolean;
};

type PricingBreakdown = {
  sizeTierName: string;
  baseFee: number;
  extraSideFee: number;
  extraSides: number;
  extraSideFeeTotal: number;
  rushFee: number;
  rushFeeTotal: number;
  quantity: number;
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  total: number;
};

export function Step6_Review({ form, onSave, isSubmitting }: Step6_ReviewProps) {
  const values = form.getValues();
  const familyConfig = getFamilyConfig(values.productFamily);
  const errors = Object.entries(form.formState.errors);

  const [pricingCalc, setPricingCalc] = useState({
    sizeTierId: '',
    printAreaIds: [] as string[],
    quantity: 1,
    rushOrder: false,
  });

  const [pricingBreakdown, setPricingBreakdown] = useState<PricingBreakdown | null>(null);
  const [pricingLoading, setPricingLoading] = useState(false);

  const calculatePricing = async () => {
    if (!pricingCalc.sizeTierId || pricingCalc.printAreaIds.length === 0) {
      return;
    }

    setPricingLoading(true);
    try {
      const { data } = await api.post('/admin/pricing/preview', {
        sizeTierId: pricingCalc.sizeTierId,
        printAreaIds: pricingCalc.printAreaIds,
        quantity: pricingCalc.quantity,
        rushOrder: pricingCalc.rushOrder,
      });
      setPricingBreakdown(data);
    } catch (error) {
      console.error('Failed to calculate pricing:', error);
    } finally {
      setPricingLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Product Summary</CardTitle>
          <CardDescription>Review your product configuration</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-muted-foreground">Product Family</Label>
              <p className="font-medium">{familyConfig.label}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Title</Label>
              <p className="font-medium">{values.title || 'Not set'}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Slug</Label>
              <p className="font-mono text-sm text-muted-foreground">/{values.slug || 'not-set'}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Base Price</Label>
              <p className="font-medium">${values.basePrice || '0.00'}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Variants</Label>
              <p className="font-medium">{values.variants?.length || 0} variant(s)</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Published</Label>
              <Badge variant={values.isPublished ? 'default' : 'secondary'}>
                {values.isPublished ? 'Yes' : 'No'}
              </Badge>
            </div>
          </div>

          {values.printAreas && values.printAreas.length > 0 && (
            <div>
              <Label className="text-muted-foreground">Print Areas</Label>
              <p className="font-medium">{values.printAreas.length} selected</p>
            </div>
          )}

          {values.uploadConstraints && (
            <div>
              <Label className="text-muted-foreground">Upload Constraints</Label>
              <div className="text-sm space-y-1">
                <p>Max {values.uploadConstraints.maxFileSizeMB} MB</p>
                {values.uploadConstraints.minDPI && values.uploadConstraints.minDPI > 0 && (
                  <p>Min {values.uploadConstraints.minDPI} DPI</p>
                )}
                <p>
                  Min {values.uploadConstraints.minWidth}×{values.uploadConstraints.minHeight} px
                </p>
                <p>Formats: {values.uploadConstraints.allowedFormats.join(', ')}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {values.sizeTiers && values.sizeTiers.length > 0 && values.printAreas && values.printAreas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign size={20} />
              Pricing Calculator
            </CardTitle>
            <CardDescription>Simulate pricing for different configurations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Size Tier</Label>
                <Select
                  value={pricingCalc.sizeTierId}
                  onValueChange={(value) => setPricingCalc({ ...pricingCalc, sizeTierId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select size" />
                  </SelectTrigger>
                  <SelectContent>
                    {values.sizeTiers.map((tierId) => (
                      <SelectItem key={tierId} value={tierId}>
                        Size Tier {tierId.slice(0, 8)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input
                  type="number"
                  min="1"
                  value={pricingCalc.quantity}
                  onChange={(e) => setPricingCalc({ ...pricingCalc, quantity: parseInt(e.target.value, 10) })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Print Areas</Label>
              <div className="flex flex-wrap gap-2">
                {values.printAreas.map((areaId) => {
                  const isSelected = pricingCalc.printAreaIds.includes(areaId);
                  return (
                    <Badge
                      key={areaId}
                      variant={isSelected ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => {
                        const next = isSelected
                          ? pricingCalc.printAreaIds.filter((id) => id !== areaId)
                          : [...pricingCalc.printAreaIds, areaId];
                        setPricingCalc({ ...pricingCalc, printAreaIds: next });
                      }}
                    >
                      Area {areaId.slice(0, 8)}
                    </Badge>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                checked={pricingCalc.rushOrder}
                onCheckedChange={(checked) => setPricingCalc({ ...pricingCalc, rushOrder: !!checked })}
              />
              <Label className="cursor-pointer">Rush Order</Label>
            </div>

            <Button
              type="button"
              onClick={calculatePricing}
              disabled={!pricingCalc.sizeTierId || pricingCalc.printAreaIds.length === 0 || pricingLoading}
            >
              {pricingLoading ? 'Calculating...' : 'Calculate Pricing'}
            </Button>

            {pricingBreakdown && (
              <div className="border rounded-lg p-4 space-y-2 bg-muted/30">
                <div className="flex justify-between text-sm">
                  <span>Base Print Fee ({pricingBreakdown.sizeTierName}):</span>
                  <span>${pricingBreakdown.baseFee.toFixed(2)} × {pricingBreakdown.quantity}</span>
                </div>
                {pricingBreakdown.extraSides > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Extra Side ({pricingBreakdown.extraSides} sides):</span>
                    <span>
                      ${pricingBreakdown.extraSideFee.toFixed(2)} × {pricingBreakdown.quantity}
                    </span>
                  </div>
                )}
                {pricingBreakdown.discountPercent > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Quantity Discount:</span>
                    <span>-{pricingBreakdown.discountPercent}%</span>
                  </div>
                )}
                {pricingBreakdown.rushFeeTotal > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Rush Fee:</span>
                    <span>${pricingBreakdown.rushFeeTotal.toFixed(2)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-bold text-lg">
                  <span>Total:</span>
                  <span className="text-primary">${pricingBreakdown.total.toFixed(2)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className={errors.length > 0 ? 'border-destructive' : 'border-green-500'}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {errors.length === 0 ? (
              <>
                <CheckCircle2 size={20} className="text-green-500" />
                Ready to Create
              </>
            ) : (
              <>
                <AlertCircle size={20} className="text-destructive" />
                Validation Errors
              </>
            )}
          </CardTitle>
          <CardDescription>
            {errors.length === 0
              ? 'All required fields are filled correctly'
              : `Please fix ${errors.length} error(s) before proceeding`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {errors.length > 0 ? (
            errors.map(([field, error]) => (
              <Alert key={field} variant="destructive">
                <AlertDescription>
                  <strong>{field}:</strong> {(error as any)?.message || 'Invalid value'}
                </AlertDescription>
              </Alert>
            ))
          ) : (
            <Alert className="border-green-500 bg-green-50">
              <AlertDescription className="text-green-700">
                Product is ready to be created. Click "Create Product" below to save.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


