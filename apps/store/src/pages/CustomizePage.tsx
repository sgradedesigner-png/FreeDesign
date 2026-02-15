import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { env } from '@/lib/env';
import { Sentry } from '@/lib/sentry';
import { uploadCustomizationDesignSigned } from '@/lib/cloudinaryUpload';
import { useProductQuery } from '@/data/products.queries';
import { imageUrl } from '@/lib/imageUrl';
import { useCart } from '@/context/CartContext';
import { useTheme } from '@/context/ThemeContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import DesignUploader, { type UploadedDesignAsset } from '@/components/customize/DesignUploader';
import PlacementSelector, { type PrintAreaOption } from '@/components/customize/PlacementSelector';
import SizeTierSelector, { type PrintSizeTierOption } from '@/components/customize/SizeTierSelector';
import PriceBreakdown, { type CustomizationPriceBreakdown } from '@/components/customize/PriceBreakdown';
import CanvasEditor, { type CanvasPlacementConfig } from '@/components/customize/CanvasEditor';
import AutoMockupPreview from '@/components/customize/AutoMockupPreview';
import AddOnSelector, { type AddOnOption } from '@/components/customize/AddOnSelector';

type CustomizationOptionsResponse = {
  variantId: string;
  productId: string;
  isCustomizable: boolean;
  printAreas: PrintAreaOption[];
  printSizeTiers: PrintSizeTierOption[];
  addOnOptions: AddOnOption[];
};

type MockupPreviewResponse = {
  previewUrl: string;
};

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

const DEFAULT_CANVAS_PLACEMENT: CanvasPlacementConfig = {
  offsetX: 0,
  offsetY: 0,
  rotation: 0,
  scale: 1,
};

