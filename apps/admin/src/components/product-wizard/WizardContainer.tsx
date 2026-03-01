import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProductWizard } from '@/hooks/useProductWizard';
import { WizardStepIndicator } from './WizardStepIndicator';
import { WizardNavigation } from './WizardNavigation';
import { ProductPreview } from './shared/ProductPreview';
import { ValidationSummary } from './shared/ValidationSummary';
import { AutoSaveIndicator } from './shared/AutoSaveIndicator';
import { api } from '@/lib/api';
import { toast } from 'sonner';

// Import step components
import { Step1_ProductFamily } from './steps/Step1_ProductFamily';
import { Step2_BasicInfo } from './steps/Step2_BasicInfo';
import { Step3_UploadConfig } from './steps/Step3_UploadConfig';
import { Step4_PrintConfig } from './steps/Step4_PrintConfig';
import { Step5_Variants } from './steps/Step5_Variants';
import { Step6_Review } from './steps/Step6_Review';

type WizardContainerProps = {
  productId?: string;
};

function normalizeTemplateForSubmit(
  customizationTemplateV1: any,
  printAreas: string[] = [],
  printAreaDefaults?: Record<string, boolean>
) {
  if (!customizationTemplateV1 || !Array.isArray(customizationTemplateV1.presets)) {
    return customizationTemplateV1;
  }

  const defaultAreaId =
    Object.entries(printAreaDefaults || {}).find(([, isDefault]) => Boolean(isDefault))?.[0]
    || printAreas[0]
    || null;

  if (!defaultAreaId) {
    return customizationTemplateV1;
  }

  const normalizedPresets = customizationTemplateV1.presets.map((preset: any) => ({
    ...preset,
    printAreaId: preset?.printAreaId || defaultAreaId,
  }));

  return {
    ...customizationTemplateV1,
    presets: normalizedPresets,
  };
}

export function WizardContainer({ productId }: WizardContainerProps) {
  const isEditMode = Boolean(
    productId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(productId)
  );
  const navigate = useNavigate();
  const {
    form,
    currentStep,
    completedSteps,
    visibleSteps,
    currentStepLabel,
    goToStep,
    nextStep,
    prevStep,
    clearDraft,
    isSaving,
  } = useProductWizard(productId);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Render the appropriate step component
  const renderStep = () => {
    const actualStepNumber = visibleSteps[currentStep - 1];

    switch (actualStepNumber) {
      case 1:
        return <Step1_ProductFamily form={form} />;
      case 2:
        return <Step2_BasicInfo form={form} />;
      case 3:
        return <Step3_UploadConfig form={form} />;
      case 4:
        return <Step4_PrintConfig form={form} />;
      case 5:
        return <Step5_Variants form={form} />;
      case 6:
        return <Step6_Review form={form} isEditMode={isEditMode} />;
      default:
        return <div>Unknown step</div>;
    }
  };

  // Handle product save
  const handleSave = async () => {
    setIsSubmitting(true);

    try {
      const values = form.getValues();

      // Upload variant images first if needed
      const variantsWithImages = await uploadVariantImages(values.variants);
      const normalizedTemplate = normalizeTemplateForSubmit(
        values.customizationTemplateV1,
        values.printAreas,
        values.printAreaDefaults
      );

      // Prepare product data
      const productData = {
        title: values.title,
        slug: values.slug,
        categoryId: values.categoryId,
        description: values.description || '',
        subtitle: values.subtitle || '',
        basePrice: values.basePrice,
        rating: values.rating ? parseFloat(values.rating) : 0,
        reviews: values.reviews ? parseInt(values.reviews, 10) : 0,
        features: values.features,
        benefits: values.benefits,
        productDetails: values.productDetails,
        is_published: values.isPublished,
        product_family: values.productFamily,
        variants: variantsWithImages,
        printAreas: values.printAreas,
        printAreaDefaults: values.printAreaDefaults,
        uploadConstraints: values.uploadConstraints,
        customizationTemplateV1: normalizedTemplate,
      };

      if (productId) {
        // Update existing product
        await api.put(`/admin/products/${productId}`, productData);
        toast.success('Product updated successfully');
      } else {
        // Create new product
        await api.post('/admin/products', productData);
        toast.success('Product created successfully');
      }

      // Clear draft and navigate
      clearDraft();
      navigate('/products');
    } catch (error: any) {
      console.error('Failed to save product:', error);
      const apiMessage = error.response?.data?.message
        || error.response?.data?.error
        || error.response?.data?.issues?.[0]?.message;
      toast.error(apiMessage || 'Failed to save product');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Upload variant images
  const uploadVariantImages = async (variants: any[]) => {
    return Promise.all(
      variants.map(async (variant) => {
        let imagePath = variant.imagePath;
        let galleryPaths = variant.galleryPaths || [];

        // Upload main image if pending
        if (variant.pendingImage) {
          const formData = new FormData();
          formData.append('file', variant.pendingImage);
          const { data } = await api.post('/admin/upload/product-image', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          imagePath = data.url;
        }

        // Upload gallery images if pending
        if (variant.pendingGalleryImages && variant.pendingGalleryImages.length > 0) {
          const uploadedGallery = await Promise.all(
            variant.pendingGalleryImages.map(async (file: File) => {
              const formData = new FormData();
              formData.append('file', file);
              const { data } = await api.post('/admin/upload/product-image', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
              });
              return data.url;
            })
          );
          galleryPaths = [...galleryPaths, ...uploadedGallery];
        }

        return {
          ...variant,
          imagePath,
          galleryPaths,
          price: parseFloat(variant.price),
          originalPrice: variant.originalPrice ? parseFloat(variant.originalPrice) : undefined,
          stock: parseInt(variant.stock, 10),
          pendingImage: undefined,
          pendingGalleryImages: undefined,
          previewUrl: undefined,
          galleryPreviewUrls: undefined,
        };
      })
    );
  };

  return (
    <div className="container mx-auto py-8 max-w-7xl">
      <WizardStepIndicator
        title={isEditMode ? 'Edit Product' : 'Create Product'}
        currentStep={currentStep}
        totalSteps={visibleSteps.length}
        completedSteps={completedSteps}
        visibleSteps={visibleSteps}
        onStepClick={goToStep}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <div className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">{currentStepLabel}</h2>
            <AutoSaveIndicator isSaving={isSaving} />
          </div>

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
        onNext={nextStep}
        onPrev={prevStep}
        onSave={currentStep === visibleSteps.length ? handleSave : undefined}
        isValid={Object.keys(form.formState.errors).length === 0}
        isSubmitting={isSubmitting}
        saveLabel={isEditMode ? 'Update Product' : 'Create Product'}
      />
    </div>
  );
}

