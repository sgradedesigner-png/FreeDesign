import { useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import type {
  CustomizationTemplateV1,
  LayoutPreset,
  LayoutViewKey,
  WizardFormData,
} from '@/hooks/useProductWizard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Loader2, Check, Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type PrintArea = {
  id: string;
  name: string;
  label: string;
  maxWidthCm: number;
  maxHeightCm: number;
  sortOrder: number;
};

type SizeTier = {
  id: string;
  name: string;
  label: string;
  widthCm: number;
  heightCm: number;
  sortOrder: number;
};

type Step4_PrintConfigProps = {
  form: UseFormReturn<WizardFormData>;
};

const VIEW_OPTIONS: Array<{ key: LayoutViewKey; label: string }> = [
  { key: 'front', label: 'Front' },
  { key: 'back', label: 'Back' },
  { key: 'left', label: 'Left Sleeve' },
  { key: 'right', label: 'Right Sleeve' },
];

function createEmptyTemplate(): CustomizationTemplateV1 {
  return {
    version: 1,
    views: {},
    presets: [],
  };
}

function clampRect(rect: LayoutPreset['rectNorm']): LayoutPreset['rectNorm'] {
  const x = Math.min(1, Math.max(0, rect.x));
  const y = Math.min(1, Math.max(0, rect.y));
  const w = Math.min(1, Math.max(0.001, rect.w));
  const h = Math.min(1, Math.max(0.001, rect.h));
  return {
    x,
    y,
    w: Math.min(w, 1 - x),
    h: Math.min(h, 1 - y),
  };
}

type DragMode = 'move' | 'tl' | 'tr' | 'bl' | 'br';

type DragState = {
  mode: DragMode;
  startX: number;
  startY: number;
  startRect: LayoutPreset['rectNorm'];
};

