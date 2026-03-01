# DTF-Specific Admin Product Creation Wizard

## Context

**Problem:** The current admin product creation UI (`ProductFormPage.tsx`, 1317 lines) is a generic ecommerce form showing all fields on a single page. This creates cognitive overload for admins creating DTF products, which have family-specific requirements (gang sheet uploads need 50MB + 150 DPI + PDF support, by-size products need print area configuration, UV products have hard-surface constraints). Print areas and upload constraints exist in the backend but aren't configurable through the frontend UI. There's no pricing calculator, no visual preview, and no guidance through the creation process.

**Intended Outcome:** Replace the monolithic form with a multi-step wizard that adapts to the 7 DTF product families (BY_SIZE, GANG_UPLOAD, UV_BY_SIZE, UV_GANG_UPLOAD, BLANKS, GANG_BUILDER, UV_GANG_BUILDER). The wizard will provide progressive disclosure, family-specific fields, print area configuration, upload constraint preview, real-time pricing calculation, and visual product preview. This will reduce admin errors, decrease product creation time from 5+ minutes to <3 minutes, and ensure products have complete metadata.

**Approach:** Build a 6-step wizard alongside the existing form (feature flag controlled). Steps: (1) Product Family Selection, (2) Basic Information, (3) Upload Configuration (conditional), (4) Print Areas & Size Tiers (conditional), (5) Variants & Inventory, (6) Review & Pricing. Use a single React Hook Form instance across all steps with localStorage auto-save. Migrate existing variant management and image upload logic from ProductFormPage. Add minimal backend endpoints for print areas, size tiers, and pricing preview. Deploy incrementally with feature flag rollout over 6 weeks.

---

## Implementation Plan

### 1. Foundation (Week 1)

**Goal:** Set up wizard infrastructure without breaking existing workflow

#### 1.1 Create Component Structure

```
apps/admin/src/
├── components/product-wizard/
│   ├── WizardContainer.tsx          - Main wizard shell
│   ├── WizardStepIndicator.tsx      - Progress breadcrumb (1/6, 2/6)
│   ├── WizardNavigation.tsx         - Next/Prev/Save buttons
│   │
│   ├── steps/
│   │   ├── Step1_ProductFamily.tsx  - Family selector cards
│   │   ├── Step2_BasicInfo.tsx      - Title, category, description
│   │   ├── Step3_UploadConfig.tsx   - Upload constraints (conditional)
│   │   ├── Step4_PrintConfig.tsx    - Print areas + tiers (conditional)
│   │   ├── Step5_Variants.tsx       - Variant management (refactored)
│   │   └── Step6_Review.tsx         - Summary + pricing
│   │
│   ├── product-family/
│   │   ├── ProductFamilyCard.tsx    - Visual card per family
│   │   ├── FamilyIcon.tsx           - Icon mapper
│   │   └── familyConfig.ts          - Family metadata & logic
│   │
│   └── shared/
│       ├── ValidationSummary.tsx    - Error list sidebar
│       ├── ProductPreview.tsx       - Live preview card
│       └── AutoSaveIndicator.tsx    - "Saving..." indicator
│
├── hooks/
│   └── useProductWizard.ts          - Form state management hook
│
└── pages/
    └── ProductWizardPage.tsx         - Main wizard page (new route)
```

#### 1.2 Build Core Wizard Hook

**File:** `apps/admin/src/hooks/useProductWizard.ts`

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState, useEffect, useMemo } from 'react';

type WizardFormData = {
  // Step 1
  productFamily: ProductFamilyValue;

  // Step 2
  title: string;
  slug: string;
  categoryId: string;
  description?: string;
  subtitle?: string;
  basePrice: string;
  rating: string;
  reviews: string;
  features: string[];
  benefits: string[];
  productDetails: string[];
  isPublished: boolean;

  // Step 3 (conditional)
  uploadConstraints?: {
    maxFileSizeMB: number;
    minDPI?: number;
    minWidth: number;
    minHeight: number;
    allowedFormats: string[];
  };

  // Step 4 (conditional)
  printAreas?: string[]; // Array of print area IDs
  printAreaDefaults?: Record<string, boolean>; // Default area
  sizeTiers?: string[]; // Array of size tier IDs

  // Step 5
  variants: ProductVariant[];

  // Step 6 (computed)
  pricingPreview?: PricingBreakdown;
};

