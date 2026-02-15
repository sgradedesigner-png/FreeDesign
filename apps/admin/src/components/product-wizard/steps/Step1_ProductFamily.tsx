import { UseFormReturn } from 'react-hook-form';
import { WizardFormData } from '@/hooks/useProductWizard';
import { PRODUCT_FAMILIES } from '../product-family/familyConfig';
import { ProductFamilyCard } from '../product-family/ProductFamilyCard';

type Step1_ProductFamilyProps = {
  form: UseFormReturn<WizardFormData>;
};

export function Step1_ProductFamily({ form }: Step1_ProductFamilyProps) {
  const selectedFamily = form.watch('productFamily');

  return (
    <div className="space-y-6">
      <div>
        <p className="text-muted-foreground">
          Choose the type of DTF product you want to create. This determines which configuration
          options are available in the following steps.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PRODUCT_FAMILIES.map((family) => (
          <ProductFamilyCard
            key={family.value}
            family={family}
            selected={selectedFamily === family.value}
            onSelect={() => form.setValue('productFamily', family.value, { shouldValidate: true })}
          />
        ))}
      </div>
    </div>
  );
}
