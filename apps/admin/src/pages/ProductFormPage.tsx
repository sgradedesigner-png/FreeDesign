import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Loader2, Upload, X, Plus, Trash2 } from 'lucide-react';

type Category = {
  id: string;
  name: string;
  slug: string;
};

type ProductVariant = {
  id?: string; // Only for edit mode
  name: string;
  sku: string;
  price: string;
  originalPrice?: string;
  sizes: string[];
  imagePath: string;
  galleryPaths: string[];
  stock: string;
  isAvailable: boolean;
  sortOrder: number;
  // For file uploads
  pendingImage?: File;
  previewUrl?: string;
  pendingGalleryImages?: File[];
  galleryPreviewUrls?: string[];
};

const productSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  slug: z.string().min(1, 'Slug is required').regex(/^[a-z0-9-]+$/, 'Slug must be lowercase with hyphens'),
  description: z.string().optional(),
  basePrice: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Invalid price format').optional(),
  categoryId: z.string().uuid('Please select a category'),
  rating: z.string().optional(),
  reviews: z.string().optional(),
});

type ProductFormData = z.infer<typeof productSchema>;

export default function ProductFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditMode = !!id;

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(isEditMode);
  const [submitting, setSubmitting] = useState(false);
  const [activeVariantTab, setActiveVariantTab] = useState('variant-0');
  const [variants, setVariants] = useState<ProductVariant[]>([
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
  ]);
  const [features, setFeatures] = useState<string[]>([]);
  const [featureInput, setFeatureInput] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      title: '',
      slug: '',
      description: '',
      basePrice: '0',
      categoryId: '',
      rating: '0',
      reviews: '0',
    },
  });

  const categoryId = watch('categoryId');
  const titleValue = watch('title');

  // Helper to upload a single file to R2
  const uploadFileToR2 = async (file: File, productId: string): Promise<string> => {
    console.log('[ProductForm] Uploading file:', file.name, 'for product:', productId);

    // Step 1: Get presigned URL
    const presignedResponse = await api.post('/admin/upload/presigned-url', {
      filename: file.name,
      contentType: file.type,
      productId: productId,
    });

    const { uploadUrl, publicUrl } = presignedResponse.data;

    // Step 2: Upload to R2
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type,
      },
    });

    if (!uploadResponse.ok) {
      throw new Error(`R2 upload failed: ${uploadResponse.status}`);
    }

    console.log('[ProductForm] File uploaded successfully:', publicUrl);
    return publicUrl;
  };

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const { data } = await api.get<Category[]>('/admin/categories');
        setCategories(data);
      } catch (error) {
        console.error('Failed to fetch categories:', error);
      }
    };

    fetchCategories();
  }, []);

  useEffect(() => {
    if (!isEditMode) return;

    const fetchProduct = async () => {
      try {
        setLoading(true);
        const { data } = await api.get(`/admin/products/${id}`);
        setValue('title', data.title);
        setValue('slug', data.slug);
        setValue('description', data.description || '');
        setValue('basePrice', String(data.basePrice || 0));
        setValue('categoryId', data.categoryId);
        setValue('rating', String(data.rating || 0));
        setValue('reviews', String(data.reviews || 0));
        setFeatures(data.features || []);

        // Load variants
        if (data.variants && data.variants.length > 0) {
          setVariants(data.variants.map((v: any) => ({
            id: v.id,
            name: v.name,
            sku: v.sku,
            price: String(v.price),
            originalPrice: v.originalPrice ? String(v.originalPrice) : '',
            sizes: v.sizes || [],
            imagePath: v.imagePath || '',
            galleryPaths: v.galleryPaths || [],
            stock: String(v.stock || 0),
            isAvailable: v.isAvailable !== false,
            sortOrder: v.sortOrder || 0,
          })));
        }
      } catch (error) {
        console.error('Failed to fetch product:', error);
        navigate('/products');
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id, isEditMode, navigate, setValue]);

  // Auto-generate slug from title (only in create mode)
  useEffect(() => {
    if (titleValue && !isEditMode) {
      const slug = titleValue
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
      setValue('slug', slug);
    }
  }, [titleValue, isEditMode, setValue]);

  const addVariant = () => {
    setVariants([
      ...variants,
      {
        name: '',
        sku: '',
        price: '0',
        sizes: [],
        imagePath: '',
        galleryPaths: [],
        stock: '0',
        isAvailable: true,
        sortOrder: variants.length,
      },
    ]);
  };

  const removeVariant = (index: number) => {
    if (variants.length === 1) {
      alert('At least one variant is required');
      return;
    }
    setVariants(variants.filter((_, i) => i !== index));
  };

  const updateVariant = (index: number, field: keyof ProductVariant, value: any) => {
    const updated = [...variants];
    (updated[index] as any)[field] = value;
    setVariants(updated);
  };

  const handleVariantImageSelect = (index: number, file: File) => {
    const updated = [...variants];
    updated[index].pendingImage = file;
    updated[index].previewUrl = URL.createObjectURL(file);
    setVariants(updated);
  };

  const handleVariantGalleryImagesSelect = (index: number, files: FileList) => {
    const updated = [...variants];
    const newFiles = Array.from(files);
    const existingFiles = updated[index].pendingGalleryImages || [];
    updated[index].pendingGalleryImages = [...existingFiles, ...newFiles];

    const newPreviewUrls = newFiles.map(f => URL.createObjectURL(f));
    const existingPreviewUrls = updated[index].galleryPreviewUrls || [];
    updated[index].galleryPreviewUrls = [...existingPreviewUrls, ...newPreviewUrls];

    setVariants(updated);
  };

  const removeVariantGalleryImage = (variantIndex: number, imageIndex: number) => {
    const updated = [...variants];
    if (updated[variantIndex].pendingGalleryImages) {
      updated[variantIndex].pendingGalleryImages = updated[variantIndex].pendingGalleryImages!.filter((_, i) => i !== imageIndex);
    }
    if (updated[variantIndex].galleryPreviewUrls) {
      updated[variantIndex].galleryPreviewUrls = updated[variantIndex].galleryPreviewUrls!.filter((_, i) => i !== imageIndex);
    }
    if (updated[variantIndex].galleryPaths) {
      updated[variantIndex].galleryPaths = updated[variantIndex].galleryPaths.filter((_, i) => i !== imageIndex);
    }
    setVariants(updated);
  };

  const onSubmit = async (data: ProductFormData) => {
    try {
      setSubmitting(true);

      // Validate variants
      if (variants.length === 0) {
        alert('At least one variant is required');
        return;
      }

      for (let i = 0; i < variants.length; i++) {
        const v = variants[i];
        if (!v.name) {
          alert(`Variant ${i + 1}: Name is required`);
          return;
        }
        if (!v.sku) {
          alert(`Variant ${i + 1}: SKU is required`);
          return;
        }
        if (!isEditMode && !v.pendingImage) {
          alert(`Variant ${i + 1}: Image is required`);
          return;
        }
      }

      const payload = {
        title: data.title,
        slug: data.slug,
        description: data.description || null,
        basePrice: parseFloat(data.basePrice || '0'),
        categoryId: data.categoryId,
        rating: parseFloat(data.rating || '0'),
        reviews: parseInt(data.reviews || '0', 10),
        features: features,
        variants: [] as any[],
      };

      if (isEditMode) {
        // EDIT MODE: Upload new images and prepare variant data
        const variantData = [];

        for (const variant of variants) {
          let imagePath = variant.imagePath;

          // If there's a pending image, upload it
          if (variant.pendingImage) {
            imagePath = await uploadFileToR2(variant.pendingImage, id!);
          }

          // Upload new gallery images and merge with existing
          let galleryPaths = [...(variant.galleryPaths || [])];
          if (variant.pendingGalleryImages && variant.pendingGalleryImages.length > 0) {
            console.log(`[ProductForm] Uploading ${variant.pendingGalleryImages.length} new gallery images for variant ${variant.name}...`);
            for (const galleryFile of variant.pendingGalleryImages) {
              const galleryUrl = await uploadFileToR2(galleryFile, id!);
              if (galleryUrl) {
                galleryPaths.push(galleryUrl);
              }
            }
          }

          variantData.push({
            name: variant.name,
            sku: variant.sku,
            price: parseFloat(variant.price),
            originalPrice: variant.originalPrice ? parseFloat(variant.originalPrice) : null,
            sizes: variant.sizes,
            imagePath: imagePath,
            galleryPaths: galleryPaths,
            stock: parseInt(variant.stock, 10),
            isAvailable: variant.isAvailable,
            sortOrder: variant.sortOrder,
          });
        }

        await api.put(`/admin/products/${id}`, { ...payload, variants: variantData });
        navigate('/products');
      } else {
        // CREATE MODE
        console.log('[ProductForm] Step 1: Creating product...');

        // Create product without variants first to get UUID
        const response = await api.post('/admin/products', {
          ...payload,
          variants: variants.map((v, i) => ({
            name: v.name,
            sku: v.sku,
            price: parseFloat(v.price),
            originalPrice: v.originalPrice ? parseFloat(v.originalPrice) : null,
            sizes: v.sizes,
            imagePath: '', // Temporary empty
            galleryPaths: [],
            stock: parseInt(v.stock, 10),
            isAvailable: v.isAvailable,
            sortOrder: i,
          })),
        });

        const newProductId = response.data.id;
        console.log('[ProductForm] ✅ Product created with UUID:', newProductId);

        // Step 2: Upload variant images
        console.log('[ProductForm] Step 2: Uploading variant images...');
        const variantData = [];

        for (const variant of variants) {
          let imagePath = '';
          if (variant.pendingImage) {
            imagePath = await uploadFileToR2(variant.pendingImage, newProductId);
          }

          // Upload gallery images
          const galleryPaths: string[] = [];
          if (variant.pendingGalleryImages && variant.pendingGalleryImages.length > 0) {
            console.log(`[ProductForm] Uploading ${variant.pendingGalleryImages.length} gallery images for variant ${variant.name}...`);
            for (const galleryFile of variant.pendingGalleryImages) {
              const galleryUrl = await uploadFileToR2(galleryFile, newProductId);
              if (galleryUrl) {
                galleryPaths.push(galleryUrl);
              }
            }
          }

          variantData.push({
            name: variant.name,
            sku: variant.sku,
            price: parseFloat(variant.price),
            originalPrice: variant.originalPrice ? parseFloat(variant.originalPrice) : null,
            sizes: variant.sizes,
            imagePath: imagePath,
            galleryPaths: galleryPaths,
            stock: parseInt(variant.stock, 10),
            isAvailable: variant.isAvailable,
            sortOrder: variant.sortOrder,
          });
        }

        // Step 3: Update product with image URLs
        console.log('[ProductForm] Step 3: Updating product with variant images...');
        await api.put(`/admin/products/${newProductId}`, {
          ...payload,
          variants: variantData,
        });

        console.log('[ProductForm] ✅ Product creation complete!');
        navigate('/products');
      }
    } catch (error: any) {
      console.error('Failed to save product:', error);
      alert(error?.response?.data?.message || 'Failed to save product');
    } finally {
      setSubmitting(false);
    }
  };

  const generateSlug = () => {
    const title = watch('title');
    if (title) {
      const slug = title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
      setValue('slug', slug);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate('/products')} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Products
        </Button>
        <h1 className="text-3xl font-bold">{isEditMode ? 'Edit Product' : 'Create Product'}</h1>
        <p className="text-muted-foreground">
          {isEditMode ? 'Update product information' : 'Add a new product to your catalog'}
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Information */}
        <div className="rounded-lg border bg-card p-6 space-y-4">
          <h2 className="text-xl font-semibold">Basic Information</h2>

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="category">Category *</Label>
            <Select value={categoryId} onValueChange={(value) => setValue('categoryId', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.categoryId && <p className="text-sm text-destructive">{errors.categoryId.message}</p>}
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input id="title" {...register('title')} placeholder="Enter product title" />
            {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
          </div>

          {/* Slug */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="slug">Slug *</Label>
              <Button type="button" variant="link" size="sm" onClick={generateSlug}>
                Generate from title
              </Button>
            </div>
            <Input id="slug" {...register('slug')} placeholder="product-slug" />
            {errors.slug && <p className="text-sm text-destructive">{errors.slug.message}</p>}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              {...register('description')}
              placeholder="Enter product description"
              rows={4}
            />
          </div>

          {/* Base Price */}
          <div className="space-y-2">
            <Label htmlFor="basePrice">Base Price</Label>
            <Input
              id="basePrice"
              {...register('basePrice')}
              placeholder="0.00"
              type="text"
            />
            <p className="text-xs text-muted-foreground">Base price (can be overridden by variants)</p>
          </div>

          {/* Features */}
          <div className="space-y-2">
            <Label>Product Features</Label>
            <div className="flex gap-2">
              <Input
                value={featureInput}
                onChange={(e) => setFeatureInput(e.target.value)}
                placeholder="Enter a feature"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (featureInput.trim()) {
                      setFeatures([...features, featureInput.trim()]);
                      setFeatureInput('');
                    }
                  }
                }}
              />
              <Button
                type="button"
                onClick={() => {
                  if (featureInput.trim()) {
                    setFeatures([...features, featureInput.trim()]);
                    setFeatureInput('');
                  }
                }}
              >
                Add
              </Button>
            </div>
            <div className="space-y-1 mt-2">
              {features.map((feature, index) => (
                <div key={index} className="flex items-center gap-2 p-2 bg-muted rounded">
                  <span className="flex-1 text-sm">{feature}</span>
                  <button
                    type="button"
                    onClick={() => setFeatures(features.filter((_, i) => i !== index))}
                    className="text-destructive hover:text-destructive/80"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Product Variants */}
        <div className="rounded-lg border bg-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Product Variants</h2>
            <Button type="button" onClick={addVariant} variant="outline" size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add Variant
            </Button>
          </div>

          <Tabs value={activeVariantTab} onValueChange={setActiveVariantTab} className="w-full">
            <div className="flex items-center gap-2">
              <TabsList className="flex-1 justify-start flex-wrap h-auto">
                {variants.map((variant, index) => (
                  <TabsTrigger key={index} value={`variant-${index}`}>
                    {variant.name || `Variant ${index + 1}`}
                  </TabsTrigger>
                ))}
              </TabsList>
              {variants.length > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const activeIndex = parseInt(activeVariantTab.split('-')[1]);
                    removeVariant(activeIndex);
                    // Switch to previous tab if last tab is deleted
                    if (activeIndex > 0) {
                      setActiveVariantTab(`variant-${activeIndex - 1}`);
                    }
                  }}
                  className="hover:bg-destructive hover:text-white"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Current
                </Button>
              )}
            </div>

            {variants.map((variant, index) => (
              <TabsContent key={index} value={`variant-${index}`} className="space-y-4 border rounded-lg p-4 mt-4">

                <div className="grid grid-cols-2 gap-4">
                  {/* Variant Name */}
                  <div className="space-y-2">
                    <Label>Variant Name *</Label>
                    <Input
                      value={variant.name}
                      onChange={(e) => updateVariant(index, 'name', e.target.value)}
                      placeholder="e.g., Black/Red, Ocean Blue"
                    />
                  </div>

                  {/* SKU */}
                  <div className="space-y-2">
                    <Label>SKU *</Label>
                    <Input
                      value={variant.sku}
                      onChange={(e) => updateVariant(index, 'sku', e.target.value)}
                      placeholder="e.g., SHOE-BLK-41"
                    />
                  </div>

                  {/* Price */}
                  <div className="space-y-2">
                    <Label>Price *</Label>
                    <Input
                      value={variant.price}
                      onChange={(e) => updateVariant(index, 'price', e.target.value)}
                      placeholder="0.00"
                      type="text"
                    />
                  </div>

                  {/* Original Price */}
                  <div className="space-y-2">
                    <Label>Original Price (optional)</Label>
                    <Input
                      value={variant.originalPrice || ''}
                      onChange={(e) => updateVariant(index, 'originalPrice', e.target.value)}
                      placeholder="0.00"
                      type="text"
                    />
                  </div>

                  {/* Stock */}
                  <div className="space-y-2">
                    <Label>Stock *</Label>
                    <Input
                      value={variant.stock}
                      onChange={(e) => updateVariant(index, 'stock', e.target.value)}
                      placeholder="0"
                      type="text"
                    />
                  </div>

                  {/* Sizes */}
                  <div className="space-y-2">
                    <Label>Sizes (comma separated)</Label>
                    <Input
                      value={variant.sizes.join(', ')}
                      onChange={(e) => {
                        const sizes = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                        updateVariant(index, 'sizes', sizes);
                      }}
                      placeholder="e.g., 41, 42, 43"
                    />
                  </div>
                </div>

                {/* Variant Image */}
                <div className="space-y-2">
                  <Label>Variant Image (Thumbnail) *</Label>
                  <div className="flex items-center gap-4">
                    <div className="relative w-24 h-24 rounded border bg-muted overflow-hidden">
                      {(variant.previewUrl || variant.imagePath) ? (
                        <img
                          src={variant.previewUrl || variant.imagePath}
                          alt="Variant preview"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                          <Upload className="w-8 h-8" />
                        </div>
                      )}
                    </div>
                    <input
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp,image/avif,image/gif"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleVariantImageSelect(index, file);
                        }
                      }}
                      className="text-sm"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    This image will be shown as variant thumbnail
                  </p>
                </div>

                {/* Variant Gallery Images */}
                <div className="space-y-2 col-span-2">
                  <Label>Gallery Images (Optional)</Label>
                  <div className="space-y-4">
                    {/* Preview existing gallery images */}
                    <div className="flex flex-wrap gap-2">
                      {variant.galleryPaths?.map((path, imgIndex) => (
                        <div key={`existing-${imgIndex}`} className="relative w-20 h-20 rounded border bg-muted overflow-hidden group">
                          <img
                            src={path}
                            alt={`Gallery ${imgIndex + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => removeVariantGalleryImage(index, imgIndex)}
                            className="absolute top-1 right-1 p-1 bg-destructive text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      {variant.galleryPreviewUrls?.map((url, imgIndex) => (
                        <div key={`preview-${imgIndex}`} className="relative w-20 h-20 rounded border bg-muted overflow-hidden group">
                          <img
                            src={url}
                            alt={`Preview ${imgIndex + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => removeVariantGalleryImage(index, variant.galleryPaths?.length || 0 + imgIndex)}
                            className="absolute top-1 right-1 p-1 bg-destructive text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                    {/* Upload input */}
                    <input
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp,image/avif,image/gif"
                      multiple
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          handleVariantGalleryImagesSelect(index, e.target.files);
                        }
                      }}
                      className="text-sm"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    These images will be shown in the product gallery when this variant is selected
                  </p>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </div>

        {/* Actions */}
        <div className="flex gap-4">
          <Button type="submit" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {isEditMode ? 'Updating...' : 'Creating...'}
              </>
            ) : (
              <>{isEditMode ? 'Update Product' : 'Create Product'}</>
            )}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate('/products')}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
