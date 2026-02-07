import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api, getNikePrefill } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Loader2, Upload, X, Plus, Trash2, AlertCircle, CheckCircle2, Image as ImageIcon } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
const productSchema = z.object({
    title: z.string().min(1, 'Title is required'),
    slug: z.string().min(1, 'Slug is required').regex(/^[a-z0-9-]+$/, 'Slug must be lowercase with hyphens'),
    description: z.string().optional(),
    basePrice: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Invalid price format').optional(),
    categoryId: z.string().uuid('Please select a category'),
    rating: z.string().optional(),
    reviews: z.string().optional(),
});
export default function ProductFormPage() {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEditMode = !!id;
    const [searchParams] = useSearchParams();
    const prefill = searchParams.get('prefill');
    const sku = searchParams.get('sku');
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(isEditMode);
    const [submitting, setSubmitting] = useState(false);
    const [prefillLoading, setPrefillLoading] = useState(false);
    const [prefillError, setPrefillError] = useState(null);
    const [prefilledSku, setPrefilledSku] = useState(null);
    const [activeVariantTab, setActiveVariantTab] = useState('variant-0');
    const [variants, setVariants] = useState([
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
    const [features, setFeatures] = useState([]);
    const [featureInput, setFeatureInput] = useState('');
    const [benefits, setBenefits] = useState([]);
    const [productDetails, setProductDetails] = useState([]);
    const [subtitle, setSubtitle] = useState('');
    const [isPublished, setIsPublished] = useState(false);
    const [prefillCategoryHint, setPrefillCategoryHint] = useState('');
    const { register, handleSubmit, formState: { errors }, setValue, getValues, watch, } = useForm({
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
    useEffect(() => {
        if (isEditMode)
            return;
        if (prefill !== 'nike' || !sku)
            return;
        if (prefilledSku === sku)
            return;
        setPrefilledSku(sku);
        setPrefillLoading(true);
        setPrefillError(null);
        getNikePrefill(sku)
            .then((data) => {
            if (!getValues('title'))
                setValue('title', data.title || '');
            if (!getValues('slug'))
                setValue('slug', data.slug || '');
            if (!getValues('description')) {
                setValue('description', data.shortDescription || data.description || '');
            }
            if (!subtitle && data.subtitle) {
                setSubtitle(data.subtitle);
            }
            if (data.subtitle || data.title) {
                setPrefillCategoryHint([data.subtitle, data.title].filter(Boolean).join(' '));
            }
            setVariants((prev) => {
                const next = prev.length > 0 ? [...prev] : [{
                        name: '',
                        sku: '',
                        price: '0',
                        sizes: [],
                        imagePath: '',
                        galleryPaths: [],
                        stock: '0',
                        isAvailable: true,
                        sortOrder: 0,
                    }];
                const first = { ...next[0] };
                if (!first.name)
                    first.name = data.variantName || '';
                if (!first.sku)
                    first.sku = data.sku || sku;
                if (data.priceUsd != null &&
                    Number.isFinite(data.priceUsd) &&
                    data.priceUsd > 0 &&
                    (!first.price || parseFloat(first.price) <= 0)) {
                    first.price = data.priceUsd.toString();
                }
                if ((!first.originalPrice || first.originalPrice === '0' || first.originalPrice === '0.00') && data.priceUsd != null) {
                    first.originalPrice = data.priceUsd.toString();
                }
                if (!first.imagePath && data.thumbnailUrl)
                    first.imagePath = data.thumbnailUrl;
                if ((first.galleryPaths?.length ?? 0) === 0 && data.galleryImages?.length) {
                    first.galleryPaths = data.galleryImages;
                }
                first.sortOrder = 0;
                next[0] = first;
                return next;
            });
            if (benefits.length === 0 && data.benefits?.length) {
                setBenefits(data.benefits);
            }
            if (productDetails.length === 0 && data.productDetails?.length) {
                setProductDetails(data.productDetails);
            }
        })
            .catch((error) => {
            console.error('Failed to prefill Nike data:', error);
            const backendMessage = error?.response?.data?.message ||
                error?.message ||
                'Failed to load Nike data. Please try again.';
            setPrefillError(backendMessage);
        })
            .finally(() => setPrefillLoading(false));
    }, [
        prefill,
        sku,
        prefilledSku,
        isEditMode,
        getValues,
        setValue,
        benefits.length,
        productDetails.length,
        subtitle,
    ]);
    useEffect(() => {
        if (!prefillCategoryHint)
            return;
        if (isEditMode)
            return;
        if (getValues('categoryId'))
            return;
        if (categories.length === 0)
            return;
        const normalize = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
        const hint = normalize(prefillCategoryHint);
        const sorted = [...categories].sort((a, b) => normalize(b.name).length - normalize(a.name).length);
        const match = sorted.find((cat) => {
            const name = normalize(cat.name);
            const slug = normalize(cat.slug);
            return ((name && hint.includes(name)) ||
                (slug && hint.includes(slug)) ||
                (hint && name.includes(hint)));
        });
        if (match) {
            setValue('categoryId', match.id, { shouldValidate: true, shouldDirty: true });
        }
    }, [prefillCategoryHint, categories, isEditMode, getValues, setValue]);
    const fetchCategories = async () => {
        try {
            const { data } = await api.get('/admin/categories');
            setCategories(data);
        }
        catch (error) {
            console.error('Failed to fetch categories:', error);
        }
    };
    const fetchProduct = async (productId) => {
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
            setBenefits(data.benefits || []);
            setProductDetails(data.productDetails || []);
            setSubtitle(data.subtitle || '');
            setIsPublished(Boolean(data.is_published ?? data.isPublished ?? false));
            if (data.variants && data.variants.length > 0) {
                setVariants(data.variants.map((v) => ({
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
                })));
            }
        }
        catch (error) {
            console.error('Failed to fetch product:', error);
            alert('Failed to load product');
        }
        finally {
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
    const uploadFileToR2 = async (file, productId) => {
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
        }
        catch (error) {
            console.error('Failed to upload file:', error);
            return null;
        }
    };
    const onSubmit = async (data) => {
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
            const payload = {
                title: data.title,
                slug: data.slug,
                is_published: isPublished,
                description: data.description || null,
                basePrice: parseFloat(data.basePrice || '0'),
                categoryId: data.categoryId,
                rating: parseFloat(data.rating || '0'),
                reviews: parseInt(data.reviews || '0'),
                features,
                benefits,
                productDetails,
                subtitle: subtitle || null,
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
            }
            else {
                const createRes = await api.post('/admin/products', payload);
                productId = createRes.data.id;
                alert('Product created successfully!');
            }
            if (productId) {
                const workingVariants = variants.map((variant) => ({
                    ...variant,
                    galleryPaths: [...(variant.galleryPaths || [])],
                }));
                let hasMediaChanges = false;
                for (let i = 0; i < workingVariants.length; i++) {
                    const variant = workingVariants[i];
                    if (variant.pendingImage) {
                        const imageUrl = await uploadFileToR2(variant.pendingImage, productId);
                        if (imageUrl && imageUrl !== variant.imagePath) {
                            variant.imagePath = imageUrl;
                            hasMediaChanges = true;
                        }
                    }
                    if (variant.pendingGalleryImages && variant.pendingGalleryImages.length > 0) {
                        const galleryUrls = [];
                        for (const galleryFile of variant.pendingGalleryImages) {
                            const url = await uploadFileToR2(galleryFile, productId);
                            if (url)
                                galleryUrls.push(url);
                        }
                        if (galleryUrls.length > 0) {
                            variant.galleryPaths = [...variant.galleryPaths, ...galleryUrls];
                            hasMediaChanges = true;
                        }
                    }
                }
                if (hasMediaChanges) {
                    const updatePayload = {
                        ...payload,
                        variants: workingVariants.map((v, idx) => ({
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
        }
        catch (error) {
            console.error('Failed to save product:', error);
            alert(error?.response?.data?.message || 'Failed to save product');
        }
        finally {
            setSubmitting(false);
        }
    };
    const addVariant = () => {
        const newVariant = {
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
    const deleteVariant = (index) => {
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
    const updateVariant = (index, field, value) => {
        const updated = [...variants];
        updated[index][field] = value;
        setVariants(updated);
    };
    const handleVariantImageSelect = (index, file) => {
        const updated = [...variants];
        updated[index].pendingImage = file;
        updated[index].previewUrl = URL.createObjectURL(file);
        setVariants(updated);
    };
    const handleVariantGalleryImagesSelect = (index, files) => {
        const updated = [...variants];
        const newFiles = Array.from(files);
        const existingFiles = updated[index].pendingGalleryImages || [];
        updated[index].pendingGalleryImages = [...existingFiles, ...newFiles];
        const newPreviewUrls = newFiles.map(f => URL.createObjectURL(f));
        const existingPreviewUrls = updated[index].galleryPreviewUrls || [];
        updated[index].galleryPreviewUrls = [...existingPreviewUrls, ...newPreviewUrls];
        setVariants(updated);
    };
    const removeGalleryImage = (variantIndex, galleryIndex) => {
        const updated = [...variants];
        updated[variantIndex].galleryPaths.splice(galleryIndex, 1);
        setVariants(updated);
    };
    const removePendingGalleryImage = (variantIndex, pendingIndex) => {
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
    const removeFeature = (index) => {
        setFeatures(features.filter((_, i) => i !== index));
    };
    const addSize = (variantIndex, size) => {
        if (size.trim()) {
            const updated = [...variants];
            if (!updated[variantIndex].sizes.includes(size.trim())) {
                updated[variantIndex].sizes.push(size.trim());
                setVariants(updated);
            }
        }
    };
    const removeSize = (variantIndex, sizeIndex) => {
        const updated = [...variants];
        updated[variantIndex].sizes.splice(sizeIndex, 1);
        setVariants(updated);
    };
    // Validation summary
    const getValidationErrors = () => {
        const errorsList = [];
        if (errors.title)
            errorsList.push('Title is required');
        if (errors.slug)
            errorsList.push('Slug is required');
        if (!watchedValues.categoryId)
            errorsList.push('Category is required');
        if (variants.length === 0)
            errorsList.push('At least one variant is required');
        variants.forEach((v, i) => {
            if (!v.name)
                errorsList.push(`Variant ${i + 1}: Name is required`);
            if (!v.sku)
                errorsList.push(`Variant ${i + 1}: SKU is required`);
            if (!v.price || parseFloat(v.price) <= 0)
                errorsList.push(`Variant ${i + 1}: Valid price is required`);
        });
        return errorsList;
    };
    const validationErrors = getValidationErrors();
    if (loading) {
        return (_jsx("div", { className: "flex items-center justify-center min-h-screen", children: _jsx(Loader2, { className: "w-8 h-8 animate-spin text-primary" }) }));
    }
    return (_jsxs("form", { onSubmit: handleSubmit(onSubmit), className: "pb-36 sm:pb-24", children: [_jsx("div", { className: "sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b mb-4 sm:mb-6 px-4 sm:px-6 py-3 sm:py-4", children: _jsxs("div", { className: "max-w-7xl mx-auto flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", children: [_jsxs("div", { className: "flex items-start gap-3 sm:items-center sm:gap-4", children: [_jsxs(Button, { type: "button", variant: "ghost", size: "sm", onClick: () => navigate('/products'), children: [_jsx(ArrowLeft, { className: "w-4 h-4 mr-2" }), "Back"] }), _jsxs("div", { children: [_jsx("h1", { className: "text-xl sm:text-2xl font-bold", children: isEditMode ? 'Edit Product' : 'Create Product' }), _jsx("p", { className: "text-sm text-muted-foreground", children: isEditMode ? 'Update product details and variants' : 'Add a new product to your catalog' }), !isEditMode && prefill === 'nike' && sku && (_jsx("p", { className: `text-sm ${prefillError ? 'text-destructive' : 'text-muted-foreground'}`, children: prefillLoading
                                                ? 'Prefilling details from Nike...'
                                                : prefillError
                                                    ? prefillError
                                                    : 'Nike prefill ready' }))] })] }), _jsx(Badge, { variant: validationErrors.length === 0 ? 'default' : 'destructive', className: "self-start sm:self-auto", children: validationErrors.length === 0 ? 'Ready' : `${validationErrors.length} issues` })] }) }), _jsx("div", { className: "max-w-7xl mx-auto px-4 sm:px-6", children: _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-3 gap-6", children: [_jsxs("div", { className: "lg:col-span-2 space-y-6", children: [_jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Basic Information" }), _jsx(CardDescription, { children: "Product name, description, and categorization" })] }), _jsxs(CardContent, { className: "space-y-4", children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsxs("div", { className: "md:col-span-2 space-y-2", children: [_jsx(Label, { htmlFor: "title", children: "Product Title *" }), _jsx(Input, { id: "title", ...register('title'), placeholder: "Nike Air Max 270", className: errors.title ? 'border-destructive' : '' }), errors.title && (_jsx("p", { className: "text-sm text-destructive", children: errors.title.message }))] }), _jsxs("div", { className: "md:col-span-2 space-y-2", children: [_jsxs("div", { className: "flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between", children: [_jsx(Label, { htmlFor: "slug", children: "URL Slug *" }), _jsx(Button, { type: "button", variant: "link", size: "sm", onClick: generateSlug, className: "h-auto p-0", children: "Generate from title" })] }), _jsx(Input, { id: "slug", ...register('slug'), placeholder: "nike-air-max-270", className: errors.slug ? 'border-destructive' : '' }), errors.slug && (_jsx("p", { className: "text-sm text-destructive", children: errors.slug.message }))] }), _jsxs("div", { className: "md:col-span-2 space-y-2", children: [_jsx(Label, { htmlFor: "description", children: "Description" }), _jsx(Textarea, { id: "description", ...register('description'), placeholder: "Detailed product description...", rows: 4 })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "categoryId", children: "Category *" }), _jsxs(Select, { value: watchedValues.categoryId, onValueChange: (value) => setValue('categoryId', value, { shouldValidate: true, shouldDirty: true }), children: [_jsx(SelectTrigger, { className: errors.categoryId ? 'border-destructive' : '', children: _jsx(SelectValue, { placeholder: "Select category" }) }), _jsx(SelectContent, { children: categories.map((cat) => (_jsx(SelectItem, { value: cat.id, children: cat.name }, cat.id))) })] }), errors.categoryId && (_jsx("p", { className: "text-sm text-destructive", children: errors.categoryId.message }))] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "basePrice", children: "Base Price" }), _jsx(Input, { id: "basePrice", type: "number", step: "0.01", ...register('basePrice'), placeholder: "0.00" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "rating", children: "Rating (0-5)" }), _jsx(Input, { id: "rating", type: "number", step: "0.1", min: "0", max: "5", ...register('rating'), placeholder: "0.0" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "reviews", children: "Reviews Count" }), _jsx(Input, { id: "reviews", type: "number", ...register('reviews'), placeholder: "0" })] }), _jsx("div", { className: "md:col-span-2", children: _jsxs("div", { className: "flex items-center justify-between rounded-lg border border-border p-3", children: [_jsxs("div", { children: [_jsx(Label, { htmlFor: "is-published", children: "Published" }), _jsx("p", { className: "text-xs text-muted-foreground", children: "Store \u0434\u044D\u044D\u0440 \u0445\u0430\u0440\u0430\u0433\u0434\u0443\u0443\u043B\u0430\u0445 \u0431\u043E\u043B \u0430\u0441\u0430\u0430\u043D\u0430." })] }), _jsx("input", { id: "is-published", type: "checkbox", checked: isPublished, onChange: (e) => setIsPublished(e.target.checked), className: "h-5 w-5 rounded border-border" })] }) })] }), _jsx(Separator, {}), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: "Features & Highlights" }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Input, { value: featureInput, onChange: (e) => setFeatureInput(e.target.value), onKeyDown: (e) => {
                                                                        if (e.key === 'Enter') {
                                                                            e.preventDefault();
                                                                            addFeature();
                                                                        }
                                                                    }, placeholder: "Add a feature..." }), _jsx(Button, { type: "button", onClick: addFeature, variant: "secondary", children: _jsx(Plus, { className: "w-4 h-4" }) })] }), features.length > 0 && (_jsx("div", { className: "flex flex-wrap gap-2 mt-2", children: features.map((feature, index) => (_jsxs(Badge, { variant: "secondary", className: "gap-1", children: [feature, _jsx("button", { type: "button", onClick: () => removeFeature(index), className: "ml-1 hover:text-destructive", children: _jsx(X, { className: "w-3 h-3" }) })] }, index))) }))] })] })] }), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsxs("div", { className: "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", children: [_jsxs("div", { children: [_jsx(CardTitle, { children: "Product Variants" }), _jsx(CardDescription, { children: "Colors, sizes, and pricing options" })] }), _jsxs(Button, { type: "button", onClick: addVariant, variant: "outline", size: "sm", children: [_jsx(Plus, { className: "w-4 h-4 mr-2" }), "Add Variant"] })] }) }), _jsx(CardContent, { children: _jsxs(Tabs, { value: activeVariantTab, onValueChange: setActiveVariantTab, children: [_jsx(TabsList, { className: "h-auto w-full justify-start gap-2 overflow-x-auto whitespace-nowrap p-1", children: variants.map((variant, index) => (_jsx(TabsTrigger, { value: `variant-${index}`, className: "max-w-[220px] flex-none truncate", title: variant.name || `Variant ${index + 1}`, children: variant.name || `Variant ${index + 1}` }, index))) }), variants.map((variant, index) => (_jsxs(TabsContent, { value: `variant-${index}`, className: "space-y-4 mt-4", children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsxs("div", { className: "md:col-span-2 space-y-2", children: [_jsx(Label, { children: "Variant Name *" }), _jsx(Input, { value: variant.name, onChange: (e) => updateVariant(index, 'name', e.target.value), placeholder: "e.g., Black/White, Ocean Blue" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: "SKU *" }), _jsx(Input, { value: variant.sku, onChange: (e) => updateVariant(index, 'sku', e.target.value), placeholder: "PROD-001" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: "Stock Quantity" }), _jsx(Input, { type: "number", value: variant.stock, onChange: (e) => updateVariant(index, 'stock', e.target.value), placeholder: "0" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: "Price *" }), _jsx(Input, { type: "number", step: "0.01", value: variant.price, onChange: (e) => updateVariant(index, 'price', e.target.value), placeholder: "0.00" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: "Original Price" }), _jsx(Input, { type: "number", step: "0.01", value: variant.originalPrice || '', onChange: (e) => updateVariant(index, 'originalPrice', e.target.value), placeholder: "0.00" })] }), _jsxs("div", { className: "md:col-span-2 space-y-2", children: [_jsx(Label, { children: "Available Sizes" }), _jsx("div", { className: "flex gap-2", children: _jsx(Input, { placeholder: "Enter size (e.g., 42, M, XL)", onKeyDown: (e) => {
                                                                                        if (e.key === 'Enter') {
                                                                                            e.preventDefault();
                                                                                            addSize(index, e.target.value);
                                                                                            e.target.value = '';
                                                                                        }
                                                                                    } }) }), variant.sizes.length > 0 && (_jsx("div", { className: "flex flex-wrap gap-2", children: variant.sizes.map((size, sizeIndex) => (_jsxs(Badge, { variant: "outline", className: "gap-1", children: [size, _jsx("button", { type: "button", onClick: () => removeSize(index, sizeIndex), className: "ml-1 hover:text-destructive", children: _jsx(X, { className: "w-3 h-3" }) })] }, sizeIndex))) }))] }), _jsx("div", { className: "md:col-span-2 space-y-2", children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("input", { type: "checkbox", checked: variant.isAvailable, onChange: (e) => updateVariant(index, 'isAvailable', e.target.checked), className: "rounded" }), _jsx(Label, { className: "cursor-pointer", children: "Available for sale" })] }) })] }), _jsx(Separator, {}), _jsxs("div", { className: "space-y-4", children: [_jsxs("h4", { className: "font-semibold flex items-center gap-2", children: [_jsx(ImageIcon, { className: "w-4 h-4" }), "Media"] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: "Thumbnail Image" }), _jsxs("div", { className: "flex items-center gap-4", children: [(variant.previewUrl || variant.imagePath) && (_jsx("img", { src: variant.previewUrl || variant.imagePath, alt: "Thumbnail", className: "w-20 h-20 object-cover rounded-lg border" })), _jsxs("label", { className: "flex-1", children: [_jsxs("div", { className: "border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary transition-colors", children: [_jsx(Upload, { className: "w-6 h-6 mx-auto mb-2 text-muted-foreground" }), _jsx("p", { className: "text-sm text-muted-foreground", children: "Click to upload thumbnail" }), _jsx("p", { className: "text-xs text-muted-foreground mt-1", children: "JPEG, PNG, WebP, AVIF, GIF" })] }), _jsx("input", { type: "file", accept: "image/jpeg,image/jpg,image/png,image/webp,image/avif,image/gif", onChange: (e) => {
                                                                                                    if (e.target.files?.[0]) {
                                                                                                        handleVariantImageSelect(index, e.target.files[0]);
                                                                                                    }
                                                                                                }, className: "hidden" })] })] })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: "Gallery Images" }), _jsxs("label", { children: [_jsxs("div", { className: "border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary transition-colors", children: [_jsx(Upload, { className: "w-6 h-6 mx-auto mb-2 text-muted-foreground" }), _jsx("p", { className: "text-sm text-muted-foreground", children: "Click to add gallery images" })] }), _jsx("input", { type: "file", accept: "image/jpeg,image/jpg,image/png,image/webp,image/avif,image/gif", multiple: true, onChange: (e) => {
                                                                                            if (e.target.files && e.target.files.length > 0) {
                                                                                                handleVariantGalleryImagesSelect(index, e.target.files);
                                                                                            }
                                                                                        }, className: "hidden" })] }), (variant.galleryPaths.length > 0 || variant.galleryPreviewUrls) && (_jsxs("div", { className: "grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2", children: [variant.galleryPaths.map((path, gIndex) => (_jsxs("div", { className: "relative group", children: [_jsx("img", { src: path, alt: `Gallery ${gIndex + 1}`, className: "w-full h-20 object-cover rounded-lg border" }), _jsx("button", { type: "button", onClick: () => removeGalleryImage(index, gIndex), className: "absolute top-1 right-1 p-1 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity", children: _jsx(X, { className: "w-3 h-3" }) })] }, `existing-${gIndex}`))), variant.galleryPreviewUrls?.map((url, pIndex) => (_jsxs("div", { className: "relative group", children: [_jsx("img", { src: url, alt: `New ${pIndex + 1}`, className: "w-full h-20 object-cover rounded-lg border border-primary" }), _jsx("button", { type: "button", onClick: () => removePendingGalleryImage(index, pIndex), className: "absolute top-1 right-1 p-1 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity", children: _jsx(X, { className: "w-3 h-3" }) })] }, `pending-${pIndex}`)))] }))] })] }), variants.length > 1 && (_jsxs(_Fragment, { children: [_jsx(Separator, {}), _jsxs(Button, { type: "button", variant: "destructive", size: "sm", onClick: () => deleteVariant(index), children: [_jsx(Trash2, { className: "w-4 h-4 mr-2" }), "Delete This Variant"] })] }))] }, index)))] }) })] })] }), _jsxs("div", { className: "space-y-6", children: [_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsxs(CardTitle, { className: "flex items-center gap-2", children: [validationErrors.length === 0 ? (_jsx(CheckCircle2, { className: "w-5 h-5 text-green-500" })) : (_jsx(AlertCircle, { className: "w-5 h-5 text-destructive" })), "Validation"] }) }), _jsx(CardContent, { children: validationErrors.length === 0 ? (_jsxs(Alert, { children: [_jsx(CheckCircle2, { className: "w-4 h-4" }), _jsx(AlertDescription, { children: "All required fields are filled. Ready to save!" })] })) : (_jsxs(Alert, { variant: "destructive", children: [_jsx(AlertCircle, { className: "w-4 h-4" }), _jsxs(AlertDescription, { children: [_jsxs("p", { className: "font-semibold mb-2", children: [validationErrors.length, " issue", validationErrors.length !== 1 ? 's' : '', " found:"] }), _jsx("ul", { className: "list-disc list-inside space-y-1 text-sm", children: validationErrors.map((error, index) => (_jsx("li", { children: error }, index))) })] })] })) })] }), _jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Preview" }), _jsx(CardDescription, { children: "How your product will appear" })] }), _jsxs(CardContent, { className: "space-y-4", children: [variants[0] && (variants[0].previewUrl || variants[0].imagePath) && (_jsx("div", { className: "aspect-square rounded-lg overflow-hidden bg-muted", children: _jsx("img", { src: variants[0].previewUrl || variants[0].imagePath, alt: "Preview", className: "w-full h-full object-cover" }) })), _jsxs("div", { children: [_jsx("h3", { className: "font-bold text-lg", children: watchedValues.title || 'Product Title' }), _jsx("p", { className: "text-sm text-muted-foreground", children: categories.find(c => c.id === watchedValues.categoryId)?.name || 'Category' }), _jsxs("p", { className: "text-sm text-muted-foreground mt-2", children: [variants.length, " variant", variants.length !== 1 ? 's' : ''] }), _jsx("p", { className: "text-sm text-muted-foreground", children: isPublished ? 'Published' : 'Draft' }), _jsxs("p", { className: "text-2xl font-bold text-primary mt-2", children: ["$", variants[0]?.price || '0.00'] })] }), features.length > 0 && (_jsxs("div", { className: "space-y-1", children: [_jsx("p", { className: "text-sm font-semibold", children: "Features:" }), _jsxs("ul", { className: "list-disc list-inside text-sm text-muted-foreground", children: [features.slice(0, 3).map((feature, index) => (_jsx("li", { children: feature }, index))), features.length > 3 && (_jsxs("li", { children: ["+", features.length - 3, " more"] }))] })] }))] })] }), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Quick Stats" }) }), _jsxs(CardContent, { className: "space-y-2 text-sm", children: [_jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-muted-foreground", children: "Variants:" }), _jsx("span", { className: "font-semibold", children: variants.length })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-muted-foreground", children: "Total Stock:" }), _jsx("span", { className: "font-semibold", children: variants.reduce((sum, v) => sum + parseInt(v.stock || '0'), 0) })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-muted-foreground", children: "Features:" }), _jsx("span", { className: "font-semibold", children: features.length })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-muted-foreground", children: "Price Range:" }), _jsxs("span", { className: "font-semibold", children: ["$", Math.min(...variants.map(v => parseFloat(v.price || '0'))).toFixed(2), " - $", Math.max(...variants.map(v => parseFloat(v.price || '0'))).toFixed(2)] })] })] })] })] })] }) }), _jsx("div", { className: "fixed bottom-0 left-0 right-0 z-20 border-t bg-background/95 px-4 py-3 backdrop-blur-sm sm:px-6", children: _jsxs("div", { className: "mx-auto flex max-w-7xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between", children: [_jsx("div", { className: "text-xs sm:text-sm text-muted-foreground", children: validationErrors.length === 0 ? (_jsxs("span", { className: "text-green-600 flex items-center gap-2", children: [_jsx(CheckCircle2, { className: "w-4 h-4" }), "Ready to save"] })) : (_jsxs("span", { className: "text-destructive flex items-center gap-2", children: [_jsx(AlertCircle, { className: "w-4 h-4" }), validationErrors.length, " validation error", validationErrors.length !== 1 ? 's' : ''] })) }), _jsxs("div", { className: "grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:grid-cols-none sm:flex-row sm:gap-3", children: [_jsx(Button, { type: "button", variant: "outline", onClick: () => navigate('/products'), disabled: submitting, className: "w-full sm:w-auto", children: "Cancel" }), _jsx(Button, { type: "submit", disabled: submitting || validationErrors.length > 0, className: "w-full sm:w-auto", children: submitting ? (_jsxs(_Fragment, { children: [_jsx(Loader2, { className: "w-4 h-4 mr-2 animate-spin" }), "Saving..."] })) : (_jsx(_Fragment, { children: isEditMode ? 'Update Product' : 'Create Product' })) })] })] }) })] }));
}
