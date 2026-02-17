import { useForm, UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState, useEffect, useMemo } from 'react';
import { z } from 'zod';
import { ProductFamilyValue, calculateVisibleSteps, getStepLabel } from '@/components/product-wizard/product-family/familyConfig';
import { api } from '@/lib/api';

// Upload constraints schema
const uploadConstraintsSchema = z.object({
  maxFileSizeMB: z.number().min(1).max(100),
  minDPI: z.number().min(0).max(600).optional(),
  minWidth: z.number().min(1),
  minHeight: z.number().min(1),
  allowedFormats: z.array(z.string()),
});

// Product variant schema
const productVariantSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Variant name is required'),
  sku: z.string().min(1, 'SKU is required'),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Invalid price format'),
  originalPrice: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Invalid price format').optional(),
  sizes: z.array(z.string()).default([]),
  imagePath: z.string().default(''),
  galleryPaths: z.array(z.string()).default([]),
  stock: z.string().regex(/^\d+$/, 'Stock must be a number').default('0'),
  isAvailable: z.boolean().default(true),
  sortOrder: z.number().default(0),
  pendingImage: z.any().optional(),
  previewUrl: z.string().optional(),
  pendingGalleryImages: z.array(z.any()).optional(),
  galleryPreviewUrls: z.array(z.string()).optional(),
});

// Main wizard schema
const productWizardSchema = z.object({
  // Step 1
  productFamily: z.enum([
    'BY_SIZE',
    'GANG_UPLOAD',
    'GANG_BUILDER',
    'BLANKS',
    'UV_BY_SIZE',
    'UV_GANG_UPLOAD',
    'UV_GANG_BUILDER',
  ]),

  // Step 2
  title: z.string().min(1, 'Title is required'),
  slug: z.string().min(1, 'Slug is required').regex(/^[a-z0-9-]+$/, 'Slug must be lowercase with hyphens'),
  categoryId: z.string().uuid('Please select a category'),
  description: z.string().optional(),
  subtitle: z.string().optional(),
  basePrice: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Invalid price format').default('0'),
  rating: z.string().optional(),
  reviews: z.string().optional(),
  features: z.array(z.string()).default([]),
  benefits: z.array(z.string()).default([]),
  productDetails: z.array(z.string()).default([]),
  isPublished: z.boolean().default(false),

  // Step 3 (conditional)
  uploadConstraints: uploadConstraintsSchema.optional(),

  // Step 4 (conditional)
  printAreas: z.array(z.string()).default([]),
  printAreaDefaults: z.record(z.string(), z.boolean()).optional(),
  sizeTiers: z.array(z.string()).default([]),

  // Step 5
  variants: z.array(productVariantSchema).min(1, 'At least one variant is required'),

  // Step 6 (computed)
  pricingPreview: z.any().optional(),
});

export type WizardFormData = z.infer<typeof productWizardSchema>;
export type ProductVariant = z.infer<typeof productVariantSchema>;
export type UploadConstraints = z.infer<typeof uploadConstraintsSchema>;

const DEFAULT_WIZARD_VALUES: Partial<WizardFormData> = {
  productFamily: 'BY_SIZE',
  title: '',
  slug: '',
  categoryId: '',
  description: '',
  subtitle: '',
  basePrice: '0',
  rating: '0',
  reviews: '0',
  features: [],
  benefits: [],
  productDetails: [],
  isPublished: false,
  printAreas: [],
  sizeTiers: [],
  variants: [
    {
      name: '',
      sku: '',
      price: '0',
      sizes: [],
      imagePath: '',
      galleryPaths: [],
      stock: '0',
      isAvailable: true,
      sortOrder: 0,
    },
  ],
};

const DRAFT_STORAGE_KEY = 'product-wizard-draft';

