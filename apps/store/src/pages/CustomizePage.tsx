import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Minus,
  Plus,
  Redo2,
  ShoppingCart,
  Trash2,
  Undo2,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { env } from '@/lib/env';
import { Sentry, addBreadcrumb, captureMessage } from '@/lib/sentry';
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
import AutoMockupPreview from '@/components/customize/AutoMockupPreview';
import KonvaCustomizeCanvas from '@/components/customize/KonvaCustomizeCanvas';
import KonvaDesignImage from '@/components/customize/KonvaDesignImage';
import DesignSizeIndicator from '@/components/customize/DesignSizeIndicator';
import ViewSwitcherTabs from '@/components/customize/ViewSwitcherTabs';
import PlacementPresetBar from '@/components/customize/PlacementPresetBar';
import { detectViewFromPath, mapGalleryToViews } from '@/lib/viewImageOrdering';
import { usePlacementEngine } from '@/hooks/usePlacementEngine';
import type { EnginePlacement, NormalizedRect } from '@/hooks/usePlacementEngine';
import { useHistory } from '@/hooks/useHistory';
import { useKonvaImage } from '@/hooks/useKonvaImage';
import type { ViewName } from '@/types/garment';
import type { KonvaImageAttrs, KonvaRect } from '@/types/customization';

// Legacy Fabric placement config — kept for Phase 2→3 migration
type CanvasPlacementConfig = { offsetX: number; offsetY: number; rotation: number; scale: number };
import AddOnSelector, { type AddOnOption } from '@/components/customize/AddOnSelector';