export function useProductWizard(productId?: string) {
  const form = useForm<WizardFormData>({
    resolver: zodResolver(productWizardSchema),
    mode: 'onChange',
    defaultValues: DEFAULT_WIZARD_VALUES,
  });

  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  // Conditional step logic based on family
  const visibleSteps = useMemo(() => {
    const family = form.watch('productFamily');
    return calculateVisibleSteps(family);
  }, [form.watch('productFamily')]);

  // Auto-save to localStorage
  useEffect(() => {
    const subscription = form.watch((value) => {
      localStorage.setItem('product-wizard-draft', JSON.stringify(value));
    });
    return () => subscription.unsubscribe();
  }, [form]);

  // Step validation
  const validateStep = async (step: number): Promise<boolean> => {
    const fields = getStepFields(step);
    return await form.trigger(fields);
  };

  // Navigation
  const goToStep = async (step: number) => {
    const isValid = await validateStep(currentStep);
    if (!isValid) return false;

    setCompletedSteps((prev) => new Set([...prev, currentStep]));
    setCurrentStep(step);
    return true;
  };

  return { form, currentStep, completedSteps, visibleSteps, goToStep, validateStep };
}
```

**Key Logic:**
- Single form instance manages entire wizard state
- `visibleSteps` computed from product family (e.g., GANG_UPLOAD skips Step 4, BY_SIZE skips Step 3)
- Auto-save every form change to localStorage
- Validation before step transitions

#### 1.3 Build Wizard Container

**File:** `apps/admin/src/components/product-wizard/WizardContainer.tsx`

```typescript
export function WizardContainer({ productId }: { productId?: string }) {
  const { form, currentStep, completedSteps, visibleSteps, goToStep } = useProductWizard(productId);

  const renderStep = () => {
    switch (visibleSteps[currentStep - 1]) {
      case 1: return <Step1_ProductFamily form={form} />;
      case 2: return <Step2_BasicInfo form={form} />;
      case 3: return <Step3_UploadConfig form={form} />;
      case 4: return <Step4_PrintConfig form={form} />;
      case 5: return <Step5_Variants form={form} />;
      case 6: return <Step6_Review form={form} />;
    }
  };

  return (
    <div className="container mx-auto py-8">
      <WizardStepIndicator
        currentStep={currentStep}
        totalSteps={visibleSteps.length}
        completedSteps={completedSteps}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <div className="lg:col-span-2">
          {renderStep()}
        </div>

        <div className="space-y-4">
          <ProductPreview form={form} />
          <ValidationSummary errors={form.formState.errors} />
        </div>
      </div>

      <WizardNavigation
        currentStep={currentStep}
        totalSteps={visibleSteps.length}
        onNext={() => goToStep(currentStep + 1)}
        onPrev={() => goToStep(currentStep - 1)}
        onSave={handleSubmit}
      />
    </div>
  );
}
```

#### 1.4 Add New Route

**File:** `apps/admin/src/App.tsx`

```typescript
// Add feature flag check
const WIZARD_ENABLED = import.meta.env.VITE_FF_PRODUCT_WIZARD_V1 === 'true';

// Add route
<Route
  path="/products/new"
  element={WIZARD_ENABLED ? <ProductWizardPage /> : <ProductFormPage />}
/>
<Route path="/products/new-wizard" element={<ProductWizardPage />} />
<Route path="/products/new-legacy" element={<ProductFormPage />} />
```

**Testing:**
- Navigate to `/products/new-wizard` shows empty 6-step wizard
- Step indicator shows "1 of 6"
- Next/Prev buttons navigate correctly
- LocalStorage saves draft on form changes
- Validation blocks navigation when title empty

---

### 2. Core Steps (Week 2)

**Goal:** Implement family-agnostic steps (1, 2, 5)

#### 2.1 Step 1: Product Family Selection

**File:** `apps/admin/src/components/product-wizard/steps/Step1_ProductFamily.tsx`

Visual grid of 7 family cards. Each card shows icon, name, description, example use case.

```typescript
export function Step1_ProductFamily({ form }: { form: UseFormReturn<WizardFormData> }) {
  const families = PRODUCT_FAMILIES; // from familyConfig.ts

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Select Product Family</h2>
        <p className="text-muted-foreground">Choose the type of DTF product</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {families.map(family => (
          <ProductFamilyCard
            key={family.value}
            family={family}
            selected={form.watch('productFamily') === family.value}
            onSelect={() => form.setValue('productFamily', family.value)}
          />
        ))}
      </div>
    </div>
  );
}
```

**File:** `apps/admin/src/components/product-wizard/product-family/familyConfig.ts`

```typescript
export const PRODUCT_FAMILIES = [
  {
    value: 'BY_SIZE',
    label: 'DTF by Size',
    icon: 'Ruler',
    description: 'Standard DTF transfers with size-based pricing',
    showStep3: false, // Upload config
    showStep4: true,  // Print areas
  },
  {
    value: 'GANG_UPLOAD',
    label: 'DTF Gang Sheet Upload',
    icon: 'Upload',
    description: 'Customers upload ready-to-print gang sheets',
    showStep3: true,
    showStep4: false,
  },
  // ... other families
];

