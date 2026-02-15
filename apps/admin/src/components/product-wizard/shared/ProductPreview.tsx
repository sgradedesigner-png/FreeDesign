import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UseFormReturn } from 'react-hook-form';
import { WizardFormData } from '@/hooks/useProductWizard';
import { getFamilyConfig } from '../product-family/familyConfig';

type ProductPreviewProps = {
  form: UseFormReturn<WizardFormData>;
};

export function ProductPreview({ form }: ProductPreviewProps) {
  const values = form.watch();
  const familyConfig = getFamilyConfig(values.productFamily);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Product Preview</CardTitle>
        <CardDescription>Live preview of your product</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm text-muted-foreground">Family</p>
          <Badge variant="secondary" className="mt-1">
            {familyConfig.label}
          </Badge>
        </div>

        {values.title && (
          <div>
            <p className="text-sm text-muted-foreground">Title</p>
            <p className="font-medium">{values.title}</p>
          </div>
        )}

        {values.slug && (
          <div>
            <p className="text-sm text-muted-foreground">Slug</p>
            <p className="text-sm font-mono text-muted-foreground">/{values.slug}</p>
          </div>
        )}

        {values.basePrice && Number(values.basePrice) > 0 && (
          <div>
            <p className="text-sm text-muted-foreground">Base Price</p>
            <p className="text-lg font-bold text-primary">${values.basePrice}</p>
          </div>
        )}

        {values.variants && values.variants.length > 0 && (
          <div>
            <p className="text-sm text-muted-foreground">Variants</p>
            <p className="font-medium">{values.variants.length} variant(s)</p>
          </div>
        )}

        {values.printAreas && values.printAreas.length > 0 && (
          <div>
            <p className="text-sm text-muted-foreground">Print Areas</p>
            <p className="font-medium">{values.printAreas.length} area(s)</p>
          </div>
        )}

        {values.features && values.features.length > 0 && (
          <div>
            <p className="text-sm text-muted-foreground">Features</p>
            <ul className="list-disc list-inside text-sm space-y-1">
              {values.features.slice(0, 3).map((feature, i) => (
                <li key={i}>{feature}</li>
              ))}
              {values.features.length > 3 && (
                <li className="text-muted-foreground">+{values.features.length - 3} more</li>
              )}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
