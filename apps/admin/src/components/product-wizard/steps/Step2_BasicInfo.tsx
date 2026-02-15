import { useState, useEffect } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { WizardFormData } from '@/hooks/useProductWizard';
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
import { Plus, X } from 'lucide-react';
import { api } from '@/lib/api';

type Category = {
  id: string;
  name: string;
  slug: string;
};

type Step2_BasicInfoProps = {
  form: UseFormReturn<WizardFormData>;
};

export function Step2_BasicInfo({ form }: Step2_BasicInfoProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [featureInput, setFeatureInput] = useState('');
  const [benefitInput, setBenefitInput] = useState('');
  const [detailInput, setDetailInput] = useState('');

  const features = form.watch('features') || [];
  const benefits = form.watch('benefits') || [];
  const productDetails = form.watch('productDetails') || [];
  const title = form.watch('title');

  useEffect(() => {
    // Load categories
    api
      .get('/admin/categories')
      .then(({ data }) => setCategories(data.categories || []))
      .catch((error) => console.error('Failed to load categories:', error));
  }, []);

  const generateSlug = () => {
    if (!title) return;
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
    form.setValue('slug', slug, { shouldValidate: true });
  };

  const addFeature = () => {
    if (featureInput.trim()) {
      form.setValue('features', [...features, featureInput.trim()], { shouldValidate: true });
      setFeatureInput('');
    }
  };

  const removeFeature = (index: number) => {
    form.setValue(
      'features',
      features.filter((_, i) => i !== index),
      { shouldValidate: true }
    );
  };

  const addBenefit = () => {
    if (benefitInput.trim()) {
      form.setValue('benefits', [...benefits, benefitInput.trim()], { shouldValidate: true });
      setBenefitInput('');
    }
  };

  const removeBenefit = (index: number) => {
    form.setValue(
      'benefits',
      benefits.filter((_, i) => i !== index),
      { shouldValidate: true }
    );
  };

  const addDetail = () => {
    if (detailInput.trim()) {
      form.setValue('productDetails', [...productDetails, detailInput.trim()], { shouldValidate: true });
      setDetailInput('');
    }
  };

  const removeDetail = (index: number) => {
    form.setValue(
      'productDetails',
      productDetails.filter((_, i) => i !== index),
      { shouldValidate: true }
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Basic Information</CardTitle>
        <CardDescription>Product name, description, and categorization</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2 space-y-2">
            <Label htmlFor="title">Product Title *</Label>
            <Input
              id="title"
              {...form.register('title')}
              placeholder="DTF Transfer - Custom Design"
              className={form.formState.errors.title ? 'border-destructive' : ''}
            />
            {form.formState.errors.title && (
              <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>
            )}
          </div>

          <div className="md:col-span-2 space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="slug">URL Slug *</Label>
              <Button type="button" variant="link" size="sm" onClick={generateSlug}>
                Generate from title
              </Button>
            </div>
            <Input
              id="slug"
              {...form.register('slug')}
              placeholder="dtf-transfer-custom-design"
              className={form.formState.errors.slug ? 'border-destructive' : ''}
            />
            {form.formState.errors.slug && (
              <p className="text-sm text-destructive">{form.formState.errors.slug.message}</p>
            )}
          </div>

          <div className="md:col-span-2 space-y-2">
            <Label htmlFor="categoryId">Category *</Label>
            <Select
              value={form.watch('categoryId')}
              onValueChange={(value) => form.setValue('categoryId', value, { shouldValidate: true })}
            >
              <SelectTrigger className={form.formState.errors.categoryId ? 'border-destructive' : ''}>
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
            {form.formState.errors.categoryId && (
              <p className="text-sm text-destructive">{form.formState.errors.categoryId.message}</p>
            )}
          </div>

          <div className="md:col-span-2 space-y-2">
            <Label htmlFor="subtitle">Subtitle</Label>
            <Input
              id="subtitle"
              {...form.register('subtitle')}
              placeholder="Quick tagline or subtitle"
            />
          </div>

          <div className="md:col-span-2 space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              {...form.register('description')}
              placeholder="Detailed product description..."
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="basePrice">Base Price</Label>
            <Input
              id="basePrice"
              type="number"
              step="0.01"
              {...form.register('basePrice')}
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
              {...form.register('rating')}
              placeholder="0.0"
            />
          </div>

          <div className="md:col-span-2 space-y-2">
            <Label htmlFor="reviews">Reviews Count</Label>
            <Input
              id="reviews"
              type="number"
              {...form.register('reviews')}
              placeholder="0"
            />
          </div>

          <div className="md:col-span-2">
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

        <div className="space-y-2">
          <Label>Benefits</Label>
          <div className="flex gap-2">
            <Input
              value={benefitInput}
              onChange={(e) => setBenefitInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addBenefit();
                }
              }}
              placeholder="Add a benefit..."
            />
            <Button type="button" onClick={addBenefit} variant="secondary">
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          {benefits.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {benefits.map((benefit, index) => (
                <Badge key={index} variant="secondary" className="gap-1">
                  {benefit}
                  <button
                    type="button"
                    onClick={() => removeBenefit(index)}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="w-3 h-3" />
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
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addDetail();
                }
              }}
              placeholder="Add a product detail..."
            />
            <Button type="button" onClick={addDetail} variant="secondary">
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          {productDetails.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {productDetails.map((detail, index) => (
                <Badge key={index} variant="secondary" className="gap-1">
                  {detail}
                  <button
                    type="button"
                    onClick={() => removeDetail(index)}
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
  );
}