export function calculateVisibleSteps(family: ProductFamilyValue): number[] {
  const config = PRODUCT_FAMILIES.find(f => f.value === family);
  const steps = [1, 2]; // Always show
  if (config.showStep3) steps.push(3);
  if (config.showStep4) steps.push(4);
  steps.push(5, 6); // Always show
  return steps;
}
```

#### 2.2 Step 2: Basic Information

**File:** `apps/admin/src/components/product-wizard/steps/Step2_BasicInfo.tsx`

Refactor existing basic info fields from ProductFormPage.tsx (lines 614-800).

```typescript
export function Step2_BasicInfo({ form }: { form: UseFormReturn<WizardFormData> }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Basic Information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Title</Label>
          <Input {...form.register('title')} />
          {form.formState.errors.title && <ErrorMessage />}
        </div>

        <div>
          <Label>Slug</Label>
          <Input {...form.register('slug')} />
        </div>

        <div>
          <Label>Category</Label>
          <CategorySelect {...form.register('categoryId')} />
        </div>

        <div>
          <Label>Description</Label>
          <Textarea {...form.register('description')} />
        </div>

        <FeatureListBuilder
          features={form.watch('features')}
          onChange={(features) => form.setValue('features', features)}
        />
      </CardContent>
    </Card>
  );
}
```

**Reuse from ProductFormPage.tsx:**
- Category select dropdown (lines 650-670)
- Feature list builder (lines 900-950)
- Auto-slug generation logic (lines 400-420)

#### 2.3 Step 5: Variants

**File:** `apps/admin/src/components/product-wizard/steps/Step5_Variants.tsx`

Refactor variant management from ProductFormPage.tsx (lines 1000-1200).

```typescript
export function Step5_Variants({ form }: { form: UseFormReturn<WizardFormData> }) {
  const variants = form.watch('variants') || [];
  const [activeTab, setActiveTab] = useState('variant-0');

  const addVariant = () => {
    form.setValue('variants', [...variants, DEFAULT_VARIANT]);
    setActiveTab(`variant-${variants.length}`);
  };

  const removeVariant = (index: number) => {
    form.setValue('variants', variants.filter((_, i) => i !== index));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Product Variants</CardTitle>
        <Button onClick={addVariant}>Add Variant</Button>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            {variants.map((v, i) => (
              <TabsTrigger key={i} value={`variant-${i}`}>
                {v.name || `Variant ${i + 1}`}
              </TabsTrigger>
            ))}
          </TabsList>

          {variants.map((variant, index) => (
            <TabsContent key={index} value={`variant-${index}`}>
              <VariantForm
                variant={variant}
                index={index}
                form={form}
                onRemove={() => removeVariant(index)}
              />
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
```

**Reuse from ProductFormPage.tsx:**
- Tab-based variant switcher (lines 1050-1080)
- Image upload component (lines 1100-1150)
- Gallery image upload (lines 1150-1200)
- Variant form fields (lines 1000-1050)

**Testing:**
- Can create BLANKS product (Steps 1 → 2 → 5 → 6)
- Product preview updates when title changes
- Features list add/remove works
- Variants can be added/removed
- Draft saves and restores on refresh

---

### 3. Conditional Steps (Week 3)

**Goal:** Implement family-specific Steps 3 and 4

#### 3.1 Step 3: Upload Configuration

**File:** `apps/admin/src/components/product-wizard/steps/Step3_UploadConfig.tsx`

Visual constraint builder with customer preview.

```typescript
export function Step3_UploadConfig({ form }: { form: UseFormReturn<WizardFormData> }) {
  const family = form.watch('productFamily');

  // Preset defaults based on family
  useEffect(() => {
    const defaults = getUploadDefaults(family);
    form.setValue('uploadConstraints', defaults);
  }, [family]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload Requirements</CardTitle>
        <CardDescription>Configure file upload constraints</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Max File Size (MB)</Label>
            <Input type="number" {...form.register('uploadConstraints.maxFileSizeMB')} />
          </div>
          <div>
            <Label>Min DPI (0 = any)</Label>
            <Input type="number" {...form.register('uploadConstraints.minDPI')} />
          </div>
          <div>
            <Label>Min Width (px)</Label>
            <Input type="number" {...form.register('uploadConstraints.minWidth')} />
          </div>
          <div>
            <Label>Min Height (px)</Label>
            <Input type="number" {...form.register('uploadConstraints.minHeight')} />
          </div>
        </div>

        <div>
          <Label>Allowed Formats</Label>
          <div className="flex gap-2 mt-2">
            {['PNG', 'JPEG', 'PDF', 'SVG'].map(format => (
              <FileFormatBadge
                key={format}
                format={format}
                selected={form.watch('uploadConstraints.allowedFormats')?.includes(format)}
                onToggle={() => toggleFormat(format)}
              />
            ))}
          </div>
        </div>

        <Separator />

        <div>
          <h4 className="font-semibold mb-2">Customer Preview</h4>
          <ConstraintPreview constraints={form.watch('uploadConstraints')} />
        </div>
      </CardContent>
    </Card>
  );
}

function getUploadDefaults(family: ProductFamilyValue) {
  if (family === 'GANG_UPLOAD' || family === 'UV_GANG_UPLOAD') {
    return { maxFileSizeMB: 50, minDPI: 150, minWidth: 1200, minHeight: 1200, allowedFormats: ['PNG', 'JPEG', 'PDF'] };
  }
  if (family === 'GANG_BUILDER' || family === 'UV_GANG_BUILDER') {
    return { maxFileSizeMB: 20, minDPI: 0, minWidth: 800, minHeight: 800, allowedFormats: ['PNG', 'JPEG', 'SVG'] };
  }
  return { maxFileSizeMB: 20, minDPI: 0, minWidth: 800, minHeight: 800, allowedFormats: ['PNG', 'JPEG'] };
}
```

**File:** `apps/admin/src/components/product-wizard/upload-config/ConstraintPreview.tsx`

Shows what customers will see:

```typescript
export function ConstraintPreview({ constraints }: { constraints: UploadConstraints }) {
  return (
    <div className="border-2 border-dashed border-border rounded-lg p-6 bg-muted/30">
      <Upload size={48} className="mx-auto text-muted-foreground mb-3" />
      <p className="text-sm font-medium text-center mb-2">Upload Your Design</p>
      <div className="text-xs text-muted-foreground space-y-1">
        <p>• Max {constraints.maxFileSizeMB} MB</p>
        {constraints.minDPI > 0 && <p>• {constraints.minDPI} DPI or higher</p>}
        <p>• At least {constraints.minWidth}×{constraints.minHeight} pixels</p>
        <p>• {constraints.allowedFormats.join(', ')} format</p>
      </div>
    </div>
  );
}
```

#### 3.2 Step 4: Print Configuration

**File:** `apps/admin/src/components/product-wizard/steps/Step4_PrintConfig.tsx`

Print area selector + size tier selector.

```typescript
export function Step4_PrintConfig({ form }: { form: UseFormReturn<WizardFormData> }) {
  const { data: printAreas } = useQuery({
    queryKey: ['print-areas'],
    queryFn: () => api.get('/admin/print-areas').then(res => res.data),
  });

  const { data: sizeTiers } = useQuery({
    queryKey: ['size-tiers'],
    queryFn: () => api.get('/admin/size-tiers').then(res => res.data),
  });

  const selectedAreas = form.watch('printAreas') || [];

  const toggleArea = (areaId: string) => {
    const next = selectedAreas.includes(areaId)
      ? selectedAreas.filter(id => id !== areaId)
      : [...selectedAreas, areaId];
    form.setValue('printAreas', next);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Print Areas</CardTitle>
          <CardDescription>Select where customers can place designs</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {printAreas?.map(area => (
            <PrintAreaCard
              key={area.id}
              area={area}
              selected={selectedAreas.includes(area.id)}
              isDefault={form.watch('printAreaDefaults')?.[area.id]}
              onToggle={() => toggleArea(area.id)}
              onSetDefault={() => form.setValue('printAreaDefaults', { [area.id]: true })}
            />
          ))}

          <PrintAreaPreview selectedAreas={selectedAreas} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Size Tiers</CardTitle>
          <CardDescription>Select available print sizes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {sizeTiers?.map(tier => (
              <SizeTierCard
                key={tier.id}
                tier={tier}
                selected={form.watch('sizeTiers')?.includes(tier.id)}
                onToggle={() => toggleSizeTier(tier.id)}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Backend Endpoints Needed:**

**File:** `backend/src/routes/admin/print-areas.ts` (NEW)

```typescript
export async function adminPrintAreaRoutes(app: FastifyInstance) {
  app.addHook('preHandler', adminGuard);

  app.get('/', async (request, reply) => {
    const areas = await prisma.printArea.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    return areas;
  });
}
```

**File:** `backend/src/routes/admin/size-tiers.ts` (NEW)

```typescript
export async function adminSizeTierRoutes(app: FastifyInstance) {
  app.addHook('preHandler', adminGuard);

  app.get('/', async (request, reply) => {
    const tiers = await prisma.printSizeTier.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    return tiers;
  });
}
```

**File:** `backend/src/app.ts` (MODIFY)

```typescript
import { adminPrintAreaRoutes } from './routes/admin/print-areas';
import { adminSizeTierRoutes } from './routes/admin/size-tiers';

app.register(adminPrintAreaRoutes, { prefix: '/api/admin/print-areas' });
app.register(adminSizeTierRoutes, { prefix: '/api/admin/size-tiers' });
```

**Testing:**
- GANG_UPLOAD skips Step 4, shows Step 3
- BY_SIZE skips Step 3, shows Step 4
- GANG_BUILDER shows both Steps 3 and 4
- Step indicator adjusts (e.g., "5 of 5" for GANG_UPLOAD instead of "6 of 6")
- Upload constraints default to family presets
- Print area selection persists

---

### 4. Pricing & Review (Week 4)

**Goal:** Implement Step 6 with pricing calculator

#### 4.1 Pricing Calculator

**File:** `apps/admin/src/components/product-wizard/steps/Step6_Review.tsx`

```typescript
export function Step6_Review({ form }: { form: UseFormReturn<WizardFormData> }) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      await saveProduct(form.getValues());
      localStorage.removeItem('product-wizard-draft');
      navigate('/products');
    } catch (error) {
      toast.error('Failed to save product');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Product Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <ProductSummaryDisplay data={form.getValues()} />
        </CardContent>
      </Card>

      <PricingCalculator productFamily={form.watch('productFamily')} />

      <Card>
        <CardHeader>
          <CardTitle>Validation</CardTitle>
        </CardHeader>
        <CardContent>
          <ValidationChecklist errors={form.formState.errors} />
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button
          onClick={handleSave}
          disabled={!form.formState.isValid || isSubmitting}
          size="lg"
          className="flex-1"
        >
          {isSubmitting ? 'Saving...' : 'Create Product'}
        </Button>
        <Button
          onClick={() => form.setValue('isPublished', true) && handleSave()}
          disabled={!form.formState.isValid || isSubmitting}
          variant="default"
          size="lg"
        >
          Save & Publish
        </Button>
      </div>
    </div>
  );
}
```

**File:** `apps/admin/src/components/product-wizard/pricing-calculator/PricingCalculator.tsx`

```typescript
export function PricingCalculator({ productFamily }: { productFamily: ProductFamilyValue }) {
  const [sizeTier, setSizeTier] = useState('');
  const [printAreas, setPrintAreas] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [rush, setRush] = useState(false);

  const { data: breakdown } = useQuery({
    queryKey: ['pricing-preview', productFamily, sizeTier, printAreas, quantity, rush],
    queryFn: () => api.post('/admin/pricing/preview', {
      productFamily,
      sizeTierId: sizeTier,
      printAreaIds: printAreas,
      quantity,
      rushOrder: rush,
    }).then(res => res.data),
    enabled: !!sizeTier && printAreas.length > 0,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pricing Calculator</CardTitle>
        <CardDescription>Simulate pricing for different configurations</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Select value={sizeTier} onValueChange={setSizeTier}>
          <SelectTrigger>
            <SelectValue placeholder="Select size tier" />
          </SelectTrigger>
          <SelectContent>
            {/* Size tier options */}
          </SelectContent>
        </Select>

        <div className="flex gap-2">
          {/* Print area checkboxes */}
        </div>

        <Input
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
          placeholder="Quantity"
        />

        <Checkbox
          checked={rush}
          onCheckedChange={setRush}
          label="Rush Order (+$20)"
        />

        {breakdown && (
          <div className="border rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span>Base Print Fee ({breakdown.sizeTierName}):</span>
              <span>${breakdown.baseFee} × {quantity}</span>
            </div>
            {breakdown.extraSideFee > 0 && (
              <div className="flex justify-between text-sm">
                <span>Extra Side:</span>
                <span>${breakdown.extraSideFee} × {quantity}</span>
              </div>
            )}
            {breakdown.discountPercent > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Quantity Discount:</span>
                <span>-{breakdown.discountPercent}%</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between font-bold">
              <span>Total ({quantity} units):</span>
              <span className="text-primary">${breakdown.total}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

**Backend Endpoint:**

**File:** `backend/src/routes/admin/pricing.ts` (NEW)

```typescript
export async function adminPricingRoutes(app: FastifyInstance) {
  app.addHook('preHandler', adminGuard);

  app.post('/preview', async (request, reply) => {
    const schema = z.object({
      productFamily: productFamilySchema,
      sizeTierId: z.string().uuid(),
      printAreaIds: z.array(z.string().uuid()),
      quantity: z.number().int().min(1),
      rushOrder: z.boolean(),
    });

    const { sizeTierId, printAreaIds, quantity, rushOrder } = schema.parse(request.body);

    // Reuse existing pricing service
    const breakdown = await pricingService.calculateCustomizationPrice({
      printSizeTierId: sizeTierId,
      printAreaId: printAreaIds[0],
      quantity,
      rushOrder,
      extraSides: printAreaIds.length - 1,
    });

    return breakdown;
  });
}
```

**File:** `backend/src/app.ts` (MODIFY)

```typescript
import { adminPricingRoutes } from './routes/admin/pricing';

app.register(adminPricingRoutes, { prefix: '/api/admin/pricing' });
```

**Testing:**
- Pricing calculator shows correct breakdown
- Quantity discounts apply (11-50: 10% off)
- Extra side fees calculate correctly
- Rush fee adds $20
- Final save creates product successfully

---

### 5. Backend Integration (Week 5)

**Goal:** Save wizard data to database with all linked tables

#### 5.1 Update Product Create Endpoint

**File:** `backend/src/routes/admin/products.ts` (MODIFY)

Add support for print area links:

```typescript
// Inside POST '/' handler, after product creation:

// Save print area links if provided
if (payload.printAreas && payload.printAreas.length > 0) {
  await prisma.productPrintArea.createMany({
    data: payload.printAreas.map((areaId: string) => ({
      productId: product.id,
      printAreaId: areaId,
      isDefault: payload.printAreaDefaults?.[areaId] ?? false,
    })),
  });
}

// Save upload constraints if provided
if (payload.uploadConstraints) {
  // Option 1: Store in product metadata JSON
  await prisma.product.update({
    where: { id: product.id },
    data: {
      metadata: {
        ...product.metadata,
        uploadConstraints: payload.uploadConstraints,
      },
    },
  });

  // Option 2: Create upload_profiles record (if table exists)
  // const profile = await prisma.uploadProfile.create({
  //   data: payload.uploadConstraints,
  // });
  // await prisma.product.update({
  //   where: { id: product.id },
  //   data: { uploadProfileId: profile.id },
  // });
}
```

#### 5.2 Edit Mode Support

**File:** `apps/admin/src/hooks/useProductWizard.ts` (MODIFY)

Load existing product into wizard:

```typescript
export function useProductWizard(productId?: string) {
  // ... existing code

  useEffect(() => {
    if (!productId) {
      // Restore from localStorage draft
      const draft = localStorage.getItem('product-wizard-draft');
      if (draft) {
        form.reset(JSON.parse(draft));
      }
      return;
    }

    // Load existing product
    api.get(`/admin/products/${productId}`).then(({ data }) => {
      form.reset({
        productFamily: data.product_family,
        title: data.title,
        slug: data.slug,
        categoryId: data.category_id,
        description: data.description,
        subtitle: data.subtitle,
        basePrice: data.base_price.toString(),
        rating: data.rating.toString(),
        reviews: data.reviews.toString(),
        features: data.features || [],
        benefits: data.benefits || [],
        productDetails: data.product_details || [],
        isPublished: data.is_published,
        printAreas: data.product_print_areas?.map(pa => pa.print_area_id) || [],
        variants: data.variants || [],
        uploadConstraints: data.metadata?.uploadConstraints,
      });
    });
  }, [productId]);

  return { /* ... */ };
}
```

**Testing:**
- Create new product saves to database
- Print areas link correctly in `product_print_areas` table
- Upload constraints save in product metadata
- Edit existing product loads all fields correctly
- Variants save with images

---

### 6. Polish & Migration (Week 6)

**Goal:** Feature flag rollout and remove old form

#### 6.1 Feature Flag Rollout

**Week 6.1: Internal Testing**
- Set `VITE_FF_PRODUCT_WIZARD_V1=true` for admin team only
- Create 20 test products across all 7 families
- Monitor Sentry for errors
- Collect feedback via internal Slack channel

**Week 6.2: Gradual Rollout**
- Enable flag for 50% of admin users (A/B test)
- Compare metrics: creation time, success rate, completion rate
- Monitor error rates daily

**Week 6.3: Full Rollout**
- Enable flag for 100% of users
- Update default route `/products/new` → wizard
- Keep old form at `/products/new-legacy` for 2 weeks

**Week 8: Deprecation**
- Remove `ProductFormPage.tsx` (archive to git history)
- Remove feature flag code
- Clean up `/products/new-legacy` route

#### 6.2 Polish Tasks

**File:** `apps/admin/src/components/product-wizard/WizardContainer.tsx`

- Add loading skeletons while fetching product
- Add success toast after save
- Add keyboard shortcuts (Ctrl+S for draft save)
- Add exit confirmation dialog if unsaved changes

**File:** `apps/admin/src/components/product-wizard/shared/AutoSaveIndicator.tsx`

```typescript
export function AutoSaveIndicator({ isSaving }: { isSaving: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      {isSaving ? (
        <>
          <Loader2 size={14} className="animate-spin" />
          <span>Saving draft...</span>
        </>
      ) : (
        <>
          <CheckCircle2 size={14} className="text-green-600" />
          <span>Draft saved</span>
        </>
      )}
    </div>
  );
}
```

**Testing:**
- Performance: First render < 500ms
- Memory: < 100MB with 20 variants
- No console errors in production build
- Works on mobile (responsive layout)

---

## Critical Files to Modify

### New Files (15 files)

1. **apps/admin/src/hooks/useProductWizard.ts** - Core form state hook
2. **apps/admin/src/components/product-wizard/WizardContainer.tsx** - Main shell
3. **apps/admin/src/components/product-wizard/product-family/familyConfig.ts** - Family metadata
4. **apps/admin/src/components/product-wizard/steps/Step1_ProductFamily.tsx** - Family selector
5. **apps/admin/src/components/product-wizard/steps/Step2_BasicInfo.tsx** - Basic fields
6. **apps/admin/src/components/product-wizard/steps/Step3_UploadConfig.tsx** - Upload constraints
7. **apps/admin/src/components/product-wizard/steps/Step4_PrintConfig.tsx** - Print areas
8. **apps/admin/src/components/product-wizard/steps/Step5_Variants.tsx** - Variants
9. **apps/admin/src/components/product-wizard/steps/Step6_Review.tsx** - Summary + pricing
10. **apps/admin/src/components/product-wizard/shared/ProductPreview.tsx** - Live preview
11. **apps/admin/src/pages/ProductWizardPage.tsx** - Wizard page
12. **backend/src/routes/admin/print-areas.ts** - Print areas API
13. **backend/src/routes/admin/size-tiers.ts** - Size tiers API
14. **backend/src/routes/admin/pricing.ts** - Pricing preview API
15. **apps/admin/.env** - Add `VITE_FF_PRODUCT_WIZARD_V1=false`

### Modified Files (3 files)

1. **apps/admin/src/App.tsx** - Add wizard route with feature flag
2. **backend/src/app.ts** - Register new admin routes
3. **backend/src/routes/admin/products.ts** - Add print area link creation

### Files to Refactor From (1 file)

1. **apps/admin/src/pages/ProductFormPage.tsx** - Extract variant management, image upload, feature builder components

---

## Verification & Testing

### Manual Testing Checklist

**BY_SIZE Product (5 steps):**
- [ ] Step 1: Select "DTF by Size"
- [ ] Step 2: Fill title, slug, category, description
- [ ] Step 4: Select "Front" and "Back" print areas, select "M" size tier
- [ ] Step 5: Add 2 variants with images
- [ ] Step 6: Verify pricing calculator works, click "Create Product"
- [ ] Product appears in product list with correct family
- [ ] Product has 2 print areas linked in database
- [ ] Customer-facing product page shows print area selector

**GANG_UPLOAD Product (5 steps):**
- [ ] Step 1: Select "DTF Gang Sheet Upload"
- [ ] Step 2: Fill basic info
- [ ] Step 3: Verify defaults (50MB, 150 DPI, PNG/JPEG/PDF), adjust if needed
- [ ] Step 5: Add variant
- [ ] Step 6: Create product
- [ ] Product metadata contains uploadConstraints
- [ ] Customer-facing upload page shows correct constraints

**BLANKS Product (4 steps):**
- [ ] Step 1: Select "Blanks"
- [ ] Step 2: Fill basic info
- [ ] Step 5: Add variants (no customization)
- [ ] Step 6: Create product
- [ ] Product has no print areas, no upload constraints

**Edit Mode:**
- [ ] Edit existing BY_SIZE product
- [ ] All fields pre-populate correctly
- [ ] Print areas pre-selected
- [ ] Variants load with images
- [ ] Save updates product

**Error Handling:**
- [ ] Leave title empty, click Next → blocked with error
- [ ] Upload constraint: set max size to 0 → validation error
- [ ] Print config: select no areas → warning message
- [ ] Final save with network error → error toast, can retry

**Performance:**
- [ ] First render < 500ms (measured in DevTools)
- [ ] Step transition < 200ms
- [ ] Auto-save debounce 1 second
- [ ] 20 variants: no lag, < 100MB memory

### Automated Tests

**Unit Tests:**
```typescript
// apps/admin/src/hooks/__tests__/useProductWizard.test.ts
describe('useProductWizard', () => {
  it('should calculate visible steps for BY_SIZE', () => {
    const { visibleSteps } = renderHook(() => useProductWizard());
    expect(visibleSteps).toEqual([1, 2, 4, 5, 6]); // Skips Step 3
  });

  it('should save draft to localStorage', async () => {
    const { form } = renderHook(() => useProductWizard());
    form.setValue('title', 'Test Product');
    await waitFor(() => {
      const draft = localStorage.getItem('product-wizard-draft');
      expect(JSON.parse(draft).title).toBe('Test Product');
    });
  });
});
```

**Integration Tests:**
```typescript
// apps/admin/src/components/product-wizard/__tests__/WizardContainer.test.tsx
describe('WizardContainer', () => {
  it('should navigate through all steps for GANG_UPLOAD', async () => {
    render(<WizardContainer />);

    // Step 1
    fireEvent.click(screen.getByText('DTF Gang Sheet Upload'));
    fireEvent.click(screen.getByText('Next'));

    // Step 2
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Test' } });
    fireEvent.click(screen.getByText('Next'));

    // Step 3
    expect(screen.getByText('Upload Requirements')).toBeInTheDocument();
    // ... continue through steps
  });
});
```

### Database Verification

After creating a product, verify database records:

```sql
-- Product created
SELECT * FROM products WHERE title = 'Test Product';

-- Print areas linked
SELECT * FROM product_print_areas WHERE product_id = '<product-id>';

-- Variants created
SELECT * FROM product_variants WHERE product_id = '<product-id>';

-- Upload constraints in metadata
SELECT metadata FROM products WHERE id = '<product-id>';
-- Should contain: {"uploadConstraints": {"maxFileSizeMB": 50, ...}}
```

---

## Success Metrics

**Usability:**
- Product creation completion rate: > 95% (vs. current ~80%)
- Average creation time: < 3 minutes (vs. current 5+ minutes)
- User satisfaction: > 4.5/5 (internal survey)

**Technical:**
- Form validation error rate: < 5%
- Auto-save success rate: > 99%
- Zero data loss incidents
- API error rate: < 1%

**Business:**
- Products created per day: +50% increase
- Products with complete metadata: +30%
- Support tickets re: product creation: -70%

---

## Rollback Plan

If critical bugs emerge during rollout:

1. **Immediate:** Set `VITE_FF_PRODUCT_WIZARD_V1=false` → all users revert to old form
2. **24 hours:** Fix critical bugs in wizard
3. **48 hours:** Re-enable flag for 10% of users (canary)
4. **1 week:** Gradual re-rollout to 100%

**Rollback triggers:**
- Product creation success rate < 95%
- Average creation time > 5 minutes
- User complaints > 10 per day
- Data loss incidents > 0

**Data Safety:**
- Old form remains functional for 2 weeks after full rollout
- No database schema changes (additive only)
- Products created in wizard work with old form for editing