type CustomizationOptionsResponse = {
  variantId: string;
  productId: string;
  isCustomizable: boolean;
  mockupPreviewEnabled?: boolean;
  showPlacementCoordinates?: boolean;
  layoutTemplate?: {
    version: 1;
    views?: Partial<Record<ViewName, {
      imagePath?: string;
      naturalWidth?: number;
      naturalHeight?: number;
    }>>;
    presets?: Array<{
      key: string;
      labelMn?: string;
      labelEn?: string;
      view: ViewName;
      rectNorm: NormalizedRect;
      sortOrder?: number;
      isDefault?: boolean;
    }>;
  } | null;
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
const CANVAS_ASPECT_RATIO = 4 / 3;
const MAX_CANVAS_HEIGHT = 1188;
const MAX_CANVAS_WIDTH = Math.round(MAX_CANVAS_HEIGHT * CANVAS_ASPECT_RATIO);
const VIEW_ORDER: ViewName[] = ['front', 'back', 'left', 'right'];
const EMPTY_VIEW_PATHS: Partial<Record<ViewName, string>> = {};

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
  const [layoutTemplate, setLayoutTemplate] = useState<CustomizationOptionsResponse['layoutTemplate'] | undefined>(undefined);
  const [mockupPreviewEnabled, setMockupPreviewEnabled] = useState(true);
  const [showPlacementCoordinates, setShowPlacementCoordinates] = useState(true);

  const [selectedAreaIds, setSelectedAreaIds] = useState<string[]>([]);
  const [selectedSizeTierByArea, setSelectedSizeTierByArea] = useState<Record<string, string>>({});
  const [activeAreaId, setActiveAreaId] = useState<string | null>(null);
  const [placementByArea, setPlacementByArea] = useState<Record<string, CanvasPlacementConfig>>({});
  const [selectedAddOnIds, setSelectedAddOnIds] = useState<string[]>([]);

  // ── Quantity & rush ────────────────────────────────────────────────────────
  const [quantity, setQuantity] = useState(1);
  const [rushOrder, setRushOrder] = useState(false);

  // ── Konva canvas views ─────────────────────────────────────────────────────
  const [activeView, setActiveView] = useState<ViewName>('front');
  const fallbackTelemetryRef = useRef<Set<string>>(new Set());
  const strictGuardTelemetryRef = useRef<Set<string>>(new Set());

  const inferredVariantViewPaths = useMemo(
    () =>
      mapGalleryToViews(
        selectedVariant?.imagePath ?? '',
        selectedVariant?.galleryPaths ?? [],
        VIEW_ORDER
      ),
    [selectedVariant?.galleryPaths, selectedVariant?.imagePath]
  );

  const hasTemplateLayout = useMemo(() => {
    if (!layoutTemplate) return false;
    const hasPreset = (layoutTemplate.presets?.length ?? 0) > 0;
    const hasTemplateViewImage = VIEW_ORDER.some((view) => Boolean(layoutTemplate.views?.[view]?.imagePath));
    return hasPreset || hasTemplateViewImage;
  }, [layoutTemplate]);

  const allowVariantViewFallback = !env.FF_CUSTOM_LAYOUT_TEMPLATE_STRICT || !hasTemplateLayout;

  const fallbackViewPaths = useMemo(
    () => (allowVariantViewFallback ? inferredVariantViewPaths : EMPTY_VIEW_PATHS),
    [allowVariantViewFallback, inferredVariantViewPaths]
  );

  const availableViews = useMemo<ViewName[]>(() => {
    const templateViews = layoutTemplate?.views ?? {};
    const viewsWithImage = VIEW_ORDER.filter(
      (view) => Boolean(templateViews[view]?.imagePath) || Boolean(fallbackViewPaths[view])
    );
    return viewsWithImage.length > 0 ? viewsWithImage : ['front'];
  }, [layoutTemplate?.views, fallbackViewPaths]);

  // Map view -> Cloudinary URL from layout template only (canonical source-of-truth)
  const viewImages = useMemo(() => {
    const templateViews = layoutTemplate?.views ?? {};
    const withTemplate: Partial<Record<ViewName, string | undefined>> = {};
    (Object.keys(fallbackViewPaths) as ViewName[]).forEach((viewKey) => {
      const path = fallbackViewPaths[viewKey];
      if (path) withTemplate[viewKey] = imageUrl(path);
    });
    (Object.keys(templateViews) as ViewName[]).forEach((viewKey) => {
      const templatePath = templateViews[viewKey]?.imagePath;
      if (!templatePath) return;

      // Guard against mis-mapped template views (e.g., front image stored under back).
      const templateDetectedView = detectViewFromPath(templatePath);
      const inferredPath = inferredVariantViewPaths[viewKey];
      const inferredDetectedView = inferredPath ? detectViewFromPath(inferredPath) : null;
      if (
        templateDetectedView &&
        templateDetectedView !== viewKey &&
        inferredPath &&
        inferredDetectedView === viewKey
      ) {
        withTemplate[viewKey] = imageUrl(inferredPath);
        return;
      }

      withTemplate[viewKey] = imageUrl(templatePath);
    });
    return withTemplate;
  }, [fallbackViewPaths, inferredVariantViewPaths, layoutTemplate?.views]);

  useEffect(() => {
    if (!allowVariantViewFallback) return;
    const templateViews = layoutTemplate?.views ?? {};
    const fallbackUsedViews = VIEW_ORDER.filter(
      (view) => !templateViews[view]?.imagePath && Boolean(inferredVariantViewPaths[view])
    );
    if (fallbackUsedViews.length === 0 || !selectedVariant?.id) return;

    const key = `${selectedVariant.id}:${fallbackUsedViews.join(',')}`;
    if (fallbackTelemetryRef.current.has(key)) return;
    fallbackTelemetryRef.current.add(key);

    addBreadcrumb({
      category: 'customization.fallback',
      level: 'warning',
      message: 'Template view image fallback used',
      data: {
        productSlug,
        variantId: selectedVariant.id,
        fallbackUsedViews,
      },
    });
    captureMessage('customization_template_view_image_fallback_used', 'warning');
  }, [allowVariantViewFallback, inferredVariantViewPaths, layoutTemplate?.views, productSlug, selectedVariant?.id]);

  useEffect(() => {
    if (!env.FF_CUSTOM_LAYOUT_TEMPLATE_STRICT || !hasTemplateLayout || !selectedVariant?.id) return;
    const templateViews = layoutTemplate?.views ?? {};
    const blockedViews = VIEW_ORDER.filter(
      (view) => !templateViews[view]?.imagePath && Boolean(inferredVariantViewPaths[view])
    );
    if (blockedViews.length === 0) return;

    const key = `${selectedVariant.id}:${blockedViews.join(',')}`;
    if (strictGuardTelemetryRef.current.has(key)) return;
    strictGuardTelemetryRef.current.add(key);

    addBreadcrumb({
      category: 'customization.fallback',
      level: 'warning',
      message: 'Template strict mode blocked variant-gallery fallback',
      data: {
        productSlug,
        variantId: selectedVariant.id,
        blockedViews,
      },
    });
    captureMessage('customization_template_strict_mode_blocked_fallback', 'warning');
  }, [hasTemplateLayout, inferredVariantViewPaths, layoutTemplate?.views, productSlug, selectedVariant?.id]);

  const strictModeMissingViewImage = useMemo(() => {
    if (!env.FF_CUSTOM_LAYOUT_TEMPLATE_STRICT || !hasTemplateLayout) return false;
    return !layoutTemplate?.views?.[activeView]?.imagePath && Boolean(inferredVariantViewPaths[activeView]);
  }, [activeView, hasTemplateLayout, inferredVariantViewPaths, layoutTemplate?.views]);

  const templatePlacements = useMemo<EnginePlacement[]>(() => {
    const raw = layoutTemplate?.presets ?? [];
    if (raw.length === 0) return [];
    const byView = raw
      .filter((preset) => preset.view === activeView)
      .slice()
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

    return byView.map((preset) => ({
      placementKey: preset.key,
      view: preset.view,
      label: t(preset.labelMn || preset.labelEn || preset.key, preset.labelEn || preset.labelMn || preset.key),
      rectNorm: preset.rectNorm,
    }));
  }, [activeView, layoutTemplate?.presets, t]);

  // ── Responsive canvas width ─────────────────────────────────────────────────
  const [canvasContainerEl, setCanvasContainerEl] = useState<HTMLDivElement | null>(null);
  const canvasContainerRef = useCallback((node: HTMLDivElement | null) => {
    setCanvasContainerEl(node);
  }, []);
  const [canvasWidth, setCanvasWidth] = useState(560);
  const [viewImageNaturalSize, setViewImageNaturalSize] = useState<
    Partial<Record<ViewName, { width: number; height: number }>>
  >({});

  // Single effect for canvas width measurement
  useEffect(() => {
    if (!canvasContainerEl) return;

    const measure = (rect: DOMRectReadOnly | DOMRect) => {
      // Fit canvas by viewport height + available container width to avoid clipping at 100% browser zoom.
      const byWidth = rect.width;
      const top = canvasContainerEl.getBoundingClientRect().top;
      const viewportHeight = window.innerHeight || 0;
      const bottomGutter = 24;
      const availableHeight = Math.max(220, viewportHeight - top - bottomGutter);
      const byHeight = availableHeight * CANVAS_ASPECT_RATIO;
      const nextWidth = Math.floor(Math.min(byWidth, byHeight, MAX_CANVAS_WIDTH));
      if (nextWidth > 0) {
        setCanvasWidth((prev) => (prev === nextWidth ? prev : nextWidth));
      }
    };

    // Immediate measurement
    measure(canvasContainerEl.getBoundingClientRect());

    // Watch for resize changes
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        measure(entry.contentRect);
      }
    });
    ro.observe(canvasContainerEl);
    return () => ro.disconnect();
  }, [canvasContainerEl]);

  // ── Placement engine ────────────────────────────────────────────────────────
  const placementEngine = usePlacementEngine(
    'hoodie',
    activeView,
    'Adult',
    canvasWidth,
    viewImageNaturalSize[activeView] ?? null,
    templatePlacements
  );

  // Active preset selection + ghost rect
  const [activePlacementKey, setActivePlacementKey] = useState<string | null>(null);
  const [hoverPlacement, setHoverPlacement] = useState<EnginePlacement | null>(null);
  const [editableGhostRect, setEditableGhostRect] = useState<KonvaRect | null>(null);
  const lastAutoPlacementViewRef = useRef<ViewName | null>(null);

  useEffect(() => {
    if (availableViews.includes(activeView)) return;
    const nextView = availableViews[0] ?? 'front';
    setActiveView(nextView);
    setActivePlacementKey(null);
    setHoverPlacement(null);
  }, [activeView, availableViews]);

  // Ghost rect: prefer hover preview, fall back to active preset
  // Hidden once a design is placed on canvas (user can see the real design)
  const derivedGhostRect = useMemo((): KonvaRect | null => {
    const source = hoverPlacement
      ?? (activePlacementKey
          ? placementEngine.placements.find(p => p.placementKey === activePlacementKey) ?? null
          : null);
    if (!source) return null;
    return placementEngine.presetToCanvasRect(source);
  }, [hoverPlacement, activePlacementKey, placementEngine]);

  useEffect(() => {
    setEditableGhostRect(null);
  }, [activePlacementKey, hoverPlacement?.placementKey, activeView]);

  const ghostRect = useMemo(() => editableGhostRect ?? derivedGhostRect, [editableGhostRect, derivedGhostRect]);
  const ghostRectMetrics = useMemo(() => {
    if (!ghostRect) return null;
    return {
      x: Number(ghostRect.x.toFixed(3)),
      y: Number(ghostRect.y.toFixed(3)),
      width: Number(ghostRect.width.toFixed(3)),
      height: Number(ghostRect.height.toFixed(3)),
      canvasWidth: Number(canvasWidth.toFixed(3)),
      canvasHeight: Number((canvasWidth * 0.75).toFixed(3)),
      view: activeView,
      placementKey: activePlacementKey || '',
    };
  }, [activePlacementKey, activeView, canvasWidth, ghostRect]);

  const activePresetRectNorm = useMemo<NormalizedRect | null>(() => {
    if (!activePlacementKey) return null;
    const placement = placementEngine.placements.find((p) => p.placementKey === activePlacementKey);
    return placement?.rectNorm ?? null;
  }, [activePlacementKey, placementEngine.placements]);

  // ── Upload asset ───────────────────────────────────────────────────────────
  // Declared here (before design image hook) so the design loader can reference it
  const [asset, setAsset] = useState<UploadedDesignAsset | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // ── Design image (Konva) ────────────────────────────────────────────────────
  // Load uploaded design URL as HTMLImageElement for Konva
  const [designImage, designImageStatus] = useKonvaImage(asset?.originalUrl ?? null);

  // Natural canvas dimensions of the design node — derived from the preset rect
  // (or a default safe-area-fitted size if no preset is active)
  const naturalDesignSize = useMemo((): { width: number; height: number } | null => {
    if (!designImage) return null;

    // Prefer active placement preset dimensions
    const presetKey = activePlacementKey;
    if (presetKey) {
      const placement = placementEngine.placements.find((p) => p.placementKey === presetKey);
      if (placement) {
        const rect = placementEngine.presetToCanvasRect(placement);
        // Fit the uploaded image aspect ratio inside the preset rect
        const imgAR = designImage.naturalWidth / Math.max(1, designImage.naturalHeight);
        const rectAR = rect.width / Math.max(1, rect.height);
        if (imgAR > rectAR) {
          // Image wider than preset slot — fit by width
          return { width: rect.width, height: rect.width / imgAR };
        } else {
          // Image taller — fit by height
          return { width: rect.height * imgAR, height: rect.height };
        }
      }
    }

    // No preset: fit inside the safe area
    const sa = placementEngine.safeAreaRect;
    const maxW = sa ? sa.width * 0.7 : canvasWidth * 0.5;
    const maxH = sa ? sa.height * 0.7 : canvasWidth * 0.5;
    const imgAR = designImage.naturalWidth / Math.max(1, designImage.naturalHeight);
    const fitByW = { width: maxW, height: maxW / imgAR };
    const fitByH = { width: maxH * imgAR, height: maxH };
    return fitByW.height <= maxH ? fitByW : fitByH;
  }, [designImage, activePlacementKey, placementEngine, canvasWidth]);

  // ── Design attrs undo/redo history ──────────────────────────────────────────
  const {
    state: designAttrs,
    push: pushDesignAttrs,
    undo: undoDesign,
    redo: redoDesign,
    reset: resetDesign,
    canUndo: canUndoDesign,
    canRedo: canRedoDesign,
  } = useHistory<KonvaImageAttrs | null>(null);

  // Whether design is selected (shows Transformer handles)
  const [designSelected, setDesignSelected] = useState(false);

  // Whether design is outside safe area (turns border red)
  const [isOutsideSafeArea, setIsOutsideSafeArea] = useState(false);
  const lastAppliedPresetRef = useRef<string | null>(null);
  const hasManualDesignAdjustmentsRef = useRef(false);

  // Auto-select first preset on view switch when a design is uploaded.
  // This ensures Front/Back/Left Sleeve/Right Sleeve tabs immediately place
  // the design using that view's first preplacement button.
  useEffect(() => {
    if (!designImage) return;
    if (lastAutoPlacementViewRef.current === activeView) return;
    const firstPlacement = placementEngine.placements[0];
    if (!firstPlacement) return;
    lastAutoPlacementViewRef.current = activeView;
    setActivePlacementKey(firstPlacement.placementKey);
    setHoverPlacement(null);
    setEditableGhostRect(null);
    setDesignSelected(false);
  }, [activeView, designImage, placementEngine.placements]);

  useEffect(() => {
    if (!designImage) {
      lastAutoPlacementViewRef.current = null;
    }
  }, [designImage]);

  // ── Place design at preset position when image first loads ─────────────────
  const prevDesignImageRef = useRef<HTMLImageElement | null>(null);
  useEffect(() => {
    // Only trigger on new image load, not on canvasWidth resize
    if (!designImage || designImage === prevDesignImageRef.current) return;
    if (!naturalDesignSize) return;
    prevDesignImageRef.current = designImage;

    // Compute center position
    let cx: number;
    let cy: number;
    const presetKey = activePlacementKey;
    if (presetKey) {
      const placement = placementEngine.placements.find((p) => p.placementKey === presetKey);
      if (placement) {
        const rect = placementEngine.presetToCanvasRect(placement);
        cx = rect.x + rect.width / 2;
        cy = rect.y + rect.height / 2;
      } else {
        cx = canvasWidth / 2;
        cy = (placementEngine.safeAreaRect?.y ?? 0) + (placementEngine.safeAreaRect?.height ?? canvasWidth) / 2;
      }
    } else {
      const sa = placementEngine.safeAreaRect;
      cx = sa ? sa.x + sa.width / 2 : canvasWidth / 2;
      cy = sa ? sa.y + sa.height / 2 : canvasWidth / 2;
    }

    const initial: KonvaImageAttrs = { x: cx, y: cy, scaleX: 1, scaleY: 1, rotation: 0 };
    resetDesign(initial);
    setDesignSelected(true);
    setIsOutsideSafeArea(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [designImage]);

  // ── Handle design change (drag/transform end) ───────────────────────────────
  const checkSafeArea = useCallback(
    (attrs: KonvaImageAttrs, nW: number, nH: number): boolean => {
      const sa = placementEngine.safeAreaRect;
      if (!sa) return false;
      const { x, y, scaleX, scaleY, rotation } = attrs;
      const halfW = (nW * Math.abs(scaleX)) / 2;
      const halfH = (nH * Math.abs(scaleY)) / 2;
      const rad = (rotation * Math.PI) / 180;
      const corners = [
        [-halfW, -halfH],
        [halfW, -halfH],
        [halfW, halfH],
        [-halfW, halfH],
      ].map(([lx, ly]) => ({
        x: x + lx * Math.cos(rad) - ly * Math.sin(rad),
        y: y + lx * Math.sin(rad) + ly * Math.cos(rad),
      }));
      return corners.some(
        (c) =>
          c.x < sa.x ||
          c.y < sa.y ||
          c.x > sa.x + sa.width ||
          c.y > sa.y + sa.height
      );
    },
    [placementEngine.safeAreaRect]
  );

  const handleDesignChangeEnd = useCallback(
    (newAttrs: KonvaImageAttrs) => {
      hasManualDesignAdjustmentsRef.current = true;
      pushDesignAttrs(newAttrs);
      if (naturalDesignSize) {
        setIsOutsideSafeArea(
          checkSafeArea(newAttrs, naturalDesignSize.width, naturalDesignSize.height)
        );
      }
    },
    [pushDesignAttrs, checkSafeArea, naturalDesignSize]
  );

  // Apply selected placement preset to current design (position + size fit)
  useEffect(() => {
    if (!activePlacementKey || !designImage || !naturalDesignSize) return;
    if (hasManualDesignAdjustmentsRef.current) return;
    const applySignature = `${activePlacementKey}:${activeView}:${Math.round(canvasWidth)}`;
    if (lastAppliedPresetRef.current === applySignature) return;
    const placement = placementEngine.placements.find((p) => p.placementKey === activePlacementKey);
    if (!placement) return;

    const rect = placementEngine.presetToCanvasRect(placement);
    const nextAttrs: KonvaImageAttrs = {
      x: rect.x + rect.width / 2,
      y: rect.y + rect.height / 2,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
    };

    if (designAttrs) {
      pushDesignAttrs(nextAttrs);
    } else {
      resetDesign(nextAttrs);
    }
    setDesignSelected(true);
    setIsOutsideSafeArea(false);
    lastAppliedPresetRef.current = applySignature;
  }, [
    activePlacementKey,
    activeView,
    canvasWidth,
    designImage,
    naturalDesignSize,
    placementEngine,
    designAttrs,
    pushDesignAttrs,
    resetDesign,
  ]);

  useEffect(() => {
    if (!activePlacementKey) {
      lastAppliedPresetRef.current = null;
    }
  }, [activePlacementKey]);

  useEffect(() => {
    hasManualDesignAdjustmentsRef.current = false;
    lastAppliedPresetRef.current = null;
  }, [activePlacementKey, designImage, activeView]);

  // Clear design state when asset is removed
  useEffect(() => {
    if (!asset) {
      prevDesignImageRef.current = null;
      resetDesign(null);
      setDesignSelected(false);
      setIsOutsideSafeArea(false);
    }
  }, [asset, resetDesign]);

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
      setLayoutTemplate(undefined);
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
        setMockupPreviewEnabled(payload.mockupPreviewEnabled !== false);
        setShowPlacementCoordinates(payload.showPlacementCoordinates !== false);
        setLayoutTemplate(payload.layoutTemplate ?? null);
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
        setMockupPreviewEnabled(true);
        setShowPlacementCoordinates(true);
        setLayoutTemplate(null);
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
    if (!asset?.id || !selectedVariant?.id || !activeAreaId || !isCustomizable || !mockupPreviewEnabled) {
      setMockupPreviewLoading(false);
      setMockupPreviewError(null);
      setMockupPreviewUrl(null);
      return;
    }
    setMockupPreviewLoading(true);
    setMockupPreviewError(null);
    setMockupPreviewUrl(null);
    let cancelled = false;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      (async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.access_token) { if (!cancelled) setMockupPreviewLoading(false); return; }
          const res = await fetch(`${import.meta.env.VITE_API_URL}/api/customization/mockup-preview`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({
              variantId: selectedVariant.id,
              printAreaId: activeAreaId,
              printSizeTierId: activeSizeTierId || undefined,
              assetId: asset.id,
              baseImageUrl: viewImages[activeView] || undefined,
              presetRectNorm: activePresetRectNorm || undefined,
              baseImageNaturalWidth: viewImageNaturalSize[activeView]?.width,
              baseImageNaturalHeight: viewImageNaturalSize[activeView]?.height,
              placementConfig: activePlacement,
            }),
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
  }, [asset?.id, selectedVariant?.id, activeAreaId, activeSizeTierId, activePlacement.offsetX, activePlacement.offsetY, activePlacement.rotation, activePlacement.scale, isCustomizable, mockupPreviewEnabled, activeView, viewImages, activePresetRectNorm, viewImageNaturalSize]);

  // ── Auto-quote when selections complete ───────────────────────────────────
  const canRequestQuote =
    Boolean(selectedVariant?.id) &&
    isCustomizable &&
    !optionsLoading &&
    !optionsError &&
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
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background">
      {/* ── Header bar ── */}
      <div className="flex-shrink-0 border-b border-border bg-card">
        <div className="px-6 py-2.5">
          {/* Breadcrumb */}
          <div className="mb-1.5 flex items-center gap-1 text-sm text-muted-foreground">
            <Link to={`/product/${product.slug}`} className="flex items-center gap-1 hover:text-primary transition-colors">
              <ArrowLeft className="h-4 w-4" />
              {t('Бүтээгдэхүүн рүү буцах', 'Back to product')}
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground font-medium">{t('Захиалгат хэвлэл', 'Customize')}</span>
          </div>

          {/* Product header */}
          <div className="mb-2.5 flex items-start gap-3">
            {baseImage && (
              <div className="hidden sm:block h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg border border-border">
                <img src={baseImage} alt={product.name} className="h-full w-full object-cover" />
              </div>
            )}
            <div>
              <h1 className="text-xl font-bold text-foreground sm:text-2xl">{product.name}</h1>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t('Хэвлэх талбай сонгож, дизайнаа оруулан захиалга өгнө үү.', 'Choose print areas, upload your artwork, and place your order.')}
              </p>
            </div>
          </div>

          {/* Step progress bar */}
          <div className="flex items-center gap-0">
            {STEPS.map((step, idx) => {
              const done = completedSteps.has(step.id);
              const active = !done && (step.id === 1 || completedSteps.has(step.id - 1));
              return (
                <div key={step.id} className="flex flex-1 items-center">
                  <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                    <div className={`flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-semibold transition-all ${
                      done
                        ? 'border-primary bg-primary text-primary-foreground'
                        : active
                        ? 'border-primary bg-background text-primary'
                        : 'border-border bg-background text-muted-foreground'
                    }`}>
                      {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : step.id}
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
      </div>

      {/* ── Main content area ── */}
      <div className="flex min-h-0 flex-1 overflow-hidden">

          {/* ─────────── LEFT: canvas preview area (flex-grow, centered) ─────────────────────────────── */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden bg-muted/20 p-4">
            {/* Top controls — View switcher */}
            <div className="mb-2.5 flex flex-shrink-0 flex-col gap-1.5">
              <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card px-4 py-2 shadow-sm">
                <div className="flex-1">
                  <ViewSwitcherTabs
                    availableViews={availableViews}
                    activeView={activeView}
                    onViewChange={(v) => {
                      setActiveView(v);
                      setActivePlacementKey(null);
                      setHoverPlacement(null);
                      setDesignSelected(false);
                    }}
                  />
                </div>
                {designAttrs && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={undoDesign}
                      disabled={!canUndoDesign}
                      title={t('Буцаах', 'Undo')}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-40"
                    >
                      <Undo2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={redoDesign}
                      disabled={!canRedoDesign}
                      title={t('Дахин хийх', 'Redo')}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-40"
                    >
                      <Redo2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAsset(null);
                        setDesignSelected(false);
                      }}
                      title={t('Дизайн устгах', 'Delete design')}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-border hover:bg-destructive/10 hover:border-destructive/50 transition-colors text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Canvas area wrapper — preset at left, image preview at right */}
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex min-h-0 flex-1 items-start gap-3">
                <div className="w-[124px] flex-shrink-0">
                  <PlacementPresetBar
                    placements={placementEngine.placements}
                    activePlacementKey={activePlacementKey}
                    onPresetSelect={(placement) => {
                      setActivePlacementKey(placement.placementKey);
                      setHoverPlacement(null);
                    }}
                    onPresetHover={setHoverPlacement}
                    orientation="vertical"
                  />
                </div>

                <div ref={canvasContainerRef} className="flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden">
                  <div
                    className="relative"
                    style={{ width: canvasWidth, height: Math.round(canvasWidth * 0.75) }}
                  >
                    <div
                      className="relative h-full w-full"
                      onClick={(e) => {
                        if (e.target === e.currentTarget) setDesignSelected(false);
                      }}
                    >
                      <KonvaCustomizeCanvas
                        view={activeView}
                        imageSrc={viewImages[activeView] ?? null}
                        canvasWidth={canvasWidth}
                        onImageMetaChange={({ naturalWidth, naturalHeight }) => {
                          setViewImageNaturalSize((prev) => {
                            const current = prev[activeView];
                            if (current && current.width === naturalWidth && current.height === naturalHeight) {
                              return prev;
                            }
                            return {
                              ...prev,
                              [activeView]: { width: naturalWidth, height: naturalHeight },
                            };
                          });
                        }}
                        ghostRect={designAttrs ? null : ghostRect}
                        ghostRectEditable={!designAttrs && Boolean(ghostRect)}
                        onGhostRectChange={setEditableGhostRect}
                        showGhostCoordinates={showPlacementCoordinates}
                        isOutsideSafeArea={isOutsideSafeArea}
                      >
                        {designImage && designAttrs && naturalDesignSize && (
                          <KonvaDesignImage
                            imageElement={designImage}
                            naturalWidth={naturalDesignSize.width}
                            naturalHeight={naturalDesignSize.height}
                            attrs={designAttrs}
                            onChangeEnd={handleDesignChangeEnd}
                            isSelected={designSelected}
                            onSelect={() => setDesignSelected(true)}
                          />
                        )}
                      </KonvaCustomizeCanvas>

                      <div
                        data-testid="ghost-rect-metrics"
                        data-view={ghostRectMetrics?.view ?? ''}
                        data-placement-key={ghostRectMetrics?.placementKey ?? ''}
                        data-x={ghostRectMetrics ? String(ghostRectMetrics.x) : ''}
                        data-y={ghostRectMetrics ? String(ghostRectMetrics.y) : ''}
                        data-width={ghostRectMetrics ? String(ghostRectMetrics.width) : ''}
                        data-height={ghostRectMetrics ? String(ghostRectMetrics.height) : ''}
                        data-canvas-width={ghostRectMetrics ? String(ghostRectMetrics.canvasWidth) : ''}
                        data-canvas-height={ghostRectMetrics ? String(ghostRectMetrics.canvasHeight) : ''}
                        className="sr-only"
                      />

                      {designAttrs && naturalDesignSize && (
                        <div className="pointer-events-none absolute bottom-2 left-2">
                          <DesignSizeIndicator
                            attrs={designAttrs}
                            naturalWidth={naturalDesignSize.width}
                            naturalHeight={naturalDesignSize.height}
                            displayScale={placementEngine.displayScale}
                            pxPerCmInImage={placementEngine.pxPerCmInImage}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Status messages below canvas */}
            <div className="mt-3 flex flex-col gap-2">
              {designImageStatus === 'loading' && asset && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {t('Дизайн ачааллаж байна...', 'Loading design onto canvas...')}
                </div>
              )}

              {mockupPreviewLoading && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {t('Mockup бэлтгэж байна...', 'Generating mockup preview...')}
                </div>
              )}

              {isOutsideSafeArea && (
                <p className="text-xs font-medium text-red-600 dark:text-red-400">
                  {t('Дизайн хэвлэх талбайгаас гарч байна — дотогш зөөнө үү', 'Design extends outside the print area — move it inward')}
                </p>
              )}

              {strictModeMissingViewImage && (
                <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                  {t(
                    'Энэ view-д template зураг дутуу байна. Strict mode идэвхтэй тул variant fallback ашиглахгүй.',
                    'This view is missing a template image. Strict mode is enabled, so variant fallback is blocked.'
                  )}
                </p>
              )}
            </div>

            {mockupPreviewUrl && (
              <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                <div className="border-b border-border px-4 py-3">
                  <h2 className="text-sm font-semibold text-foreground">{t('Урьдчилан харах', 'Preview')}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {activeArea ? t(`${activeArea.label} — урьдчилан харах`, `${activeArea.label} preview`) : ''}
                  </p>
                </div>
                <div className="p-4">
                  <div className="mx-auto w-full" style={{ maxWidth: canvasWidth }}>
                    <AutoMockupPreview
                      previewUrl={mockupPreviewUrl}
                      fallbackUrl={baseImage}
                      loading={mockupPreviewLoading}
                      error={mockupPreviewError}
                      activeAreaLabel={activeArea?.label || null}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ─────────── RIGHT: configuration sidebar (fixed 420px, scrollable) ─────────────────────────────── */}
          <div className="w-[420px] min-h-0 flex-shrink-0 overflow-y-auto border-l border-border bg-card">
            <div className="space-y-4 p-6">

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
