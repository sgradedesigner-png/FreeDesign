import { useState } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { WizardFormData, ProductVariant } from '@/hooks/useProductWizard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, X, Trash2, Upload as UploadIcon, ImageIcon } from 'lucide-react';

type Step5_VariantsProps = {
  form: UseFormReturn<WizardFormData>;
};

const DEFAULT_VARIANT: ProductVariant = {
  name: '',
  sku: '',
  price: '0',
  sizes: [],
  imagePath: '',
  galleryPaths: [],
  stock: '0',
  isAvailable: true,
  sortOrder: 0,
};

export function Step5_Variants({ form }: Step5_VariantsProps) {
  const variants = form.watch('variants') || [];
  const [activeTab, setActiveTab] = useState('variant-0');
  const [sizeInputs, setSizeInputs] = useState<Record<number, string>>({});

  const addVariant = () => {
    const newVariants = [
      ...variants,
      { ...DEFAULT_VARIANT, sortOrder: variants.length },
    ];
    form.setValue('variants', newVariants, { shouldValidate: true });
    setActiveTab(`variant-${variants.length}`);
  };

  const deleteVariant = (index: number) => {
    const newVariants = variants.filter((_, i) => i !== index);
    form.setValue('variants', newVariants, { shouldValidate: true });
    if (index > 0) {
      setActiveTab(`variant-${index - 1}`);
    } else if (newVariants.length > 0) {
      setActiveTab('variant-0');
    }
  };

  const updateVariant = (index: number, field: keyof ProductVariant, value: any) => {
    const newVariants = [...variants];
    newVariants[index] = { ...newVariants[index], [field]: value };
    form.setValue('variants', newVariants, { shouldValidate: true });
  };

  const addSize = (variantIndex: number) => {
    const sizeInput = sizeInputs[variantIndex]?.trim();
    if (!sizeInput) return;

    const variant = variants[variantIndex];
    if (!variant.sizes.includes(sizeInput)) {
      updateVariant(variantIndex, 'sizes', [...variant.sizes, sizeInput]);
    }
    setSizeInputs({ ...sizeInputs, [variantIndex]: '' });
  };

  const removeSize = (variantIndex: number, sizeIndex: number) => {
    const variant = variants[variantIndex];
    const newSizes = variant.sizes.filter((_, i) => i !== sizeIndex);
    updateVariant(variantIndex, 'sizes', newSizes);
  };

  const handleImageSelect = (variantIndex: number, file: File) => {
    const previewUrl = URL.createObjectURL(file);
    const variant = variants[variantIndex];
    updateVariant(variantIndex, 'pendingImage', file);
    updateVariant(variantIndex, 'previewUrl', previewUrl);
  };

  const handleGalleryImagesSelect = (variantIndex: number, files: FileList) => {
    const variant = variants[variantIndex];
    const newFiles = Array.from(files);
    const newPreviewUrls = newFiles.map((file) => URL.createObjectURL(file));

    updateVariant(variantIndex, 'pendingGalleryImages', [
      ...(variant.pendingGalleryImages || []),
      ...newFiles,
    ]);
    updateVariant(variantIndex, 'galleryPreviewUrls', [
      ...(variant.galleryPreviewUrls || []),
      ...newPreviewUrls,
    ]);
  };

  const removeGalleryImage = (variantIndex: number, imageIndex: number) => {
    const variant = variants[variantIndex];
    const newGalleryPaths = variant.galleryPaths.filter((_, i) => i !== imageIndex);
    updateVariant(variantIndex, 'galleryPaths', newGalleryPaths);
  };

  const removePendingGalleryImage = (variantIndex: number, imageIndex: number) => {
    const variant = variants[variantIndex];
    const newPendingImages = (variant.pendingGalleryImages || []).filter((_, i) => i !== imageIndex);
    const newPreviewUrls = (variant.galleryPreviewUrls || []).filter((_, i) => i !== imageIndex);
    updateVariant(variantIndex, 'pendingGalleryImages', newPendingImages);
    updateVariant(variantIndex, 'galleryPreviewUrls', newPreviewUrls);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Product Variants</CardTitle>
            <CardDescription>Colors, sizes, and pricing options</CardDescription>
          </div>
          <Button type="button" onClick={addVariant} variant="outline" size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Add Variant
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full justify-start gap-2 overflow-x-auto whitespace-nowrap">
            {variants.map((variant, index) => (
              <TabsTrigger
                key={index}
                value={`variant-${index}`}
                className="max-w-[220px] flex-none truncate"
              >
                {variant.name || `Variant ${index + 1}`}
              </TabsTrigger>
            ))}
          </TabsList>

          {variants.map((variant, index) => (
            <TabsContent key={index} value={`variant-${index}`} className="space-y-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2 space-y-2">
                  <Label>Variant Name *</Label>
                  <Input
                    value={variant.name}
                    onChange={(e) => updateVariant(index, 'name', e.target.value)}
                    placeholder="e.g., Black/White, Ocean Blue"
                  />
                </div>

                <div className="space-y-2">
                  <Label>SKU *</Label>
                  <Input
                    value={variant.sku}
                    onChange={(e) => updateVariant(index, 'sku', e.target.value)}
                    placeholder="PROD-001"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Stock Quantity</Label>
                  <Input
                    type="number"
                    value={variant.stock}
                    onChange={(e) => updateVariant(index, 'stock', e.target.value)}
                    placeholder="0"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Price *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={variant.price}
                    onChange={(e) => updateVariant(index, 'price', e.target.value)}
                    placeholder="0.00"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Original Price</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={variant.originalPrice || ''}
                    onChange={(e) => updateVariant(index, 'originalPrice', e.target.value)}
                    placeholder="0.00"
                  />
                </div>

                <div className="md:col-span-2 space-y-2">
                  <Label>Available Sizes</Label>
                  <div className="flex gap-2">
                    <Input
                      value={sizeInputs[index] || ''}
                      onChange={(e) => setSizeInputs({ ...sizeInputs, [index]: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addSize(index);
                        }
                      }}
                      placeholder="Enter size (e.g., 42, M, XL)"
                    />
                    <Button type="button" onClick={() => addSize(index)} variant="secondary">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  {variant.sizes.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {variant.sizes.map((size, sizeIndex) => (
                        <Badge key={sizeIndex} variant="outline" className="gap-1">
                          {size}
                          <button
                            type="button"
                            onClick={() => removeSize(index, sizeIndex)}
                            className="ml-1 hover:text-destructive"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <div className="md:col-span-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={variant.isAvailable}
                      onChange={(e) => updateVariant(index, 'isAvailable', e.target.checked)}
                      className="rounded"
                    />
                    <Label className="cursor-pointer">Available for sale</Label>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Media Section */}
              <div className="space-y-4">
                <h4 className="font-semibold flex items-center gap-2">
                  <ImageIcon className="w-4 h-4" />
                  Media
                </h4>

                {/* Thumbnail */}
                <div className="space-y-2">
                  <Label>Thumbnail Image</Label>
                  <div className="flex items-center gap-4">
                    {(variant.previewUrl || variant.imagePath) && (
                      <img
                        src={variant.previewUrl || variant.imagePath}
                        alt="Thumbnail"
                        className="w-20 h-20 object-cover rounded-lg border"
                      />
                    )}
                    <label className="flex-1">
                      <div className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary transition-colors">
                        <UploadIcon className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Click to upload thumbnail</p>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          if (e.target.files?.[0]) {
                            handleImageSelect(index, e.target.files[0]);
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                {/* Gallery */}
                <div className="space-y-2">
                  <Label>Gallery Images</Label>
                  <label>
                    <div className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary transition-colors">
                      <UploadIcon className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Click to add gallery images</p>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          handleGalleryImagesSelect(index, e.target.files);
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                  {(variant.galleryPaths.length > 0 || variant.galleryPreviewUrls) && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                      {variant.galleryPaths.map((path, gIndex) => (
                        <div key={`existing-${gIndex}`} className="relative group">
                          <img
                            src={path}
                            alt={`Gallery ${gIndex + 1}`}
                            className="w-full h-20 object-cover rounded-lg border"
                          />
                          <button
                            type="button"
                            onClick={() => removeGalleryImage(index, gIndex)}
                            className="absolute top-1 right-1 p-1 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      {variant.galleryPreviewUrls?.map((url, pIndex) => (
                        <div key={`pending-${pIndex}`} className="relative group">
                          <img
                            src={url}
                            alt={`New ${pIndex + 1}`}
                            className="w-full h-20 object-cover rounded-lg border border-primary"
                          />
                          <button
                            type="button"
                            onClick={() => removePendingGalleryImage(index, pIndex)}
                            className="absolute top-1 right-1 p-1 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {variants.length > 1 && (
                <>
                  <Separator />
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => deleteVariant(index)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete This Variant
                  </Button>
                </>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