export default function CustomizePage() {
  const params = useParams<{ productSlug: string }>();
  const productSlug = params.productSlug || '';
  const navigate = useNavigate();
  const { language } = useTheme();
  const { addCustomizedItem } = useCart();

  const { data: product, isLoading, error } = useProductQuery(productSlug);
  useEffect(() => {
    if (product?.productFamily) {
      Sentry.setTag('product_family', product.productFamily);
    }
  }, [product?.productFamily]);

  const [selectedVariantId, setSelectedVariantId] = useState<string>('');
  const selectedVariant = useMemo(
    () => product?.variants?.find((variant) => variant.id === selectedVariantId) ?? product?.variants?.[0] ?? null,
    [product, selectedVariantId]
  );

  const [optionsLoading, setOptionsLoading] = useState(false);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [isCustomizable, setIsCustomizable] = useState(false);
  const [printAreas, setPrintAreas] = useState<PrintAreaOption[]>([]);
  const [sizeTiers, setSizeTiers] = useState<PrintSizeTierOption[]>([]);
  const [addOnOptions, setAddOnOptions] = useState<AddOnOption[]>([]);

  const [selectedAreaIds, setSelectedAreaIds] = useState<string[]>([]);
  const [selectedSizeTierByArea, setSelectedSizeTierByArea] = useState<Record<string, string>>({});
  const [activeAreaId, setActiveAreaId] = useState<string | null>(null);
  const [placementByArea, setPlacementByArea] = useState<Record<string, CanvasPlacementConfig>>({});
  const [selectedAddOnIds, setSelectedAddOnIds] = useState<string[]>([]);

  const [quantity, setQuantity] = useState(1);
  const [rushOrder, setRushOrder] = useState(false);

  const [asset, setAsset] = useState<UploadedDesignAsset | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoteBreakdown, setQuoteBreakdown] = useState<CustomizationPriceBreakdown | null>(null);

  const [mockupPreviewUrl, setMockupPreviewUrl] = useState<string | null>(null);
  const [mockupPreviewLoading, setMockupPreviewLoading] = useState(false);
  const [mockupPreviewError, setMockupPreviewError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedVariant?.id) return;
    setSelectedVariantId(selectedVariant.id);
  }, [selectedVariant?.id]);

  useEffect(() => {
    const loadOptions = async () => {
      if (!selectedVariant?.id) return;

      setOptionsLoading(true);
      setOptionsError(null);
      setQuoteBreakdown(null);

      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/api/customization/options?variantId=${selectedVariant.id}`
        );

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error || 'Failed to load customization options');
        }

        const payload = data as CustomizationOptionsResponse;
        setIsCustomizable(Boolean(payload.isCustomizable));
        setPrintAreas(payload.printAreas ?? []);
        setSizeTiers(payload.printSizeTiers ?? []);
        setAddOnOptions(payload.addOnOptions ?? []);
        setSelectedAddOnIds((prev) => {
          const available = new Set((payload.addOnOptions ?? []).map((option) => option.id));
          return prev.filter((id) => available.has(id));
        });

        if (!payload.isCustomizable) {
          setSelectedAreaIds([]);
          setSelectedSizeTierByArea({});
          setActiveAreaId(null);
          setPlacementByArea({});
          setSelectedAddOnIds([]);
          return;
        }

        const defaultAreas = (payload.printAreas ?? []).filter((area) => area.isDefault);
        const initialAreas = defaultAreas.length > 0
          ? defaultAreas.map((area) => area.id)
          : payload.printAreas.slice(0, 1).map((area) => area.id);

        setSelectedAreaIds(initialAreas);
        setActiveAreaId((prev) => (
          prev && initialAreas.includes(prev) ? prev : (initialAreas[0] ?? null)
        ));
        setSelectedSizeTierByArea((prev) => {
          const next: Record<string, string> = {};
          const fallbackTierId = payload.printSizeTiers?.[0]?.id || '';

          for (const areaId of initialAreas) {
            next[areaId] = prev[areaId] || fallbackTierId;
          }

          return next;
        });
        setPlacementByArea((prev) => {
          const next: Record<string, CanvasPlacementConfig> = {};
          for (const areaId of initialAreas) {
            if (prev[areaId]) {
              next[areaId] = prev[areaId];
            }
          }
          return next;
        });
      } catch (err: any) {
        setOptionsError(err?.message || 'Failed to load customization options');
      } finally {
        setOptionsLoading(false);
      }
    };

    loadOptions();
  }, [selectedVariant?.id]);

  useEffect(() => {
    setActiveAreaId((prev) => (
      prev && selectedAreaIds.includes(prev) ? prev : (selectedAreaIds[0] ?? null)
    ));

    setPlacementByArea((prev) => {
      const selectedSet = new Set(selectedAreaIds);
      let changed = false;
      const next: Record<string, CanvasPlacementConfig> = {};

      for (const [areaId, placement] of Object.entries(prev)) {
        if (selectedSet.has(areaId)) {
          next[areaId] = placement;
        } else {
          changed = true;
        }
      }

      return changed ? next : prev;
    });
  }, [selectedAreaIds]);

  useEffect(() => {
    setSelectedAddOnIds((prev) => prev.filter((addOnId) => {
      const option = addOnOptions.find((item) => item.id === addOnId);
      if (!option) return false;

      const minOk = option.minQuantity == null || quantity >= option.minQuantity;
      const maxOk = option.maxQuantity == null || quantity <= option.maxQuantity;
      return minOk && maxOk;
    }));
  }, [addOnOptions, quantity]);

  const selectedAreas = useMemo(
    () => printAreas.filter((area) => selectedAreaIds.includes(area.id)),
    [printAreas, selectedAreaIds]
  );

  const activeArea = useMemo(
    () => selectedAreas.find((area) => area.id === activeAreaId) ?? null,
    [selectedAreas, activeAreaId]
  );

  const activePlacement = useMemo(
    () => (activeAreaId ? placementByArea[activeAreaId] ?? DEFAULT_CANVAS_PLACEMENT : DEFAULT_CANVAS_PLACEMENT),
    [activeAreaId, placementByArea]
  );

  const activeSizeTierId = useMemo(
    () => (activeAreaId ? selectedSizeTierByArea[activeAreaId] || '' : ''),
    [activeAreaId, selectedSizeTierByArea]
  );

  const handlePlacementChange = useCallback((printAreaId: string, placement: CanvasPlacementConfig) => {
    setPlacementByArea((prev) => {
      const current = prev[printAreaId];
      if (
        current &&
        current.offsetX === placement.offsetX &&
        current.offsetY === placement.offsetY &&
        current.rotation === placement.rotation &&
        current.scale === placement.scale
      ) {
        return prev;
      }

      return { ...prev, [printAreaId]: placement };
    });
  }, []);

  const selectedCustomizationsForQuote = useMemo(
    () =>
      selectedAreaIds
        .map((printAreaId) => ({
          printAreaId,
          printSizeTierId: selectedSizeTierByArea[printAreaId] || '',
        }))
        .filter((item) => item.printSizeTierId),
    [selectedAreaIds, selectedSizeTierByArea]
  );

  useEffect(() => {
    if (!asset?.id || !selectedVariant?.id || !activeAreaId || !isCustomizable) {
      setMockupPreviewLoading(false);
      setMockupPreviewError(null);
      setMockupPreviewUrl(null);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    const timer = window.setTimeout(() => {
      const renderPreview = async () => {
        setMockupPreviewLoading(true);
        setMockupPreviewError(null);

        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.access_token) {
            if (!cancelled) {
              setMockupPreviewLoading(false);
            }
            return;
          }

          const response = await fetch(`${import.meta.env.VITE_API_URL}/api/customization/mockup-preview`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              variantId: selectedVariant.id,
              printAreaId: activeAreaId,
              printSizeTierId: activeSizeTierId || undefined,
              assetId: asset.id,
              placementConfig: activePlacement,
            }),
            signal: controller.signal,
          });

          const data = await response.json();
          if (!response.ok) {
            throw new Error(data?.error || 'Failed to render mockup preview');
          }

          if (!cancelled) {
            const payload = data as MockupPreviewResponse;
            setMockupPreviewUrl(payload.previewUrl || null);
          }
        } catch (err: any) {
          if (cancelled || controller.signal.aborted) return;
          setMockupPreviewError(err?.message || 'Failed to render mockup preview');
        } finally {
          if (!cancelled) {
            setMockupPreviewLoading(false);
          }
        }
      };

      void renderPreview();
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [
    asset?.id,
    selectedVariant?.id,
    activeAreaId,
    activeSizeTierId,
    activePlacement.offsetX,
    activePlacement.offsetY,
    activePlacement.rotation,
    activePlacement.scale,
    isCustomizable,
  ]);

  const canRequestQuote =
    Boolean(selectedVariant?.id) &&
    selectedAreaIds.length > 0 &&
    selectedCustomizationsForQuote.length === selectedAreaIds.length;

  const canAddToCart =
    Boolean(asset?.id) &&
    Boolean(quoteBreakdown) &&
    canRequestQuote &&
    Boolean(selectedVariant?.id) &&
    isCustomizable;

  const requestAuthSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) return session;

    toast.error(language === 'en' ? 'Please login to continue' : 'ÐÑÐ²Ñ‚ÑÑ€Ñ‡ Ð¾Ñ€Ð½Ð¾ ÑƒÑƒ');
    const returnTo = encodeURIComponent(window.location.pathname);
    navigate(`/login?returnTo=${returnTo}`);
    return null;
  };

  const handleUploadDesign = async (file: File) => {
    const session = await requestAuthSession();
    if (!session) return;

    setUploading(true);
    setUploadError(null);

    try {
      if (env.FF_UPLOAD_ASYNC_VALIDATION_V1) {
        const uploaded = await uploadCustomizationDesignSigned({
          file,
          accessToken: session.access_token,
          apiBase: import.meta.env.VITE_API_URL,
        });

        setAsset(uploaded as UploadedDesignAsset);
      } else {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/customization/upload-design`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          body: formData,
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error || 'Failed to upload design');
        }

        setAsset(data.asset as UploadedDesignAsset);
      }
      toast.success(language === 'en' ? 'Design uploaded' : 'Ð”Ð¸Ð·Ð°Ð¹Ð½ Ð°Ð¼Ð¶Ð¸Ð»Ñ‚Ñ‚Ð°Ð¹ Ð¾Ñ€Ð»Ð¾Ð¾');
    } catch (err: any) {
      setUploadError(err?.message || 'Failed to upload design');
    } finally {
      setUploading(false);
    }
  };

  const handleRequestQuote = async () => {
    if (!canRequestQuote || !selectedVariant?.id) return;

    const session = await requestAuthSession();
    if (!session) return;

    setQuoteLoading(true);
    setQuoteError(null);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/customization/price-quote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          variantId: selectedVariant.id,
          customizations: selectedCustomizationsForQuote,
          addOnIds: selectedAddOnIds,
          quantity,
          rushOrder,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to calculate quote');
      }

      setQuoteBreakdown(data.breakdown as CustomizationPriceBreakdown);
      toast.success(language === 'en' ? 'Price quote updated' : 'Ò®Ð½Ð¸Ð¹Ð½ Ñ‚Ð¾Ð¾Ñ†Ð¾Ð¾ ÑˆÐ¸Ð½ÑÑ‡Ð»ÑÐ³Ð´Ð»ÑÑ');
    } catch (err: any) {
      setQuoteError(err?.message || 'Failed to calculate quote');
    } finally {
      setQuoteLoading(false);
    }
  };

  const handleAddCustomizedItem = () => {
    if (!product || !selectedVariant || !asset || !quoteBreakdown) return;

    const printFeeMap = new Map(
      quoteBreakdown.printFees.map((line) => [`${line.printAreaId}:${line.printSizeTierId}`, line.fee])
    );

    const areaMap = new Map(printAreas.map((area) => [area.id, area]));
    const tierMap = new Map(sizeTiers.map((tier) => [tier.id, tier]));

    const customizations = selectedCustomizationsForQuote.map((item) => {
      const area = areaMap.get(item.printAreaId);
      const tier = tierMap.get(item.printSizeTierId);
      const printFee = printFeeMap.get(`${item.printAreaId}:${item.printSizeTierId}`) ?? 0;
      const placementConfig = placementByArea[item.printAreaId] ?? DEFAULT_CANVAS_PLACEMENT;

      return {
        printAreaId: item.printAreaId,
        printAreaLabel: area?.label || item.printAreaId,
        printSizeTierId: item.printSizeTierId,
        printSizeTierLabel: tier?.label || item.printSizeTierId,
        assetId: asset.id,
        assetOriginalUrl: asset.originalUrl,
        assetThumbnailUrl: asset.thumbnailUrl,
        printFee,
        placementConfig,
      };
    });

    const addOns = quoteBreakdown.addOnFee.lines.map((line) => ({
      id: line.id,
      name: line.name,
      fee: line.fee,
    }));

    const unitPrice = roundCurrency(quoteBreakdown.grandTotal / Math.max(1, quantity));

    addCustomizedItem({
      product,
      variant: selectedVariant,
      quantity,
      unitPrice,
      customizations,
      addOns,
      rushOrder,
      rushFee: quoteBreakdown.rushFee,
      addOnFees: quoteBreakdown.addOnFee.total,
    });

    navigate('/cart');
  };

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8 pt-28">
        <p className="text-destructive">
          {error instanceof Error ? error.message : 'Failed to load product'}
        </p>
      </div>
    );
  }

  if (isLoading || !product || !selectedVariant) {
    return (
      <div className="container mx-auto px-4 py-8 pt-28">
        <div className="flex items-center text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading customization page...
        </div>
      </div>
    );
  }

  const baseImage =
    imageUrl(product.mockupImagePath || selectedVariant.imagePath || product.image_path) ||
    null;

  return (
    <div className="container mx-auto px-4 py-8 pt-28 pb-16">
      <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Link to={`/product/${product.slug}`} className="inline-flex items-center gap-1 hover:text-primary">
          <ArrowLeft className="h-4 w-4" />
          Back to product
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold sm:text-3xl">{product.name} Customizer</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure print areas, upload artwork, and add a DTF custom item to cart.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.05fr,1fr]">
        <div className="space-y-4">
          <DesignUploader
            asset={asset}
            uploading={uploading}
            error={uploadError}
            onFileSelected={handleUploadDesign}
            onClear={() => setAsset(null)}
          />

          <CanvasEditor
            productName={product.name}
            baseImage={baseImage}
            designImage={asset?.originalUrl || asset?.thumbnailUrl || null}
            selectedAreas={selectedAreas}
            activeAreaId={activeAreaId}
            placementsByArea={placementByArea}
            onActiveAreaChange={setActiveAreaId}
            onPlacementChange={handlePlacementChange}
          />

          <AutoMockupPreview
            previewUrl={mockupPreviewUrl}
            fallbackUrl={baseImage}
            loading={mockupPreviewLoading}
            error={mockupPreviewError}
            activeAreaLabel={activeArea?.label || null}
          />
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-border p-4">
            <Label className="mb-2 block">Variant</Label>
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={selectedVariant.id}
              onChange={(event) => {
                setSelectedVariantId(event.target.value);
                setQuoteBreakdown(null);
              }}
            >
              {product.variants.map((variant) => (
                <option key={variant.id} value={variant.id}>
                  {variant.name}
                </option>
              ))}
            </select>
          </div>

          {optionsLoading ? (
            <div className="rounded-xl border border-border p-4 text-sm text-muted-foreground">
              <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
              Loading print options...
            </div>
          ) : optionsError ? (
            <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
              {optionsError}
            </div>
          ) : !isCustomizable ? (
            <div className="rounded-xl border border-border p-4 text-sm text-muted-foreground">
              This product variant is currently not configurable for DTF printing.
            </div>
          ) : (
            <>
              <PlacementSelector
                printAreas={printAreas}
                selectedAreaIds={selectedAreaIds}
                onToggleArea={(printAreaId) => {
                  setQuoteBreakdown(null);
                  if (selectedAreaIds.includes(printAreaId)) {
                    const remainingAreaIds = selectedAreaIds.filter((id) => id !== printAreaId);
                    setSelectedAreaIds(remainingAreaIds);
                    setSelectedSizeTierByArea((prev) => {
                      const next = { ...prev };
                      delete next[printAreaId];
                      return next;
                    });
                    setPlacementByArea((prev) => {
                      const next = { ...prev };
                      delete next[printAreaId];
                      return next;
                    });
                    setActiveAreaId((prev) => (
                      prev === printAreaId ? (remainingAreaIds[0] ?? null) : prev
                    ));
                    return;
                  }

                  setSelectedAreaIds((prev) => [...prev, printAreaId]);
                  setSelectedSizeTierByArea((prev) => {
                    if (prev[printAreaId]) return prev;
                    const defaultTierId = sizeTiers[0]?.id || '';
                    return defaultTierId ? { ...prev, [printAreaId]: defaultTierId } : prev;
                  });
                  setActiveAreaId((prev) => prev ?? printAreaId);
                }}
              />

              <SizeTierSelector
                selectedAreaIds={selectedAreaIds}
                printAreas={printAreas}
                sizeTiers={sizeTiers}
                selectedSizeTierByArea={selectedSizeTierByArea}
                onSelectSizeTier={(printAreaId, printSizeTierId) => {
                  setQuoteBreakdown(null);
                  setSelectedSizeTierByArea((prev) => ({ ...prev, [printAreaId]: printSizeTierId }));
                }}
              />

              <AddOnSelector
                quantity={quantity}
                addOnOptions={addOnOptions}
                selectedAddOnIds={selectedAddOnIds}
                onToggle={(addOnId) => {
                  setQuoteBreakdown(null);
                  setSelectedAddOnIds((prev) => (
                    prev.includes(addOnId)
                      ? prev.filter((id) => id !== addOnId)
                      : [...prev, addOnId]
                  ));
                }}
              />
            </>
          )}

          <div className="grid gap-4 rounded-xl border border-border p-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="customize-qty" className="mb-2 block">Quantity</Label>
              <Input
                id="customize-qty"
                type="number"
                min={1}
                max={1000}
                value={quantity}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  setQuantity(Number.isFinite(next) ? Math.max(1, Math.round(next)) : 1);
                  setQuoteBreakdown(null);
                }}
              />
            </div>

            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={rushOrder}
                  onChange={(event) => {
                    setRushOrder(event.target.checked);
                    setQuoteBreakdown(null);
                  }}
                />
                Rush order
              </label>
            </div>
          </div>

          <PriceBreakdown
            breakdown={quoteBreakdown}
            loading={quoteLoading}
            error={quoteError}
            quantity={quantity}
            rushOrder={rushOrder}
            onRequestQuote={handleRequestQuote}
          />

          <Button
            type="button"
            className="w-full"
            size="lg"
            disabled={!canAddToCart}
            onClick={handleAddCustomizedItem}
          >
            Add Customized Item to Cart
          </Button>

          {!asset ? (
            <p className="text-xs text-muted-foreground">
              Upload a design before adding customized item to cart.
            </p>
          ) : null}
          {!quoteBreakdown ? (
            <p className="text-xs text-muted-foreground">
              Generate a quote before adding to cart.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

