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
import { ArrowLeft, Loader2, Upload, X } from 'lucide-react';
import { ImageUpload } from '@/components/ImageUpload';

type Category = {
  id: string;
  name: string;
  slug: string;
};

const productSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  slug: z.string().min(1, 'Slug is required').regex(/^[a-z0-9-]+$/, 'Slug must be lowercase with hyphens'),
  description: z.string().optional(),
  price: z.string().min(1, 'Price is required').regex(/^\d+(\.\d{1,2})?$/, 'Invalid price format'),
  stock: z.string().min(1, 'Stock is required').regex(/^\d+$/, 'Stock must be a number'),
  categoryId: z.string().uuid('Please select a category'),
});

type ProductFormData = z.infer<typeof productSchema>;

export default function ProductFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditMode = !!id;

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(isEditMode);
  const [submitting, setSubmitting] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [pendingImageFiles, setPendingImageFiles] = useState<File[]>([]); // Files waiting to be uploaded in CREATE mode
  const [previewUrls, setPreviewUrls] = useState<string[]>([]); // Preview URLs for pending files

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
      price: '',
      stock: '0',
      categoryId: '',
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
      productId: productId, // Use real product UUID
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

  // Handle file selection in CREATE mode (create previews, don't upload yet)
  const handlePendingFiles = (files: File[]) => {
    console.log('[ProductForm] Adding pending files:', files.length);

    // Create preview URLs
    const newPreviewUrls = files.map(file => URL.createObjectURL(file));

    setPendingImageFiles([...pendingImageFiles, ...files]);
    setPreviewUrls([...previewUrls, ...newPreviewUrls]);
  };

  // Remove pending file
  const removePendingFile = (index: number) => {
    // Revoke the blob URL to free memory
    URL.revokeObjectURL(previewUrls[index]);

    setPendingImageFiles(pendingImageFiles.filter((_, i) => i !== index));
    setPreviewUrls(previewUrls.filter((_, i) => i !== index));
  };

  // Clean up preview URLs on unmount
  useEffect(() => {
    return () => {
      previewUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, []);

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
        setValue('price', data.price);
        setValue('stock', String(data.stock));
        setValue('categoryId', data.categoryId);
        setImages(data.images || []);
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

  const onSubmit = async (data: ProductFormData) => {
    try {
      setSubmitting(true);

      const payload = {
        title: data.title,
        slug: data.slug,
        description: data.description || null,
        price: data.price,
        stock: parseInt(data.stock, 10),
        categoryId: data.categoryId,
        images: [], // Will be set after creation
      };

      if (isEditMode) {
        // Edit mode: images already have real UUID, just update
        await api.put(`/admin/products/${id}`, { ...payload, images });
        navigate('/products');
      } else {
        // CREATE MODE: Proper flow with real UUID
        console.log('[ProductForm] Step 1: Creating product without images...');

        // Step 1: Create product without images to get real UUID
        const response = await api.post('/admin/products', payload);
        const newProductId = response.data.id;

        console.log('[ProductForm] ✅ Product created with UUID:', newProductId);

        // Step 2: Upload pending image files with the real UUID
        if (pendingImageFiles.length > 0) {
          console.log('[ProductForm] Step 2: Uploading', pendingImageFiles.length, 'images with real UUID...');

          const uploadedUrls: string[] = [];

          for (const file of pendingImageFiles) {
            try {
              const url = await uploadFileToR2(file, newProductId);
              uploadedUrls.push(url);
            } catch (error) {
              console.error('[ProductForm] Failed to upload file:', file.name, error);
              // Continue with other files
            }
          }

          console.log('[ProductForm] ✅ Uploaded', uploadedUrls.length, 'images');

          // Step 3: Update product with image URLs
          if (uploadedUrls.length > 0) {
            console.log('[ProductForm] Step 3: Updating product with image URLs...');
            await api.put(`/admin/products/${newProductId}`, {
              ...payload,
              images: uploadedUrls,
            });
            console.log('[ProductForm] ✅ Product updated with images');
          }

          // Clean up preview URLs
          previewUrls.forEach(url => URL.revokeObjectURL(url));
        }

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
    <div className="space-y-6 max-w-3xl">
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
        <div className="rounded-lg border bg-card p-6 space-y-4">
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
            {errors.description && <p className="text-sm text-destructive">{errors.description.message}</p>}
          </div>

          {/* Price & Stock */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price">Price *</Label>
              <Input
                id="price"
                {...register('price')}
                placeholder="0.00"
                type="text"
              />
              {errors.price && <p className="text-sm text-destructive">{errors.price.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="stock">Stock *</Label>
              <Input
                id="stock"
                {...register('stock')}
                placeholder="0"
                type="text"
              />
              {errors.stock && <p className="text-sm text-destructive">{errors.stock.message}</p>}
            </div>
          </div>

          {/* Images */}
          <div className="space-y-2">
            <Label>Product Images</Label>

            {isEditMode ? (
              // EDIT MODE: Use ImageUpload component (uploads immediately with real UUID)
              <ImageUpload
                productId={id}
                images={images}
                onChange={setImages}
                maxImages={10}
              />
            ) : (
              // CREATE MODE: File selection with previews (upload after product creation)
              <div className="space-y-4">
                <div className="relative border-2 border-dashed rounded-lg p-8 text-center transition-colors border-border hover:border-primary/50">
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      if (files.length > 0) {
                        // Validate files
                        const validFiles = files.filter(file => {
                          if (!file.type.startsWith('image/')) {
                            alert(`${file.name} is not an image file`);
                            return false;
                          }
                          if (file.size > 5 * 1024 * 1024) {
                            alert(`${file.name} is too large (max 5MB)`);
                            return false;
                          }
                          return true;
                        });
                        handlePendingFiles(validFiles);
                      }
                      e.target.value = ''; // Reset input
                    }}
                    disabled={submitting || pendingImageFiles.length >= 10}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />

                  <div className="flex flex-col items-center gap-2 pointer-events-none">
                    <Upload className="w-10 h-10 text-muted-foreground" />
                    <p className="text-sm font-medium">
                      Select images to upload after product creation
                    </p>
                    <p className="text-xs text-muted-foreground">
                      PNG, JPG, WebP up to 5MB ({pendingImageFiles.length}/10)
                    </p>
                  </div>
                </div>

                {/* Preview Grid */}
                {previewUrls.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {previewUrls.map((url, index) => (
                      <div
                        key={index}
                        className="relative group aspect-square rounded-lg border bg-muted overflow-hidden"
                      >
                        <img
                          src={url}
                          alt={`Preview ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => removePendingFile(index)}
                            disabled={submitting}
                          >
                            <X className="w-4 h-4 mr-1" />
                            Remove
                          </Button>
                        </div>
                        {index === 0 && (
                          <div className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs px-2 py-1 rounded">
                            Main
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <p className="text-sm text-muted-foreground">
              {isEditMode
                ? 'Upload product images. First image will be used as the main image.'
                : 'Select images now - they will be uploaded with the product UUID after creation.'}
            </p>
          </div>
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
