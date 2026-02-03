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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Loader2, Upload, X, Plus, Trash2, AlertCircle, CheckCircle2, Image as ImageIcon, Video } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

type Category = {
  id: string;
  name: string;
  slug: string;
};

type ProductVariant = {
  id?: string;
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

  const watchedValues = watch();

  useEffect(() => {
    fetchCategories();
    if (isEditMode && id) {
      fetchProduct(id);
    }
  }, [id]);

  const fetchCategories = async () => {
    try {
      const { data } = await api.get<Category[]>('/admin/categories');
      setCategories(data);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const fetchProduct = async (productId: string) => {
    try {
      setLoading(true);
      const { data } = await api.get(`/admin/products/${productId}`);

      setValue('title', data.title);
      setValue('slug', data.slug);
      setValue('description', data.description || '');
      setValue('basePrice', data.basePrice.toString());
      setValue('categoryId', data.categoryId);
      setValue('rating', data.rating.toString());
      setValue('reviews', data.reviews.toString());

      setFeatures(data.features || []);

      if (data.variants && data.variants.length > 0) {
        setVariants(
          data.variants.map((v: any) => ({
            id: v.id,
            name: v.name,
            sku: v.sku,
            price: v.price.toString(),
            originalPrice: v.originalPrice?.toString(),
            sizes: v.sizes,
            imagePath: v.imagePath,
            galleryPaths: v.galleryPaths,
            stock: v.stock.toString(),
            isAvailable: v.isAvailable,
            sortOrder: v.sortOrder,
          }))
        );
      }
    } catch (error) {
      console.error('Failed to fetch product:', error);
      alert('Failed to load product');
    } finally {
      setLoading(false);
    }
  };

  const generateSlug = () => {
    if (watchedValues.title) {
      const slug = watchedValues.title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
      setValue('slug', slug);
    }
  };

  const uploadFileToR2 = async (file: File, productId: string): Promise<string | null> => {
    try {
      const presignedRes = await api.post('/admin/upload/presigned-url', {
        filename: file.name,
        contentType: file.type,
        productId,
      });

      const { uploadUrl, publicUrl } = presignedRes.data;

      await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });

      return publicUrl;
    } catch (error) {
      console.error('Failed to upload file:', error);
      return null;
    }
  };

  const onSubmit = async (data: ProductFormData) => {
    try {
      setSubmitting(true);

      if (variants.length === 0) {
        alert('At least one variant is required');
        return;
      }

      for (const variant of variants) {
        if (!variant.name || !variant.sku || !variant.price) {
          alert('All variants must have name, SKU, and price');
          return;
        }
      }

      let productId = id;

      const payload: any = {
        title: data.title,
        slug: data.slug,
        description: data.description || null,
        basePrice: parseFloat(data.basePrice || '0'),
        categoryId: data.categoryId,
        rating: parseFloat(data.rating || '0'),
        reviews: parseInt(data.reviews || '0'),
        features,
        variants: variants.map((v, idx) => ({
          ...(v.id && { id: v.id }),
          name: v.name,
          sku: v.sku,
          price: parseFloat(v.price),
          originalPrice: v.originalPrice ? parseFloat(v.originalPrice) : null,
          sizes: v.sizes,
          imagePath: v.imagePath,
          galleryPaths: v.galleryPaths,
          stock: parseInt(v.stock),
          isAvailable: v.isAvailable,
          sortOrder: idx,
        })),
      };

      if (isEditMode && id) {
        await api.put(`/admin/products/${id}`, payload);
        alert('Product updated successfully!');
      } else {
        const createRes = await api.post('/admin/products', payload);
        productId = createRes.data.id;
        alert('Product created successfully!');
      }

      if (productId) {
        for (let i = 0; i < variants.length; i++) {
          const variant = variants[i];

          if (variant.pendingImage) {
            const imageUrl = await uploadFileToR2(variant.pendingImage, productId);
            if (imageUrl) {
              variant.imagePath = imageUrl;
            }
          }

          if (variant.pendingGalleryImages && variant.pendingGalleryImages.length > 0) {
            const galleryUrls: string[] = [];
            for (const galleryFile of variant.pendingGalleryImages) {
              const url = await uploadFileToR2(galleryFile, productId);
              if (url) galleryUrls.push(url);
            }
            variant.galleryPaths = [...variant.galleryPaths, ...galleryUrls];
          }
        }

        if (variants.some(v => v.pendingImage || (v.pendingGalleryImages && v.pendingGalleryImages.length > 0))) {
          const updatePayload = {
            ...payload,
            variants: variants.map((v, idx) => ({
              ...(v.id && { id: v.id }),
              name: v.name,
              sku: v.sku,
              price: parseFloat(v.price),
              originalPrice: v.originalPrice ? parseFloat(v.originalPrice) : null,
              sizes: v.sizes,
              imagePath: v.imagePath,
              galleryPaths: v.galleryPaths,
              stock: parseInt(v.stock),
              isAvailable: v.isAvailable,
              sortOrder: idx,
            })),
          };
          await api.put(`/admin/products/${productId}`, updatePayload);
        }
      }

      navigate('/products');
    } catch (error: any) {
      console.error('Failed to save product:', error);
      alert(error?.response?.data?.message || 'Failed to save product');
    } finally {
      setSubmitting(false);
    }
  };

  const addVariant = () => {
    const newVariant: ProductVariant = {
      name: '',
      sku: '',
      price: '0',
      sizes: [],
      imagePath: '',
      galleryPaths: [],
      stock: '0',
      isAvailable: true,
      sortOrder: variants.length,
    };
    setVariants([...variants, newVariant]);
    setActiveVariantTab(`variant-${variants.length}`);
  };

  const deleteVariant = (index: number) => {
    if (variants.length === 1) {
      alert('At least one variant is required');
      return;
    }
    const updated = variants.filter((_, i) => i !== index);
    setVariants(updated);
    if (activeVariantTab === `variant-${index}`) {
      setActiveVariantTab(`variant-${Math.max(0, index - 1)}`);
    }
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

  const removeGalleryImage = (variantIndex: number, galleryIndex: number) => {
    const updated = [...variants];
    updated[variantIndex].galleryPaths.splice(galleryIndex, 1);
    setVariants(updated);
  };

  const removePendingGalleryImage = (variantIndex: number, pendingIndex: number) => {
    const updated = [...variants];
    updated[variantIndex].pendingGalleryImages?.splice(pendingIndex, 1);
    updated[variantIndex].galleryPreviewUrls?.splice(pendingIndex, 1);
    setVariants(updated);
  };

  const addFeature = () => {
    if (featureInput.trim()) {
      setFeatures([...features, featureInput.trim()]);
      setFeatureInput('');
    }
  };

  const removeFeature = (index: number) => {
    setFeatures(features.filter((_, i) => i !== index));
  };

  const addSize = (variantIndex: number, size: string) => {
    if (size.trim()) {
      const updated = [...variants];
      if (!updated[variantIndex].sizes.includes(size.trim())) {
        updated[variantIndex].sizes.push(size.trim());
        setVariants(updated);
      }
    }
  };

  const removeSize = (variantIndex: number, sizeIndex: number) => {
    const updated = [...variants];
    updated[variantIndex].sizes.splice(sizeIndex, 1);
    setVariants(updated);
  };

  // Validation summary
  const getValidationErrors = () => {
    const errorsList: string[] = [];
    if (errors.title) errorsList.push('Title is required');
    if (errors.slug) errorsList.push('Slug is required');
    if (errors.categoryId) errorsList.push('Category is required');
    if (variants.length === 0) errorsList.push('At least one variant is required');
    variants.forEach((v, i) => {
      if (!v.name) errorsList.push(`Variant ${i + 1}: Name is required`);
      if (!v.sku) errorsList.push(`Variant ${i + 1}: SKU is required`);
      if (!v.price || parseFloat(v.price) <= 0) errorsList.push(`Variant ${i + 1}: Valid price is required`);
    });
    return errorsList;
  };

  const validationErrors = getValidationErrors();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b mb-6 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => navigate('/products')}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold">
                {isEditMode ? 'Edit Product' : 'Create Product'}
              </h1>
              <p className="text-sm text-muted-foreground">
                {isEditMode ? 'Update product details and variants' : 'Add a new product to your catalog'}
              </p>
            </div>
          </div>
          <Badge variant={validationErrors.length === 0 ? 'default' : 'destructive'}>
            {validationErrors.length === 0 ? 'Ready' : `${validationErrors.length} issues`}
          </Badge>
        </div>
      </div>

      {/* Two-Column Layout */}
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Info Card */}
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
                <CardDescription>Product name, description, and categorization</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="title">Product Title *</Label>
                    <Input
                      id="title"
                      {...register('title')}
                      placeholder="Nike Air Max 270"
                      className={errors.title ? 'border-destructive' : ''}
                    />
                    {errors.title && (
                      <p className="text-sm text-destructive">{errors.title.message}</p>
                    )}
                  </div>

                  <div className="col-span-2 space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="slug">URL Slug *</Label>
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        onClick={generateSlug}
                        className="h-auto p-0"
                      >
                        Generate from title
                      </Button>
                    </div>
                    <Input
                      id="slug"
                      {...register('slug')}
                      placeholder="nike-air-max-270"
                      className={errors.slug ? 'border-destructive' : ''}
                    />
                    {errors.slug && (
                      <p className="text-sm text-destructive">{errors.slug.message}</p>
                    )}
                  </div>

                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      {...register('description')}
                      placeholder="Detailed product description..."
                      rows={4}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="categoryId">Category *</Label>
                    <Select
                      value={watchedValues.categoryId}
                      onValueChange={(value) => setValue('categoryId', value)}
                    >
                      <SelectTrigger className={errors.categoryId ? 'border-destructive' : ''}>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.categoryId && (
                      <p className="text-sm text-destructive">{errors.categoryId.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="basePrice">Base Price</Label>
                    <Input
                      id="basePrice"
                      type="number"
                      step="0.01"
                      {...register('basePrice')}
                      placeholder="0.00"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="rating">Rating (0-5)</Label>
                    <Input
                      id="rating"
                      type="number"
                      step="0.1"
                      min="0"
                      max="5"
                      {...register('rating')}
                      placeholder="0.0"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reviews">Reviews Count</Label>
                    <Input
                      id="reviews"
                      type="number"
                      {...register('reviews')}
                      placeholder="0"
                    />
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label>Features & Highlights</Label>
                  <div className="flex gap-2">
                    <Input
                      value={featureInput}
                      onChange={(e) => setFeatureInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addFeature();
                        }
                      }}
                      placeholder="Add a feature..."
                    />
                    <Button type="button" onClick={addFeature} variant="secondary">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  {features.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {features.map((feature, index) => (
                        <Badge key={index} variant="secondary" className="gap-1">
                          {feature}
                          <button
                            type="button"
                            onClick={() => removeFeature(index)}
                            className="ml-1 hover:text-destructive"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Variants Card */}
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
                <Tabs value={activeVariantTab} onValueChange={setActiveVariantTab}>
                  <TabsList className="w-full flex-wrap h-auto">
                    {variants.map((variant, index) => (
                      <TabsTrigger key={index} value={`variant-${index}`} className="flex-1 min-w-[120px]">
                        {variant.name || `Variant ${index + 1}`}
                      </TabsTrigger>
                    ))}
                  </TabsList>

                  {variants.map((variant, index) => (
                    <TabsContent key={index} value={`variant-${index}`} className="space-y-4 mt-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2 space-y-2">
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

                        <div className="col-span-2 space-y-2">
                          <Label>Available Sizes</Label>
                          <div className="flex gap-2">
                            <Input
                              placeholder="Enter size (e.g., 42, M, XL)"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  addSize(index, (e.target as HTMLInputElement).value);
                                  (e.target as HTMLInputElement).value = '';
                                }
                              }}
                            />
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

                        <div className="col-span-2 space-y-2">
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
                                <Upload className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                                <p className="text-sm text-muted-foreground">
                                  Click to upload thumbnail
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  JPEG, PNG, WebP, AVIF, GIF
                                </p>
                              </div>
                              <input
                                type="file"
                                accept="image/jpeg,image/jpg,image/png,image/webp,image/avif,image/gif"
                                onChange={(e) => {
                                  if (e.target.files?.[0]) {
                                    handleVariantImageSelect(index, e.target.files[0]);
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
                              <Upload className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                              <p className="text-sm text-muted-foreground">
                                Click to add gallery images
                              </p>
                            </div>
                            <input
                              type="file"
                              accept="image/jpeg,image/jpg,image/png,image/webp,image/avif,image/gif"
                              multiple
                              onChange={(e) => {
                                if (e.target.files && e.target.files.length > 0) {
                                  handleVariantGalleryImagesSelect(index, e.target.files);
                                }
                              }}
                              className="hidden"
                            />
                          </label>
                          {(variant.galleryPaths.length > 0 || variant.galleryPreviewUrls) && (
                            <div className="grid grid-cols-4 gap-2 mt-2">
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
          </div>

          {/* Right Column - Preview & Validation */}
          <div className="space-y-6">
            {/* Validation Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {validationErrors.length === 0 ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-destructive" />
                  )}
                  Validation
                </CardTitle>
              </CardHeader>
              <CardContent>
                {validationErrors.length === 0 ? (
                  <Alert>
                    <CheckCircle2 className="w-4 h-4" />
                    <AlertDescription>
                      All required fields are filled. Ready to save!
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert variant="destructive">
                    <AlertCircle className="w-4 h-4" />
                    <AlertDescription>
                      <p className="font-semibold mb-2">
                        {validationErrors.length} issue{validationErrors.length !== 1 ? 's' : ''} found:
                      </p>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        {validationErrors.map((error, index) => (
                          <li key={index}>{error}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* Preview Card */}
            <Card>
              <CardHeader>
                <CardTitle>Preview</CardTitle>
                <CardDescription>How your product will appear</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {variants[0] && (variants[0].previewUrl || variants[0].imagePath) && (
                  <div className="aspect-square rounded-lg overflow-hidden bg-muted">
                    <img
                      src={variants[0].previewUrl || variants[0].imagePath}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div>
                  <h3 className="font-bold text-lg">
                    {watchedValues.title || 'Product Title'}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {categories.find(c => c.id === watchedValues.categoryId)?.name || 'Category'}
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    {variants.length} variant{variants.length !== 1 ? 's' : ''}
                  </p>
                  <p className="text-2xl font-bold text-primary mt-2">
                    ${variants[0]?.price || '0.00'}
                  </p>
                </div>
                {features.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">Features:</p>
                    <ul className="list-disc list-inside text-sm text-muted-foreground">
                      {features.slice(0, 3).map((feature, index) => (
                        <li key={index}>{feature}</li>
                      ))}
                      {features.length > 3 && (
                        <li>+{features.length - 3} more</li>
                      )}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Variants:</span>
                  <span className="font-semibold">{variants.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Stock:</span>
                  <span className="font-semibold">
                    {variants.reduce((sum, v) => sum + parseInt(v.stock || '0'), 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Features:</span>
                  <span className="font-semibold">{features.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Price Range:</span>
                  <span className="font-semibold">
                    ${Math.min(...variants.map(v => parseFloat(v.price || '0'))).toFixed(2)} -
                    ${Math.max(...variants.map(v => parseFloat(v.price || '0'))).toFixed(2)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Sticky Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t py-4 px-6 z-20">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {validationErrors.length === 0 ? (
              <span className="text-green-600 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Ready to save
              </span>
            ) : (
              <span className="text-destructive flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {validationErrors.length} validation error{validationErrors.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/products')}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || validationErrors.length > 0}>
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  {isEditMode ? 'Update Product' : 'Create Product'}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