function parseFinite(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

type ViewImageEntry = {
  path: string;
  nameHint?: string;
};

function uniqueEntries(entries: ViewImageEntry[]): ViewImageEntry[] {
  const seen = new Set<string>();
  const out: ViewImageEntry[] = [];
  entries.forEach((entry) => {
    const path = entry.path?.trim();
    if (!path || seen.has(path)) return;
    seen.add(path);
    out.push({ path, nameHint: entry.nameHint });
  });
  return out;
}

function pickViewsFromNamedPaths(entries: ViewImageEntry[]) {
  const unique = uniqueEntries(entries);
  const result: Partial<Record<LayoutViewKey, string>> = {};
  const used = new Set<string>();

  const matches = (entry: ViewImageEntry, pattern: RegExp) => {
    const raw = entry.path.split('?')[0];
    const filename = entry.nameHint?.trim() || raw.split('/').pop() || raw;
    return pattern.test(filename.toLowerCase());
  };

  const tryAssign = (view: LayoutViewKey, pattern: RegExp) => {
    if (result[view]) return;
    const candidate = unique.find((entry) => !used.has(entry.path) && matches(entry, pattern));
    if (!candidate) return;
    result[view] = candidate.path;
    used.add(candidate.path);
  };

  tryAssign('front', /(^|[^a-z])(front|frt)([^a-z]|$)/i);
  tryAssign('back', /(^|[^a-z])back([^a-z]|$)/i);
  tryAssign('left', /(^|[^a-z])(leftsleeve|left_sleeve|left-sleeve|leftside|left_side|left-side|left|ls)([^a-z]|$)/i);
  tryAssign('right', /(^|[^a-z])(rightsleeve|right_sleeve|right-sleeve|rightside|right_side|right-side|right|rs)([^a-z]|$)/i);

  const remaining = unique.filter((entry) => !used.has(entry.path));
  (['front', 'back', 'left', 'right'] as LayoutViewKey[]).forEach((view) => {
    if (!result[view] && remaining.length > 0) {
      result[view] = remaining.shift()!.path;
    }
  });

  return {
    front: result.front ?? '',
    back: result.back ?? '',
    left: result.left ?? '',
    right: result.right ?? '',
  };
}

function collectFirstVariantViewImages(form: UseFormReturn<WizardFormData>) {
  const firstVariant = form.getValues('variants')?.[0];
  if (!firstVariant) return null;

  const stableOrdered: ViewImageEntry[] = [
    { path: firstVariant.imagePath ?? '' },
    ...((firstVariant.galleryPaths ?? []).map((path: string) => ({ path }))),
  ];
  const previewOrdered: ViewImageEntry[] = [
    { path: firstVariant.previewUrl ?? '', nameHint: firstVariant.pendingImage?.name },
    { path: firstVariant.imagePath ?? '' },
    ...((firstVariant.galleryPreviewUrls ?? []).map((path: string, index: number) => ({
      path,
      nameHint: firstVariant.pendingGalleryImages?.[index]?.name,
    }))),
    ...((firstVariant.galleryPaths ?? []).map((path: string) => ({ path }))),
  ];

  if (uniqueEntries(stableOrdered).length === 0 && uniqueEntries(previewOrdered).length === 0) return null;
  return {
    stable: pickViewsFromNamedPaths(stableOrdered),
    preview: pickViewsFromNamedPaths(previewOrdered),
  } as const;
}

function resolveAdminImageSrc(path?: string): string | null {
  const raw = path?.trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (!raw.startsWith('/')) return raw;

  const baseURL = String(api.defaults.baseURL ?? '');
  if (!baseURL) return raw;

  try {
    const base = new URL(baseURL);
    return `${base.origin}${raw}`;
  } catch {
    return raw;
  }
}

function getContainFrameNormalized(hostAspectRatio: number, imageAspectRatio: number) {
  if (!Number.isFinite(hostAspectRatio) || hostAspectRatio <= 0 || !Number.isFinite(imageAspectRatio) || imageAspectRatio <= 0) {
    return { x: 0, y: 0, w: 1, h: 1 };
  }

  // Image fills width (letterbox top/bottom)
  if (imageAspectRatio >= hostAspectRatio) {
    const h = hostAspectRatio / imageAspectRatio;
    return { x: 0, y: (1 - h) / 2, w: 1, h };
  }

  // Image fills height (pillarbox left/right)
  const w = imageAspectRatio / hostAspectRatio;
  return { x: (1 - w) / 2, y: 0, w, h: 1 };
}

function getContainFramePx(
  hostWidth: number,
  hostHeight: number,
  imageWidth: number,
  imageHeight: number
) {
  if (hostWidth <= 0 || hostHeight <= 0 || imageWidth <= 0 || imageHeight <= 0) {
    return { x: 0, y: 0, w: hostWidth, h: hostHeight };
  }
  const hostAR = hostWidth / hostHeight;
  const imageAR = imageWidth / imageHeight;
  const frameN = getContainFrameNormalized(hostAR, imageAR);
  return {
    x: frameN.x * hostWidth,
    y: frameN.y * hostHeight,
    w: frameN.w * hostWidth,
    h: frameN.h * hostHeight,
  };
}

export function Step4_PrintConfig({ form }: Step4_PrintConfigProps) {
  const navigate = useNavigate();
  const [printAreas, setPrintAreas] = useState<PrintArea[]>([]);
  const [sizeTiers, setSizeTiers] = useState<SizeTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [layoutHint, setLayoutHint] = useState<string | null>(null);
  const [previewImageError, setPreviewImageError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<LayoutViewKey>('front');
  const [activePresetIdByView, setActivePresetIdByView] = useState<
    Partial<Record<LayoutViewKey, string>>
  >({});
  const dragStateRef = useRef<DragState | null>(null);

  const selectedAreas = form.watch('printAreas') || [];
  const template = form.watch('customizationTemplateV1');
  const variants = form.watch('variants') || [];
  const inferredVariantImages = useMemo(() => collectFirstVariantViewImages(form), [form, variants]);

  useEffect(() => {
    Promise.all([
      api.get('/api/admin/print-areas').then((res) => res.data.areas),
      api.get('/api/admin/size-tiers').then((res) => res.data.tiers),
    ])
      .then(([areas, tiers]) => {
        setPrintAreas(areas);
        setSizeTiers(tiers);
        if (!form.getValues('customizationTemplateV1')) {
          form.setValue('customizationTemplateV1', createEmptyTemplate(), { shouldValidate: true });
        }
        setLoading(false);
      })
      .catch((loadError) => {
        console.error('Failed to fetch print areas or size tiers:', loadError);
        setError('Failed to load print configuration options');
        setLoading(false);
      });
  }, [form]);

  useEffect(() => {
    const inferred = collectFirstVariantViewImages(form);
    if (!inferred) return;

    const current = form.getValues('customizationTemplateV1') ?? createEmptyTemplate();
    const currentViews = current.views ?? {};
    const nextViews = {
      front: { ...(currentViews.front ?? {}) },
      back: { ...(currentViews.back ?? {}) },
      left: { ...(currentViews.left ?? {}) },
      right: { ...(currentViews.right ?? {}) },
    };

    let changed = false;
    (['front', 'back', 'left', 'right'] as LayoutViewKey[]).forEach((key) => {
      const existing = currentViews[key]?.imagePath?.trim();
      const candidate = inferred.stable[key]?.trim();
      if (!existing && candidate) {
        nextViews[key].imagePath = candidate;
        changed = true;
      }
    });

    if (!changed) return;
    form.setValue(
      'customizationTemplateV1',
      {
        ...current,
        views: nextViews,
      },
      { shouldDirty: true, shouldValidate: true }
    );
  }, [form, variants]);

  const effectiveTemplate = template ?? createEmptyTemplate();
  const activeViewImagePath = effectiveTemplate.views?.[activeView]?.imagePath ?? '';
  const activeViewPreviewPath =
    activeViewImagePath || inferredVariantImages?.preview?.[activeView] || '';
  const activeViewMeta = effectiveTemplate.views?.[activeView];
  const activeViewNatural = useMemo(
    () => ({
      width: activeViewMeta?.naturalWidth ?? 1536,
      height: activeViewMeta?.naturalHeight ?? 1024,
    }),
    [activeViewMeta?.naturalHeight, activeViewMeta?.naturalWidth]
  );
  const containFrameN = useMemo(
    () => getContainFrameNormalized(4 / 3, activeViewNatural.width / Math.max(1, activeViewNatural.height)),
    [activeViewNatural.height, activeViewNatural.width]
  );
  const activeViewImageSrc = useMemo(
    () => resolveAdminImageSrc(activeViewPreviewPath),
    [activeViewPreviewPath]
  );

  useEffect(() => {
    setPreviewImageError(null);
  }, [activeView, activeViewImagePath]);

  const presetsInView = useMemo(
    () =>
      effectiveTemplate.presets
        .map((preset, index) => ({ preset, index }))
        .filter(({ preset }) => preset.view === activeView)
        .sort((a, b) => (a.preset.sortOrder ?? 0) - (b.preset.sortOrder ?? 0)),
    [activeView, effectiveTemplate.presets]
  );
  const activePresetEntry = useMemo(() => {
    if (presetsInView.length === 0) return null;
    const selectedId = activePresetIdByView[activeView];
    const matched = selectedId
      ? presetsInView.find(({ preset }) => preset.id === selectedId)
      : undefined;
    return matched ?? presetsInView[0];
  }, [activePresetIdByView, activeView, presetsInView]);

  useEffect(() => {
    if (presetsInView.length === 0) return;
    const selectedId = activePresetIdByView[activeView];
    const exists = selectedId
      ? presetsInView.some(({ preset }) => preset.id === selectedId)
      : false;
    if (!exists) {
      setActivePresetIdByView((prev) => ({
        ...prev,
        [activeView]: presetsInView[0].preset.id,
      }));
    }
  }, [activePresetIdByView, activeView, presetsInView]);

  const updateTemplate = (updater: (current: CustomizationTemplateV1) => CustomizationTemplateV1) => {
    const current = form.getValues('customizationTemplateV1') ?? createEmptyTemplate();
    const next = updater(current);
    form.setValue('customizationTemplateV1', next, { shouldDirty: true, shouldValidate: true });
  };

  const toggleArea = (areaId: string) => {
    const next = selectedAreas.includes(areaId)
      ? selectedAreas.filter((id) => id !== areaId)
      : [...selectedAreas, areaId];
    form.setValue('printAreas', next, { shouldValidate: true });
  };

  const setDefaultArea = (areaId: string) => {
    form.setValue('printAreaDefaults', { [areaId]: true }, { shouldValidate: true });
  };

  const addPreset = () => {
    const nextId = crypto.randomUUID();
    updateTemplate((current) => {
      const existingInView = current.presets.filter((preset) => preset.view === activeView);
      const sortOrder = existingInView.length === 0
        ? 10
        : Math.max(...existingInView.map((preset) => preset.sortOrder || 0)) + 10;
      const nextPreset: LayoutPreset = {
        id: nextId,
        key: `${activeView}_preset_${existingInView.length + 1}`,
        labelMn: '',
        labelEn: `${VIEW_OPTIONS.find((item) => item.key === activeView)?.label ?? activeView} Preset ${existingInView.length + 1}`,
        view: activeView,
        rectNorm: { x: 0.35, y: 0.2, w: 0.3, h: 0.3 },
        printAreaId: null,
        sortOrder,
        isDefault: existingInView.length === 0,
      };
      return { ...current, presets: [...current.presets, nextPreset] };
    });
    setActivePresetIdByView((prev) => ({ ...prev, [activeView]: nextId }));
  };

  const updatePreset = (index: number, updater: (preset: LayoutPreset) => LayoutPreset) => {
    updateTemplate((current) => ({
      ...current,
      presets: current.presets.map((preset, presetIndex) =>
        presetIndex === index ? updater(preset) : preset
      ),
    }));
  };

  const removePreset = (index: number) => {
    updateTemplate((current) => ({
      ...current,
      presets: current.presets.filter((_, presetIndex) => presetIndex !== index),
    }));
  };

  const setPresetDefault = (index: number, view: LayoutViewKey) => {
    updateTemplate((current) => ({
      ...current,
      presets: current.presets.map((preset, presetIndex) => ({
        ...preset,
        isDefault: preset.view === view ? presetIndex === index : preset.isDefault,
      })),
    }));
  };

  const updateViewMeta = (
    view: LayoutViewKey,
    patch: Partial<NonNullable<CustomizationTemplateV1['views'][LayoutViewKey]>>
  ) => {
    updateTemplate((current) => ({
      ...current,
      views: {
        ...current.views,
        [view]: {
          ...(current.views?.[view] ?? {}),
          ...patch,
        },
      },
    }));
  };

  const autofillFromVariantImages = () => {
    const inferred = collectFirstVariantViewImages(form);
    if (!inferred) {
      setLayoutHint('First variant has no image yet (previewUrl/imagePath/gallery).');
      return;
    }
    if (
      !inferred.stable.front &&
      !inferred.stable.back &&
      !inferred.stable.left &&
      !inferred.stable.right
    ) {
      setLayoutHint('Variant images are local preview only (blob). Save/upload images first to persist view image paths.');
      return;
    }

    updateTemplate((current) => ({
      ...current,
      views: {
        ...current.views,
        front: { ...(current.views.front ?? {}), imagePath: inferred.stable.front || current.views.front?.imagePath },
        back: { ...(current.views.back ?? {}), imagePath: inferred.stable.back || current.views.back?.imagePath },
        left: { ...(current.views.left ?? {}), imagePath: inferred.stable.left || current.views.left?.imagePath },
        right: { ...(current.views.right ?? {}), imagePath: inferred.stable.right || current.views.right?.imagePath },
      },
    }));
    setLayoutHint(
      'View image paths were autofilled from first variant uploaded image/gallery (front/back/left/right order).'
    );
  };

  const startRectInteraction = (
    event: ReactMouseEvent<HTMLElement>,
    mode: DragMode,
    current: LayoutPreset['rectNorm']
  ) => {
    event.preventDefault();
    event.stopPropagation();
    dragStateRef.current = {
      mode,
      startX: event.clientX,
      startY: event.clientY,
      startRect: current,
    };
  };

  const handleRectInteraction = (
    event: ReactMouseEvent<HTMLDivElement>,
    presetIndex: number,
    baseRect: LayoutPreset['rectNorm']
  ) => {
    const dragState = dragStateRef.current;
    if (!dragState) return;

    const host = event.currentTarget.getBoundingClientRect();
    const frame = getContainFramePx(
      host.width,
      host.height,
      activeViewNatural.width,
      activeViewNatural.height
    );
    const deltaXNorm = frame.w > 0 ? (event.clientX - dragState.startX) / frame.w : 0;
    const deltaYNorm = frame.h > 0 ? (event.clientY - dragState.startY) / frame.h : 0;

    const s = dragState.startRect;
    let next = baseRect;

    if (dragState.mode === 'move') {
      next = clampRect({
        ...s,
        x: s.x + deltaXNorm,
        y: s.y + deltaYNorm,
      });
    }

    if (dragState.mode === 'tl') {
      const x2 = s.x + s.w;
      const y2 = s.y + s.h;
      next = clampRect({
        x: s.x + deltaXNorm,
        y: s.y + deltaYNorm,
        w: x2 - (s.x + deltaXNorm),
        h: y2 - (s.y + deltaYNorm),
      });
    }

    if (dragState.mode === 'tr') {
      const y2 = s.y + s.h;
      next = clampRect({
        x: s.x,
        y: s.y + deltaYNorm,
        w: s.w + deltaXNorm,
        h: y2 - (s.y + deltaYNorm),
      });
    }

    if (dragState.mode === 'bl') {
      const x2 = s.x + s.w;
      next = clampRect({
        x: s.x + deltaXNorm,
        y: s.y,
        w: x2 - (s.x + deltaXNorm),
        h: s.h + deltaYNorm,
      });
    }

    if (dragState.mode === 'br') {
      next = clampRect({
        x: s.x,
        y: s.y,
        w: s.w + deltaXNorm,
        h: s.h + deltaYNorm,
      });
    }

    updatePreset(presetIndex, (current) => ({
      ...current,
      rectNorm: next,
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="py-8">
          <p className="text-center text-destructive">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Layout Template (Normalized 0..1)</CardTitle>
          <CardDescription>
            Author canonical placement geometry in normalized image-space coordinates.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={activeView} onValueChange={(value) => setActiveView(value as LayoutViewKey)}>
            <TabsList className="w-full">
              {VIEW_OPTIONS.map((item) => (
                <TabsTrigger key={item.key} value={item.key} className="flex-1">
                  {item.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="hidden space-y-2 md:col-span-3">
              <button
                type="button"
                className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm hover:bg-muted"
                onClick={autofillFromVariantImages}
              >
                Autofill View Paths From First Variant
              </button>
              {layoutHint && <p className="text-xs text-muted-foreground">{layoutHint}</p>}
            </div>
            <div className="hidden space-y-2 md:col-span-3">
              <Label>View Image Path ({activeView})</Label>
              <Input
                value={activeViewImagePath}
                onChange={(e) => updateViewMeta(activeView, { imagePath: e.target.value })}
                placeholder="/uploads/products/sweatshirt-front.png"
              />
              <p className="text-xs text-muted-foreground">
                Use uploaded file path with extension (example: <code>/uploads/products/name.png</code>).
              </p>
              {previewImageError && (
                <p className="text-xs text-destructive">{previewImageError}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Natural Width (px)</Label>
              <Input
                type="number"
                min={1}
                value={effectiveTemplate.views?.[activeView]?.naturalWidth ?? ''}
                onChange={(e) =>
                  updateViewMeta(activeView, {
                    naturalWidth: parseFinite(e.target.value, 0) || undefined,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Natural Height (px)</Label>
              <Input
                type="number"
                min={1}
                value={effectiveTemplate.views?.[activeView]?.naturalHeight ?? ''}
                onChange={(e) =>
                  updateViewMeta(activeView, {
                    naturalHeight: parseFinite(e.target.value, 0) || undefined,
                  })
                }
              />
            </div>
            <div className="space-y-2 flex items-end">
              <button
                type="button"
                onClick={addPreset}
                className="inline-flex items-center gap-2 h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm"
              >
                <Plus size={14} />
                Add Preset
              </button>
            </div>
          </div>

          {presetsInView.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No presets for this view. Add at least one preset to drive storefront placement.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {presetsInView.map(({ preset }) => {
                  const isActive = activePresetEntry?.preset.id === preset.id;
                  return (
                    <button
                      key={preset.id ?? preset.key}
                      type="button"
                      className={cn(
                        'h-8 rounded-md border px-3 text-xs',
                        isActive
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-foreground hover:bg-muted'
                      )}
                      onClick={() =>
                        setActivePresetIdByView((prev) => ({ ...prev, [activeView]: preset.id }))
                      }
                    >
                      {preset.labelEn?.trim() || preset.key}
                    </button>
                  );
                })}
              </div>
              {activePresetEntry && (
                <Card key={activePresetEntry.preset.id ?? `${activePresetEntry.preset.key}-${activePresetEntry.index}`}>
                  <CardContent className="pt-4 space-y-3">
                    <div
                      className="relative w-full aspect-[4/3] overflow-hidden rounded-lg border border-border bg-muted/40"
                      onMouseMove={(event) =>
                        handleRectInteraction(
                          event,
                          activePresetEntry.index,
                          activePresetEntry.preset.rectNorm
                        )
                      }
                      onMouseUp={() => {
                        dragStateRef.current = null;
                      }}
                      onMouseLeave={() => {
                        dragStateRef.current = null;
                      }}
                    >
                      {activeViewImageSrc ? (
                        <img
                          src={activeViewImageSrc}
                          alt={`${activeView} preview`}
                          className="absolute inset-0 h-full w-full object-contain"
                          onLoad={(event) => {
                            const img = event.currentTarget;
                            setPreviewImageError(null);
                            if (
                              img.naturalWidth > 0 &&
                              img.naturalHeight > 0 &&
                              (
                                effectiveTemplate.views?.[activeView]?.naturalWidth !== img.naturalWidth ||
                                effectiveTemplate.views?.[activeView]?.naturalHeight !== img.naturalHeight
                              )
                            ) {
                              updateViewMeta(activeView, {
                                naturalWidth: img.naturalWidth,
                                naturalHeight: img.naturalHeight,
                              });
                            }
                          }}
                          onError={() => {
                            setPreviewImageError(
                              `Unable to load image preview for "${activeViewImagePath}". Check path and file extension.`
                            );
                          }}
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                          Set View Image Path to preview and edit placement visually.
                        </div>
                      )}

                      <div
                        className="absolute border-2 border-cyan-400 bg-cyan-200/20"
                        style={{
                          left: `${(containFrameN.x + activePresetEntry.preset.rectNorm.x * containFrameN.w) * 100}%`,
                          top: `${(containFrameN.y + activePresetEntry.preset.rectNorm.y * containFrameN.h) * 100}%`,
                          width: `${activePresetEntry.preset.rectNorm.w * containFrameN.w * 100}%`,
                          height: `${activePresetEntry.preset.rectNorm.h * containFrameN.h * 100}%`,
                        }}
                        onMouseDown={(event) =>
                          startRectInteraction(event, 'move', activePresetEntry.preset.rectNorm)
                        }
                      >
                        {(['tl', 'tr', 'bl', 'br'] as DragMode[]).map((corner) => {
                          const styles =
                            corner === 'tl'
                              ? 'left-[-6px] top-[-6px] cursor-nwse-resize'
                              : corner === 'tr'
                                ? 'right-[-6px] top-[-6px] cursor-nesw-resize'
                                : corner === 'bl'
                                  ? 'left-[-6px] bottom-[-6px] cursor-nesw-resize'
                                  : 'right-[-6px] bottom-[-6px] cursor-nwse-resize';
                          return (
                            <button
                              key={corner}
                              type="button"
                              className={`absolute h-3 w-3 rounded-full border border-white bg-cyan-500 ${styles}`}
                              onMouseDown={(event) =>
                                startRectInteraction(event, corner, activePresetEntry.preset.rectNorm)
                              }
                            />
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={activePresetEntry.preset.isDefault}
                          onCheckedChange={() =>
                            setPresetDefault(activePresetEntry.index, activePresetEntry.preset.view)
                          }
                        />
                        <Label>Default preset for {activeView}</Label>
                      </div>
                      <button
                        type="button"
                        className="text-destructive hover:underline inline-flex items-center gap-1 text-sm"
                        onClick={() => removePreset(activePresetEntry.index)}
                      >
                        <Trash2 size={14} />
                        Delete
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Preset Key</Label>
                        <Input
                          value={activePresetEntry.preset.key}
                          onChange={(e) =>
                            updatePreset(activePresetEntry.index, (current) => ({ ...current, key: e.target.value }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>English Label</Label>
                        <Input
                          value={activePresetEntry.preset.labelEn ?? ''}
                          onChange={(e) =>
                            updatePreset(activePresetEntry.index, (current) => ({ ...current, labelEn: e.target.value }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Mongolian Label</Label>
                        <Input
                          value={activePresetEntry.preset.labelMn ?? ''}
                          onChange={(e) =>
                            updatePreset(activePresetEntry.index, (current) => ({ ...current, labelMn: e.target.value }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Linked Print Area</Label>
                        <Select
                          value={activePresetEntry.preset.printAreaId ?? 'none'}
                          onValueChange={(value) =>
                            updatePreset(activePresetEntry.index, (current) => ({
                              ...current,
                              printAreaId: value === 'none' ? null : value,
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Optional print area mapping" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            {printAreas.map((area) => (
                              <SelectItem key={area.id} value={area.id}>
                                {area.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <NormInput
                        label="x"
                        value={activePresetEntry.preset.rectNorm.x}
                        onChange={(value) =>
                          updatePreset(activePresetEntry.index, (current) => ({
                            ...current,
                            rectNorm: clampRect({ ...current.rectNorm, x: value }),
                          }))
                        }
                      />
                      <NormInput
                        label="y"
                        value={activePresetEntry.preset.rectNorm.y}
                        onChange={(value) =>
                          updatePreset(activePresetEntry.index, (current) => ({
                            ...current,
                            rectNorm: clampRect({ ...current.rectNorm, y: value }),
                          }))
                        }
                      />
                      <NormInput
                        label="w"
                        value={activePresetEntry.preset.rectNorm.w}
                        onChange={(value) =>
                          updatePreset(activePresetEntry.index, (current) => ({
                            ...current,
                            rectNorm: clampRect({ ...current.rectNorm, w: value }),
                          }))
                        }
                      />
                      <NormInput
                        label="h"
                        value={activePresetEntry.preset.rectNorm.h}
                        onChange={(value) =>
                          updatePreset(activePresetEntry.index, (current) => ({
                            ...current,
                            rectNorm: clampRect({ ...current.rectNorm, h: value }),
                          }))
                        }
                      />
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Print Areas</CardTitle>
          <CardDescription>
            Select where customers can place designs (e.g., front, back, sleeve)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {printAreas.length === 0 ? (
            <div className="space-y-3 rounded-lg border border-dashed border-border p-4">
              <p className="text-sm text-muted-foreground">No print areas available.</p>
              <Button type="button" variant="outline" onClick={() => navigate('/print-areas')}>
                Go to Print Areas
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {printAreas.map((area) => {
                const isSelected = selectedAreas.includes(area.id);
                const isDefault = form.watch('printAreaDefaults')?.[area.id] || false;

                return (
                  <PrintAreaCard
                    key={area.id}
                    area={area}
                    selected={isSelected}
                    isDefault={isDefault}
                    onToggle={() => toggleArea(area.id)}
                    onSetDefault={() => setDefaultArea(area.id)}
                  />
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Size Tiers</CardTitle>
          <CardDescription>
            Size tiers are global settings. Manage them once and they apply to all customizable products.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Badge variant="secondary" className="w-fit">Global / Read-only in this step</Badge>
          {sizeTiers.length === 0 ? (
            <div className="space-y-3 rounded-lg border border-dashed border-border p-4">
              <p className="text-sm text-muted-foreground">No size tiers available.</p>
              <Button type="button" variant="outline" onClick={() => navigate('/size-tiers')}>
                Go to Size Tiers
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {sizeTiers.map((tier) => {
                return (
                  <SizeTierCard
                    key={tier.id}
                    tier={tier}
                  />
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function NormInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input
        type="number"
        min={0}
        max={1}
        step={0.001}
        value={value}
        onChange={(e) => onChange(parseFinite(e.target.value, value))}
      />
    </div>
  );
}

function PrintAreaCard({
  area,
  selected,
  isDefault,
  onToggle,
  onSetDefault,
}: {
  area: PrintArea;
  selected: boolean;
  isDefault: boolean;
  onToggle: () => void;
  onSetDefault: () => void;
}) {
  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:shadow-md',
        selected && 'ring-2 ring-primary'
      )}
      onClick={onToggle}
    >
      <CardContent className="pt-6">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <Checkbox checked={selected} onCheckedChange={onToggle} />
            <div>
              <p className="font-medium">{area.label}</p>
              <p className="text-xs text-muted-foreground">
                Max: {area.maxWidthCm}x{area.maxHeightCm} cm
              </p>
            </div>
          </div>
          {selected && isDefault && (
            <Badge variant="default" className="text-xs">
              Default
            </Badge>
          )}
        </div>

        {selected && !isDefault && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSetDefault();
            }}
            className="text-xs text-primary hover:underline"
          >
            Set as default
          </button>
        )}
      </CardContent>
    </Card>
  );
}

function SizeTierCard({
  tier,
}: {
  tier: SizeTier;
}) {
  return (
    <Card
      className="transition-all"
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="font-medium text-sm">{tier.label}</p>
          <Check size={16} className="text-muted-foreground" />
        </div>
        <p className="text-xs text-muted-foreground">
          {tier.widthCm}x{tier.heightCm} cm
        </p>
      </CardContent>
    </Card>
  );
}

