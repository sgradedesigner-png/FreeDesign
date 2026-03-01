import { useEffect, useMemo, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import type { WizardFormData } from '@/hooks/useProductWizard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Check, ChevronDown, ChevronRight, Plus, X } from 'lucide-react';
import { api } from '@/lib/api';

type Category = {
  id: string;
  name: string;
  slug: string;
};

type Step2_BasicInfoProps = {
  form: UseFormReturn<WizardFormData>;
};

function makeSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

export function Step2_BasicInfo({ form }: Step2_BasicInfoProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [featureInput, setFeatureInput] = useState('');
  const [benefitInput, setBenefitInput] = useState('');
  const [detailInput, setDetailInput] = useState('');
  const [slugMode, setSlugMode] = useState<'auto' | 'manual'>('auto');
  const [showOptional, setShowOptional] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showContentBlocks, setShowContentBlocks] = useState(false);

  const features = form.watch('features') || [];
  const benefits = form.watch('benefits') || [];
  const productDetails = form.watch('productDetails') || [];
  const title = form.watch('title') || '';
  const description = form.watch('description') || '';

  const titleError = form.formState.errors.title;
  const slugError = form.formState.errors.slug;
  const categoryError = form.formState.errors.categoryId;
  const basePriceError = form.formState.errors.basePrice;
  const touchedFields = form.formState.touchedFields;

  const showTitleError = Boolean(titleError && touchedFields.title);
  const showSlugError = Boolean(slugError && touchedFields.slug);
  const showCategoryError = Boolean(categoryError && touchedFields.categoryId);
  const showBasePriceError = Boolean(basePriceError && touchedFields.basePrice);

  useEffect(() => {
    api
      .get('/admin/categories')
      .then(({ data }) => setCategories(Array.isArray(data) ? data : (data.categories || [])))
      .catch((error) => console.error('Failed to load categories:', error));
  }, []);

  useEffect(() => {
    if (slugMode !== 'auto') return;
    form.setValue('slug', makeSlug(title), { shouldValidate: true, shouldDirty: true });
  }, [slugMode, title, form]);

  const slugStatusText = useMemo(
    () => (slugMode === 'auto' ? 'Auto from title' : 'Manual'),
    [slugMode]
  );

  const addFeature = () => {
    if (!featureInput.trim()) return;
    form.setValue('features', [...features, featureInput.trim()], { shouldValidate: true });
    setFeatureInput('');
  };

  const removeFeature = (index: number) => {
    form.setValue(
      'features',
      features.filter((_, i) => i !== index),
      { shouldValidate: true }
    );
  };

  const addBenefit = () => {
    if (!benefitInput.trim()) return;
    form.setValue('benefits', [...benefits, benefitInput.trim()], { shouldValidate: true });
    setBenefitInput('');
  };

  const removeBenefit = (index: number) => {
    form.setValue(
      'benefits',
      benefits.filter((_, i) => i !== index),
      { shouldValidate: true }
    );
  };

  const addDetail = () => {
    if (!detailInput.trim()) return;
    form.setValue('productDetails', [...productDetails, detailInput.trim()], { shouldValidate: true });
    setDetailInput('');
  };

  const removeDetail = (index: number) => {
    form.setValue(
      'productDetails',
      productDetails.filter((_, i) => i !== index),
      { shouldValidate: true }
    );
  };

  const addOnEnter = (
    e: KeyboardEvent<HTMLInputElement>,
    handler: () => void
  ) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    handler();
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Basic Information</CardTitle>
        <CardDescription>
          Fill required fields first. Optional metadata can be added later.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">Required</span>
            <Badge variant="outline" className="text-xs">Core fields</Badge>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Product Title *</Label>
            <Input
              id="title"
              {...form.register('title')}
              placeholder="DTF Transfer - Custom Design"
              className={showTitleError ? 'border-destructive' : ''}
            />
            {showTitleError ? (
              <p className="text-sm text-destructive">{titleError?.message}</p>
            ) : (
              <p className="text-xs text-muted-foreground">Displayed across storefront and SEO.</p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="slug">URL Slug *</Label>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">{slugStatusText}</Badge>
                {slugMode === 'auto' ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setSlugMode('manual')}
                  >
                    Edit
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSlugMode('auto');
                      form.setValue('slug', makeSlug(title), { shouldValidate: true, shouldDirty: true });
                    }}
                  >
                    <Check className="mr-1 h-3 w-3" />
                    Auto
                  </Button>
                )}
              </div>
            </div>
            <Input
              id="slug"
              {...form.register('slug')}
              readOnly={slugMode === 'auto'}
              className={showSlugError ? 'border-destructive' : ''}
              placeholder="dtf-transfer-custom-design"
            />
            {showSlugError ? (
              <p className="text-sm text-destructive">{slugError?.message}</p>
            ) : (
              <p className="text-xs text-muted-foreground">Used in product URL path.</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="categoryId">Category *</Label>
            <Select
              value={form.watch('categoryId')}
              onValueChange={(value) =>
                form.setValue('categoryId', value, { shouldValidate: true, shouldTouch: true })
              }
            >
              <SelectTrigger className={showCategoryError ? 'border-destructive' : ''}>
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
            {showCategoryError ? (
              <p className="text-sm text-destructive">{categoryError?.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="basePrice">Base Price *</Label>
            <div
              className={`flex items-center rounded-md border bg-background ${
                showBasePriceError ? 'border-destructive' : 'border-input'
              }`}
            >
              <span className="px-3 text-sm text-muted-foreground">MNT</span>
              <Input
                id="basePrice"
                type="number"
                step="0.01"
                {...form.register('basePrice')}
                className="border-0 shadow-none focus-visible:ring-0"
                placeholder="0.00"
              />
            </div>
            {showBasePriceError ? (
              <p className="text-sm text-destructive">{basePriceError?.message}</p>
            ) : null}
          </div>
        </section>

        <Separator />

        <section className="space-y-3">
          <button
            type="button"
            onClick={() => setShowOptional((prev) => !prev)}
            className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-left"
          >
            <span className="text-sm font-medium">Optional</span>
            {showOptional ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
          {showOptional && (
            <div className="space-y-4 rounded-md border p-3">
              <div className="space-y-2">
                <Label htmlFor="subtitle">Subtitle</Label>
                <Input
                  id="subtitle"
                  {...form.register('subtitle')}
                  placeholder="Quick tagline or subtitle"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  {...form.register('description')}
                  placeholder="Detailed product description..."
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">{description.length}/500</p>
              </div>
            </div>
          )}
        </section>

        <section className="space-y-3">
          <button
            type="button"
            onClick={() => setShowAdvanced((prev) => !prev)}
            className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-left"
          >
            <span className="text-sm font-medium">Advanced</span>
            {showAdvanced ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
          {showAdvanced && (
            <div className="space-y-4 rounded-md border p-3">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="rating">Rating (0-5)</Label>
                  <Input
                    id="rating"
                    type="number"
                    step="0.1"
                    min="0"
                    max="5"
                    {...form.register('rating')}
                    placeholder="0.0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reviews">Reviews Count</Label>
                  <Input
                    id="reviews"
                    type="number"
                    {...form.register('reviews')}
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <Label htmlFor="is-published">Published</Label>
                  <p className="text-xs text-muted-foreground">
                    Make this product visible in the store
                  </p>
                </div>
                <input
                  id="is-published"
                  type="checkbox"
                  checked={form.watch('isPublished')}
                  onChange={(e) => form.setValue('isPublished', e.target.checked, { shouldValidate: true })}
                  className="h-5 w-5 rounded border-border"
                />
              </div>
            </div>
          )}
        </section>

        <section className="space-y-3">
          <button
            type="button"
            onClick={() => setShowContentBlocks((prev) => !prev)}
            className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-left"
          >
            <span className="text-sm font-medium">Content Blocks</span>
            {showContentBlocks ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
          {showContentBlocks && (
            <div className="space-y-4 rounded-md border p-3">
              <div className="space-y-2">
                <Label>Features & Highlights</Label>
                <div className="flex gap-2">
                  <Input
                    value={featureInput}
                    onChange={(e) => setFeatureInput(e.target.value)}
                    onKeyDown={(e) => addOnEnter(e, addFeature)}
                    placeholder="Add a feature..."
                  />
                  <Button type="button" onClick={addFeature} variant="secondary">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {features.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {features.map((feature, index) => (
                      <Badge key={index} variant="secondary" className="gap-1">
                        {feature}
                        <button
                          type="button"
                          onClick={() => removeFeature(index)}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Benefits</Label>
                <div className="flex gap-2">
                  <Input
                    value={benefitInput}
                    onChange={(e) => setBenefitInput(e.target.value)}
                    onKeyDown={(e) => addOnEnter(e, addBenefit)}
                    placeholder="Add a benefit..."
                  />
                  <Button type="button" onClick={addBenefit} variant="secondary">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {benefits.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {benefits.map((benefit, index) => (
                      <Badge key={index} variant="secondary" className="gap-1">
                        {benefit}
                        <button
                          type="button"
                          onClick={() => removeBenefit(index)}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Product Details</Label>
                <div className="flex gap-2">
                  <Input
                    value={detailInput}
                    onChange={(e) => setDetailInput(e.target.value)}
                    onKeyDown={(e) => addOnEnter(e, addDetail)}
                    placeholder="Add a product detail..."
                  />
                  <Button type="button" onClick={addDetail} variant="secondary">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {productDetails.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {productDetails.map((detail, index) => (
                      <Badge key={index} variant="secondary" className="gap-1">
                        {detail}
                        <button
                          type="button"
                          onClick={() => removeDetail(index)}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </CardContent>
    </Card>
  );
}
