import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Minus,
  Plus,
  ShoppingCart,
  Zap,
} from 'lucide-react';
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

// ── Step definitions ─────────────────────────────────────────────────────────
const STEPS = [
  { id: 1, key: 'variant',  labelMn: 'Хувилбар',   labelEn: 'Variant'      },
  { id: 2, key: 'areas',    labelMn: 'Хэвлэх талбай', labelEn: 'Print Areas' },
  { id: 3, key: 'design',   labelMn: 'Дизайн',      labelEn: 'Design'       },
  { id: 4, key: 'preview',  labelMn: 'Урьдчилан харах', labelEn: 'Preview'  },
] as const;

export default function CustomizePage() {
  const params = useParams<{ productSlug: string }>();
  const productSlug = params.productSlug || '';
  const navigate = useNavigate();
  const { language } = useTheme();
  const { addCustomizedItem } = useCart();

  const t = (mn: string, en: string) => (language === 'mn' ? mn : en);

  const { data: product, isLoading, error } = useProductQuery(productSlug);
  useEffect(() => {
    if (product?.productFamily) {
      Sentry.setTag('product_family', product.productFamily);
    }
  }, [product?.productFamily]);

  // ── Variant ────────────────────────────────────────────────────────────────
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');
  const selectedVariant = useMemo(
    () => product?.variants?.find((v) => v.id === selectedVariantId) ?? product?.variants?.[0] ?? null,
    [product, selectedVariantId]
  );
  useEffect(() => {
    if (selectedVariant?.id) setSelectedVariantId(selectedVariant.id);
  }, [selectedVariant?.id]);

  // ── Customization options ──────────────────────────────────────────────────
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

  // ── Quantity & rush ────────────────────────────────────────────────────────
  const [quantity, setQuantity] = useState(1);
  const [rushOrder, setRushOrder] = useState(false);

  // ── Upload ─────────────────────────────────────────────────────────────────
  const [asset, setAsset] = useState<UploadedDesignAsset | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // ── Quote ──────────────────────────────────────────────────────────────────
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoteBreakdown, setQuoteBreakdown] = useState<CustomizationPriceBreakdown | null>(null);

  // ── Mockup ─────────────────────────────────────────────────────────────────
  const [mockupPreviewUrl, setMockupPreviewUrl] = useState<string | null>(null);
  const [mockupPreviewLoading, setMockupPreviewLoading] = useState(false);
  const [mockupPreviewError, setMockupPreviewError] = useState<string | null>(null);

  // ── Load options when variant changes ─────────────────────────────────────
  useEffect(() => {
    const loadOptions = async () => {
      if (!selectedVariant?.id) return;
      setOptionsLoading(true);
      setOptionsError(null);
      setQuoteBreakdown(null);
      try {
        const res = await fetch(
          `${import.meta.env.VITE_API_URL}/api/customization/options?variantId=${selectedVariant.id}`
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || t('Уншиж чадсангүй', 'Failed to load options'));
        const payload = data as CustomizationOptionsResponse;
        setIsCustomizable(Boolean(payload.isCustomizable));
        setPrintAreas(payload.printAreas ?? []);
        setSizeTiers(payload.printSizeTiers ?? []);
        setAddOnOptions(payload.addOnOptions ?? []);
        setSelectedAddOnIds((prev) => {
          const available = new Set((payload.addOnOptions ?? []).map((o) => o.id));
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
        const defaults = (payload.printAreas ?? []).filter((a) => a.isDefault);
        const initial = defaults.length > 0 ? defaults.map((a) => a.id) : payload.printAreas.slice(0, 1).map((a) => a.id);
        setSelectedAreaIds(initial);
        setActiveAreaId((prev) => (prev && initial.includes(prev) ? prev : (initial[0] ?? null)));
        setSelectedSizeTierByArea((prev) => {
          const next: Record<string, string> = {};
          const fallback = payload.printSizeTiers?.[0]?.id || '';
          for (const id of initial) next[id] = prev[id] || fallback;
          return next;
        });
        setPlacementByArea((prev) => {
          const next: Record<string, CanvasPlacementConfig> = {};
          for (const id of initial) if (prev[id]) next[id] = prev[id];
          return next;
        });
      } catch (err: any) {
        setOptionsError(err?.message || t('Алдаа гарлаа', 'Failed to load options'));
      } finally {
        setOptionsLoading(false);
      }
    };
    loadOptions();
  }, [selectedVariant?.id]);

  useEffect(() => {
    setActiveAreaId((prev) => (prev && selectedAreaIds.includes(prev) ? prev : (selectedAreaIds[0] ?? null)));
    setPlacementByArea((prev) => {
      const set = new Set(selectedAreaIds);
      let changed = false;
      const next: Record<string, CanvasPlacementConfig> = {};
      for (const [id, p] of Object.entries(prev)) {
        if (set.has(id)) next[id] = p;
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [selectedAreaIds]);

  useEffect(() => {
    setSelectedAddOnIds((prev) => prev.filter((id) => {
      const opt = addOnOptions.find((o) => o.id === id);
      if (!opt) return false;
      const minOk = opt.minQuantity == null || quantity >= opt.minQuantity;
      const maxOk = opt.maxQuantity == null || quantity <= opt.maxQuantity;
      return minOk && maxOk;
    }));
  }, [addOnOptions, quantity]);

  const selectedAreas = useMemo(() => printAreas.filter((a) => selectedAreaIds.includes(a.id)), [printAreas, selectedAreaIds]);
  const activeArea = useMemo(() => selectedAreas.find((a) => a.id === activeAreaId) ?? null, [selectedAreas, activeAreaId]);
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
      const cur = prev[printAreaId];
      if (cur && cur.offsetX === placement.offsetX && cur.offsetY === placement.offsetY &&
          cur.rotation === placement.rotation && cur.scale === placement.scale) return prev;
      return { ...prev, [printAreaId]: placement };
    });
  }, []);

  const selectedCustomizationsForQuote = useMemo(
    () => selectedAreaIds.map((id) => ({ printAreaId: id, printSizeTierId: selectedSizeTierByArea[id] || '' }))
                         .filter((item) => item.printSizeTierId),
    [selectedAreaIds, selectedSizeTierByArea]
  );

  // ── Mockup preview effect ──────────────────────────────────────────────────
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
      (async () => {
        setMockupPreviewLoading(true);
        setMockupPreviewError(null);
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.access_token) { if (!cancelled) setMockupPreviewLoading(false); return; }
          const res = await fetch(`${import.meta.env.VITE_API_URL}/api/customization/mockup-preview`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ variantId: selectedVariant.id, printAreaId: activeAreaId, printSizeTierId: activeSizeTierId || undefined, assetId: asset.id, placementConfig: activePlacement }),
            signal: controller.signal,
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data?.error || 'Failed to render mockup');
          if (!cancelled) setMockupPreviewUrl((data as MockupPreviewResponse).previewUrl || null);
        } catch (err: any) {
          if (cancelled || controller.signal.aborted) return;
          setMockupPreviewError(err?.message || 'Failed to render mockup');
        } finally {
          if (!cancelled) setMockupPreviewLoading(false);
        }
      })();
    }, 350);
    return () => { cancelled = true; window.clearTimeout(timer); controller.abort(); };
  }, [asset?.id, selectedVariant?.id, activeAreaId, activeSizeTierId, activePlacement.offsetX, activePlacement.offsetY, activePlacement.rotation, activePlacement.scale, isCustomizable]);

  // ── Auto-quote when selections complete ───────────────────────────────────
  const canRequestQuote =
    Boolean(selectedVariant?.id) &&
    selectedAreaIds.length > 0 &&
    selectedCustomizationsForQuote.length === selectedAreaIds.length;

  const autoQuoteRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!canRequestQuote || !selectedVariant?.id) return;
    if (autoQuoteRef.current) clearTimeout(autoQuoteRef.current);
    autoQuoteRef.current = setTimeout(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      setQuoteLoading(true);
      setQuoteError(null);
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/customization/price-quote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ variantId: selectedVariant.id, customizations: selectedCustomizationsForQuote, addOnIds: selectedAddOnIds, quantity, rushOrder }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Failed to calculate quote');
        setQuoteBreakdown(data.breakdown as CustomizationPriceBreakdown);
      } catch (err: any) {
        setQuoteError(err?.message || 'Failed to calculate quote');
      } finally {
        setQuoteLoading(false);
      }
    }, 600);
    return () => { if (autoQuoteRef.current) clearTimeout(autoQuoteRef.current); };
  }, [canRequestQuote, selectedVariant?.id, JSON.stringify(selectedCustomizationsForQuote), JSON.stringify(selectedAddOnIds), quantity, rushOrder]);

  const canAddToCart =
    Boolean(asset?.id) && Boolean(quoteBreakdown) && canRequestQuote && Boolean(selectedVariant?.id) && isCustomizable;

  // ── Auth helper ────────────────────────────────────────────────────────────
  const requestAuthSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) return session;
    toast.error(t('Нэвтэрч орно уу', 'Please sign in to continue'));
    navigate(`/login?returnTo=${encodeURIComponent(window.location.pathname)}`);
    return null;
  };

  // ── Upload handler ─────────────────────────────────────────────────────────
  const handleUploadDesign = async (file: File) => {
    const session = await requestAuthSession();
    if (!session) return;
    setUploading(true);
    setUploadError(null);
    try {
      if (env.FF_UPLOAD_ASYNC_VALIDATION_V1) {
        const uploaded = await uploadCustomizationDesignSigned({ file, accessToken: session.access_token, apiBase: import.meta.env.VITE_API_URL });
        setAsset(uploaded as UploadedDesignAsset);
      } else {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/customization/upload-design`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Failed to upload design');
        setAsset(data.asset as UploadedDesignAsset);
      }
      toast.success(t('Дизайн амжилттай орлоо', 'Design uploaded successfully'));
    } catch (err: any) {
      setUploadError(err?.message || 'Failed to upload design');
    } finally {
      setUploading(false);
    }
  };

  // ── Add to cart ────────────────────────────────────────────────────────────
  const handleAddCustomizedItem = () => {
    if (!product || !selectedVariant || !asset || !quoteBreakdown) return;
    const printFeeMap = new Map(quoteBreakdown.printFees.map((l) => [`${l.printAreaId}:${l.printSizeTierId}`, l.fee]));
    const areaMap = new Map(printAreas.map((a) => [a.id, a]));
    const tierMap = new Map(sizeTiers.map((t) => [t.id, t]));
    const customizations = selectedCustomizationsForQuote.map((item) => ({
      printAreaId: item.printAreaId,
      printAreaLabel: areaMap.get(item.printAreaId)?.label || item.printAreaId,
      printSizeTierId: item.printSizeTierId,
      printSizeTierLabel: tierMap.get(item.printSizeTierId)?.label || item.printSizeTierId,
      assetId: asset.id,
      assetOriginalUrl: asset.originalUrl,
      assetThumbnailUrl: asset.thumbnailUrl,
      printFee: printFeeMap.get(`${item.printAreaId}:${item.printSizeTierId}`) ?? 0,
      placementConfig: placementByArea[item.printAreaId] ?? DEFAULT_CANVAS_PLACEMENT,
    }));
    const addOns = quoteBreakdown.addOnFee.lines.map((l) => ({ id: l.id, name: l.name, fee: l.fee }));
    addCustomizedItem({
      product, variant: selectedVariant, quantity,
      unitPrice: roundCurrency(quoteBreakdown.grandTotal / Math.max(1, quantity)),
      customizations, addOns, rushOrder,
      rushFee: quoteBreakdown.rushFee,
      addOnFees: quoteBreakdown.addOnFee.total,
    });
    navigate('/cart');
  };

  // ── Completed step logic ───────────────────────────────────────────────────
  const completedSteps = useMemo(() => {
    const done = new Set<number>();
    if (selectedVariant?.id) done.add(1);
    if (selectedAreaIds.length > 0 && selectedCustomizationsForQuote.length === selectedAreaIds.length) done.add(2);
    if (asset?.id) done.add(3);
    if (quoteBreakdown) done.add(4);
    return done;
  }, [selectedVariant, selectedAreaIds, selectedCustomizationsForQuote, asset, quoteBreakdown]);

  // ── Loading / error states ─────────────────────────────────────────────────
  if (error) {
    return (
      <div className="container mx-auto px-4 py-8 pt-28">
        <p className="text-destructive">{error instanceof Error ? error.message : t('Бүтээгдэхүүн ачааллагдсангүй', 'Failed to load product')}</p>
      </div>
    );
  }

  if (isLoading || !product || !selectedVariant) {
    return (
      <div className="container mx-auto flex min-h-[60vh] items-center justify-center px-4 pt-28">
        <div className="text-center">
          <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">{t('Уншиж байна...', 'Loading...')}</p>
        </div>
      </div>
    );
  }

  const baseImage = imageUrl(product.mockupImagePath || selectedVariant.imagePath || product.image_path) || null;

  // ── Blocking reasons for CTA ───────────────────────────────────────────────
  const blockingReasons: string[] = [];
  if (!asset?.id)        blockingReasons.push(t('Дизайн upload хийнэ үү', 'Upload your design'));
  if (!canRequestQuote)  blockingReasons.push(t('Хэвлэх талбай сонгоно уу', 'Select print areas and sizes'));
  if (!quoteBreakdown)   blockingReasons.push(t('Үнийн тооцоо хийгдэж байна...', 'Calculating price...'));

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 pb-24 pt-28">

        {/* ── Breadcrumb ── */}
        <div className="mb-4 flex items-center gap-1 text-sm text-muted-foreground">
          <Link to={`/product/${product.slug}`} className="flex items-center gap-1 hover:text-primary transition-colors">
            <ArrowLeft className="h-4 w-4" />
            {t('Бүтээгдэхүүн рүү буцах', 'Back to product')}
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground font-medium">{t('Захиалгат хэвлэл', 'Customize')}</span>
        </div>

        {/* ── Header ── */}
        <div className="mb-6 flex items-start gap-4">
          {baseImage && (
            <div className="hidden sm:block h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg border border-border">
              <img src={baseImage} alt={product.name} className="h-full w-full object-cover" />
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-foreground sm:text-3xl">{product.name}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {t('Хэвлэх талбай сонгож, дизайнаа оруулан захиалга өгнө үү.', 'Choose print areas, upload your artwork, and place your order.')}
            </p>
          </div>
        </div>

        {/* ── Step progress bar ── */}
        <div className="mb-8">
          <div className="flex items-center gap-0">
            {STEPS.map((step, idx) => {
              const done = completedSteps.has(step.id);
              const active = !done && (step.id === 1 || completedSteps.has(step.id - 1));
              return (
                <div key={step.id} className="flex flex-1 items-center">
                  <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-semibold transition-all ${
                      done
                        ? 'border-primary bg-primary text-primary-foreground'
                        : active
                        ? 'border-primary bg-background text-primary'
                        : 'border-border bg-background text-muted-foreground'
                    }`}>
                      {done ? <CheckCircle2 className="h-4 w-4" /> : step.id}
                    </div>
                    <span className={`hidden text-xs font-medium sm:block ${done || active ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {t(step.labelMn, step.labelEn)}
                    </span>
                  </div>
                  {idx < STEPS.length - 1 && (
                    <div className={`h-0.5 flex-1 mx-2 rounded-full transition-all ${done ? 'bg-primary' : 'bg-border'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Main content grid ── */}
        <div className="grid gap-6 lg:grid-cols-[1fr,420px]">

          {/* ─────────── LEFT: preview column ─────────────────────────────── */}
          <div className="space-y-4">
            {/* Canvas Editor */}
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <div className="border-b border-border px-4 py-3">
                <h2 className="text-sm font-semibold text-foreground">
                  {t('Байршуулах засварлагч', 'Placement Editor')}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t('Дизайнаа чирэх, масштаблах, эргүүлэх боломжтой', 'Drag, scale, and rotate your design on the print area')}
                </p>
              </div>
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
            </div>

            {/* Mockup Preview */}
            {(mockupPreviewUrl || mockupPreviewLoading) && (
              <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                <div className="border-b border-border px-4 py-3">
                  <h2 className="text-sm font-semibold text-foreground">
                    {t('Урьдчилан харах', 'Preview')}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {activeArea ? t(`${activeArea.label} — урьдчилан харах`, `${activeArea.label} preview`) : ''}
                  </p>
                </div>
                <div className="p-4">
                  <AutoMockupPreview
                    previewUrl={mockupPreviewUrl}
                    fallbackUrl={baseImage}
                    loading={mockupPreviewLoading}
                    error={mockupPreviewError}
                    activeAreaLabel={activeArea?.label || null}
                  />
                </div>
              </div>
            )}
          </div>

          {/* ─────────── RIGHT: config column ─────────────────────────────── */}
          <div className="space-y-4">

            {/* Step 1: Variant */}
            <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
              <div className="flex items-center gap-3 border-b border-border px-4 py-3">
                <span className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${completedSteps.has(1) ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                  {completedSteps.has(1) ? '✓' : '1'}
                </span>
                <h2 className="text-sm font-semibold text-foreground">{t('Хувилбар сонгох', 'Choose Variant')}</h2>
              </div>
              <div className="p-4">
                {product.variants.length === 1 ? (
                  <div className="flex items-center gap-3 rounded-lg border border-primary bg-primary/5 p-3">
                    {selectedVariant.imagePath && (
                      <img src={imageUrl(selectedVariant.imagePath) || ''} alt={selectedVariant.name} className="h-10 w-10 rounded-md object-cover border border-border" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-foreground">{selectedVariant.name}</p>
                      <p className="text-xs text-muted-foreground">₮{Number(selectedVariant.price).toLocaleString()}</p>
                    </div>
                    <CheckCircle2 className="ml-auto h-5 w-5 text-primary flex-shrink-0" />
                  </div>
                ) : (
                  <div className="space-y-2">
                    {product.variants.map((variant) => {
                      const selected = variant.id === selectedVariant.id;
                      return (
                        <button
                          key={variant.id}
                          onClick={() => { setSelectedVariantId(variant.id); setQuoteBreakdown(null); }}
                          className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all ${selected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/50'}`}
                        >
                          {variant.imagePath && (
                            <img src={imageUrl(variant.imagePath) || ''} alt={variant.name} className="h-10 w-10 rounded-md object-cover border border-border flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium ${selected ? 'text-primary' : 'text-foreground'}`}>{variant.name}</p>
                            <p className="text-xs text-muted-foreground">₮{Number(variant.price).toLocaleString()}</p>
                          </div>
                          {selected && <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Step 2: Print areas & size */}
            <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
              <div className="flex items-center gap-3 border-b border-border px-4 py-3">
                <span className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${completedSteps.has(2) ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                  {completedSteps.has(2) ? '✓' : '2'}
                </span>
                <h2 className="text-sm font-semibold text-foreground">{t('Хэвлэх талбай & хэмжээ', 'Print Areas & Size')}</h2>
              </div>
              <div className="p-4">
                {optionsLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('Ачааллаж байна...', 'Loading options...')}
                  </div>
                ) : optionsError ? (
                  <p className="text-sm text-destructive">{optionsError}</p>
                ) : !isCustomizable ? (
                  <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
                    {t('Энэ хувилбар DTF хэвлэлд тохирохгүй байна.', 'This variant is not configurable for DTF printing.')}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <PlacementSelector
                      printAreas={printAreas}
                      selectedAreaIds={selectedAreaIds}
                      onToggleArea={(id) => {
                        setQuoteBreakdown(null);
                        if (selectedAreaIds.includes(id)) {
                          const remaining = selectedAreaIds.filter((a) => a !== id);
                          setSelectedAreaIds(remaining);
                          setSelectedSizeTierByArea((prev) => { const n = { ...prev }; delete n[id]; return n; });
                          setPlacementByArea((prev) => { const n = { ...prev }; delete n[id]; return n; });
                          setActiveAreaId((prev) => (prev === id ? (remaining[0] ?? null) : prev));
                        } else {
                          setSelectedAreaIds((prev) => [...prev, id]);
                          setSelectedSizeTierByArea((prev) => {
                            if (prev[id]) return prev;
                            const def = sizeTiers[0]?.id || '';
                            return def ? { ...prev, [id]: def } : prev;
                          });
                          setActiveAreaId((prev) => prev ?? id);
                        }
                      }}
                    />
                    {selectedAreaIds.length > 0 && (
                      <SizeTierSelector
                        selectedAreaIds={selectedAreaIds}
                        printAreas={printAreas}
                        sizeTiers={sizeTiers}
                        selectedSizeTierByArea={selectedSizeTierByArea}
                        onSelectSizeTier={(areaId, tierId) => {
                          setQuoteBreakdown(null);
                          setSelectedSizeTierByArea((prev) => ({ ...prev, [areaId]: tierId }));
                        }}
                      />
                    )}
                    {addOnOptions.length > 0 && (
                      <AddOnSelector
                        quantity={quantity}
                        addOnOptions={addOnOptions}
                        selectedAddOnIds={selectedAddOnIds}
                        onToggle={(id) => {
                          setQuoteBreakdown(null);
                          setSelectedAddOnIds((prev) => prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]);
                        }}
                      />
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Step 3: Design upload */}
            <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
              <div className="flex items-center gap-3 border-b border-border px-4 py-3">
                <span className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${completedSteps.has(3) ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                  {completedSteps.has(3) ? '✓' : '3'}
                </span>
                <h2 className="text-sm font-semibold text-foreground">{t('Дизайн оруулах', 'Upload Design')}</h2>
              </div>
              <div className="p-4">
                <DesignUploader
                  asset={asset}
                  uploading={uploading}
                  error={uploadError}
                  onFileSelected={handleUploadDesign}
                  onClear={() => setAsset(null)}
                />
              </div>
            </div>

            {/* Step 4: Quantity, Rush, Price */}
            <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
              <div className="flex items-center gap-3 border-b border-border px-4 py-3">
                <span className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${completedSteps.has(4) ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                  {completedSteps.has(4) ? '✓' : '4'}
                </span>
                <h2 className="text-sm font-semibold text-foreground">{t('Тоо ширхэг & үнэ', 'Quantity & Price')}</h2>
              </div>
              <div className="p-4 space-y-4">
                {/* Quantity counter */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">{t('Тоо ширхэг', 'Quantity')}</p>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => { setQuantity((q) => Math.max(1, q - 1)); setQuoteBreakdown(null); }}
                      className="flex h-10 w-10 items-center justify-center rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-40"
                      disabled={quantity <= 1}
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-12 text-center text-lg font-semibold text-foreground">{quantity}</span>
                    <button
                      onClick={() => { setQuantity((q) => Math.min(1000, q + 1)); setQuoteBreakdown(null); }}
                      className="flex h-10 w-10 items-center justify-center rounded-lg border border-border hover:bg-muted transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                    <span className="text-xs text-muted-foreground">{t('хүртэл 1,000', 'up to 1,000')}</span>
                  </div>
                </div>

                {/* Rush order toggle */}
                <button
                  onClick={() => { setRushOrder((r) => !r); setQuoteBreakdown(null); }}
                  className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all ${rushOrder ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20' : 'border-border hover:border-amber-300'}`}
                >
                  <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${rushOrder ? 'bg-amber-400/20' : 'bg-muted'}`}>
                    <Zap className={`h-5 w-5 ${rushOrder ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`} />
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${rushOrder ? 'text-amber-800 dark:text-amber-300' : 'text-foreground'}`}>
                      {t('Яаралтай захиалга', 'Rush Order')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t('24 цагийн дотор хэвлэгдэнэ — нэмэлт хураамжтай', 'Printed within 24 hours — extra fee applies')}
                    </p>
                  </div>
                  <div className={`h-5 w-5 flex-shrink-0 rounded-full border-2 transition-all ${rushOrder ? 'border-amber-400 bg-amber-400' : 'border-border'}`}>
                    {rushOrder && <div className="h-full w-full flex items-center justify-center"><div className="h-2 w-2 rounded-full bg-white" /></div>}
                  </div>
                </button>

                {/* Price breakdown */}
                <PriceBreakdown
                  breakdown={quoteBreakdown}
                  loading={quoteLoading}
                  error={quoteError}
                  quantity={quantity}
                  rushOrder={rushOrder}
                  onRequestQuote={async () => {
                    if (!canRequestQuote || !selectedVariant?.id) return;
                    const session = await requestAuthSession();
                    if (!session) return;
                    setQuoteLoading(true);
                    setQuoteError(null);
                    try {
                      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/customization/price-quote`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
                        body: JSON.stringify({ variantId: selectedVariant.id, customizations: selectedCustomizationsForQuote, addOnIds: selectedAddOnIds, quantity, rushOrder }),
                      });
                      const data = await res.json();
                      if (!res.ok) throw new Error(data?.error || 'Failed to calculate quote');
                      setQuoteBreakdown(data.breakdown as CustomizationPriceBreakdown);
                      toast.success(t('Үнийн тооцоо шинэчлэгдлээ', 'Price quote updated'));
                    } catch (err: any) {
                      setQuoteError(err?.message || 'Failed to calculate quote');
                    } finally {
                      setQuoteLoading(false);
                    }
                  }}
                />
              </div>
            </div>

            {/* ── Add to Cart CTA ── */}
            <div className="rounded-2xl border border-border bg-card shadow-sm p-4 space-y-3">
              <Button
                type="button"
                className="w-full h-12 text-base font-semibold"
                size="lg"
                disabled={!canAddToCart}
                onClick={handleAddCustomizedItem}
              >
                <ShoppingCart className="mr-2 h-5 w-5" />
                {t('Сагсанд нэмэх', 'Add to Cart')}
              </Button>

              {/* Checklist of what's still needed */}
              {!canAddToCart && blockingReasons.length > 0 && (
                <ul className="space-y-1.5">
                  {blockingReasons.map((reason, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground flex-shrink-0" />
                      {reason}
                    </li>
                  ))}
                </ul>
              )}

              {canAddToCart && quoteBreakdown && (
                <p className="text-center text-xs text-muted-foreground">
                  {t(`Нийт: ₮${quoteBreakdown.grandTotal.toLocaleString()} (${quantity} ширхэг)`, `Total: ₮${quoteBreakdown.grandTotal.toLocaleString()} (qty ${quantity})`)}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