export function useProductWizard(productId?: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form = useForm<WizardFormData>({
    resolver: zodResolver(productWizardSchema) as any,
    mode: 'onChange',
    defaultValues: DEFAULT_WIZARD_VALUES as WizardFormData,
  });

  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  // Calculate visible steps based on product family
  const productFamily = form.watch('productFamily');
  const visibleSteps = useMemo(() => {
    return calculateVisibleSteps(productFamily);
  }, [productFamily]);

  // Auto-save to localStorage (debounced)
  useEffect(() => {
    if (productId) return; // Don't auto-save when editing existing product

    const timeoutId = setTimeout(() => {
      const values = form.getValues();
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(values));
      setIsSaving(true);
      setTimeout(() => setIsSaving(false), 500);
    }, 1000);

    const subscription = form.watch(() => {
      // This triggers on every form change
    });

    return () => {
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, [form, productId]);

  // Load existing product or restore draft
  useEffect(() => {
    // Only load if productId is a valid UUID (not a route segment like "new-wizard")
    const isUUID = productId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(productId);

    if (isUUID) {
      // Load existing product
      api
        .get(`/admin/products/${productId}`)
        .then(({ data }) => {
          const product = data.product;
          form.reset({
            productFamily: product.product_family as ProductFamilyValue,
            title: product.title,
            slug: product.slug,
            categoryId: product.category_id,
            description: product.description || '',
            subtitle: product.subtitle || '',
            basePrice: product.base_price?.toString() || '0',
            rating: product.rating?.toString() || '0',
            reviews: product.reviews?.toString() || '0',
            features: product.features || [],
            benefits: product.benefits || [],
            productDetails: product.product_details || [],
            isPublished: product.is_published || false,
            printAreas: product.product_print_areas?.map((pa: any) => pa.print_area_id) || [],
            printAreaDefaults: product.product_print_areas?.reduce((acc: any, pa: any) => {
              if (pa.is_default) acc[pa.print_area_id] = true;
              return acc;
            }, {}),
            variants: product.variants || [],
            uploadConstraints: product.metadata?.uploadConstraints,
          });
        })
        .catch((error) => {
          console.error('Failed to load product:', error);
        });
    } else {
      // Restore from localStorage draft
      const draft = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (draft) {
        try {
          const parsed = JSON.parse(draft);
          form.reset(parsed);
        } catch (error) {
          console.error('Failed to restore draft:', error);
        }
      }
    }
  }, [productId, form]);

  // Get fields to validate for a specific step
  const getStepFields = (step: number): (keyof WizardFormData)[] => {
    switch (step) {
      case 1:
        return ['productFamily'];
      case 2:
        return ['title', 'slug', 'categoryId'];
      case 3:
        return ['uploadConstraints'];
      case 4:
        return ['printAreas', 'sizeTiers'];
      case 5:
        return ['variants'];
      case 6:
        return [];
      default:
        return [];
    }
  };

  // Validate specific step
  const validateStep = async (step: number): Promise<boolean> => {
    const fields = getStepFields(step);
    if (fields.length === 0) return true;

    const result = await form.trigger(fields);
    return result;
  };

  // Navigate to a specific step
  const goToStep = async (targetStep: number): Promise<boolean> => {
    // Check if target step is valid
    if (targetStep < 1 || targetStep > visibleSteps.length) {
      return false;
    }

    // Validate current step before moving forward
    if (targetStep > currentStep) {
      const isValid = await validateStep(currentStep);
      if (!isValid) {
        return false;
      }
      setCompletedSteps((prev) => new Set([...prev, currentStep]));
    }

    setCurrentStep(targetStep);
    return true;
  };

  // Go to next step
  const nextStep = async (): Promise<boolean> => {
    return goToStep(currentStep + 1);
  };

  // Go to previous step
  const prevStep = (): void => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Clear draft
  const clearDraft = (): void => {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
  };

  // Get current step label
  const currentStepLabel = useMemo(() => {
    const actualStepNumber = visibleSteps[currentStep - 1];
    return getStepLabel(actualStepNumber);
  }, [currentStep, visibleSteps]);

  return {
    form,
    currentStep,
    setCurrentStep,
    completedSteps,
    visibleSteps,
    currentStepLabel,
    validateStep,
    goToStep,
    nextStep,
    prevStep,
    clearDraft,
    isSaving,
  };
}

export type UseProductWizardReturn = ReturnType<typeof useProductWizard>;
