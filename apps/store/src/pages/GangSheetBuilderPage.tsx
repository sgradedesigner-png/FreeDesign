/**
 * GangSheetBuilderPage.tsx
 * P3-03 — Gang sheet builder MVP
 *
 * Route: /builder/:productSlug
 *
 * Features:
 * - Load product info → create or resume existing DRAFT project
 * - Interactive canvas (drag items, select, delete, rotate, flip, z-order)
 * - Debounced autosave to /api/builder/projects/:id
 * - Unsaved-state guard (beforeunload)
 * - Preview render request + status polling
 * - Add-to-cart (stub → P3-04 handoff)
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  createBuilderProject,
  listBuilderProjects,
  updateBuilderProject,
  lockBuilderProject,
  requestPreviewRender,
  getPreviewStatus,
  type BuilderProject,
  type CanvasItem,
  type PreviewJob,
} from '@/data/builder.api';
import { useCart } from '@/context/CartContext';
import { BuilderCanvas }     from '@/components/builder/BuilderCanvas';
import { BuilderToolbar }    from '@/components/builder/BuilderToolbar';
import { BuilderAssetPanel } from '@/components/builder/BuilderAssetPanel';
import { BuilderFooterBar }  from '@/components/builder/BuilderFooterBar';

// ── Constants ────────────────────────────────────────────────────────────────
const AUTOSAVE_DELAY_MS  = 1500;
const PREVIEW_POLL_MS    = 4000;
const CANVAS_WIDTH_CM    = 60;  // Default gang sheet width
const CANVAS_HEIGHT_CM   = 90; // Default length

// ── Helpers ──────────────────────────────────────────────────────────────────
function normaliseZIndexes(items: CanvasItem[]): CanvasItem[] {
  return [...items].sort((a, b) => a.zIndex - b.zIndex).map((item, i) => ({ ...item, zIndex: i }));
}

// ── Component ────────────────────────────────────────────────────────────────
export default function GangSheetBuilderPage() {
  const { productSlug } = useParams<{ productSlug: string }>();
  const navigate        = useNavigate();
  const { addBuilderItem, setIsCartOpen } = useCart();

  // Auth
  const [userId, setUserId]       = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Product / project
  const [productId, setProductId]   = useState<string | null>(null);
  const [productMeta, setProductMeta] = useState<{
    name: string; slug: string; category: string;
    variant: { id: string; name: string; price: number; originalPrice?: number | null; imagePath: string; sku: string };
  } | null>(null);
  const [project, setProject]       = useState<BuilderProject | null>(null);
  const [loading, setLoading]       = useState(true);
  const [resumeCandidate, setResumeCandidate] = useState<BuilderProject | null>(null);

  // Canvas state
  const [items, setItems]         = useState<CanvasItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const isDirty = useRef(false);

  // Autosave
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isSaving, setIsSaving]       = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  // Preview
  const [preview, setPreview]             = useState<PreviewJob | null>(null);
  const [requestingPreview, setRequestingPreview] = useState(false);
  const previewPollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Add to cart
  const [addingToCart, setAddingToCart] = useState(false);

  // ── Auth check ─────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user.id ?? null);
      setAuthChecked(true);
    });
  }, []);

  useEffect(() => {
    if (authChecked && !userId) {
      toast.error('Please log in to use the builder');
      navigate(`/login?redirect=/builder/${productSlug}`);
    }
  }, [authChecked, userId, navigate, productSlug]);

  // ── Load product + existing project ────────────────────────────────────────
  useEffect(() => {
    if (!userId || !productSlug) return;

    (async () => {
      setLoading(true);
      try {
        // Fetch product id by slug
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/products?slug=${productSlug}`);
        const data = await res.json();
        const prod = data.items?.[0] ?? data.product ?? null;

        if (!prod) {
          toast.error('Product not found');
          navigate('/products');
          return;
        }

        setProductId(prod.id);

        // Store product meta + first available variant for cart payload
        const firstVariant = prod.variants?.[0];
        if (firstVariant) {
          setProductMeta({
            name: prod.title ?? prod.name ?? productSlug ?? '',
            slug: prod.slug,
            category: prod.category?.name ?? prod.productFamily ?? 'gang-sheet',
            variant: {
              id: firstVariant.id,
              name: firstVariant.name,
              price: Number(firstVariant.price),
              originalPrice: firstVariant.originalPrice != null ? Number(firstVariant.originalPrice) : null,
              imagePath: firstVariant.imagePath ?? firstVariant.image_path ?? '',
              sku: firstVariant.sku,
            },
          });
        }

        // Check for existing DRAFT project on this product
        const projects = await listBuilderProjects();
        const existing = projects.find(
          (p) => p.productId === prod.id && p.status === 'DRAFT',
        );

        if (existing) {
          setResumeCandidate(existing);
        } else {
          const newProj = await createBuilderProject({
            productId:      prod.id,
            canvasWidthCm:  CANVAS_WIDTH_CM,
            canvasHeightCm: CANVAS_HEIGHT_CM,
            title:          `${prod.title} — Gang Sheet`,
          });
          setProject(newProj);
          setItems(newProj.items);
        }
      } catch (err) {
        toast.error('Failed to load builder');
      } finally {
        setLoading(false);
      }
    })();
  }, [userId, productSlug, navigate]);

  // ── Resume / start fresh ────────────────────────────────────────────────────
  const handleResume = useCallback(() => {
    if (!resumeCandidate) return;
    setProject(resumeCandidate);
    setItems(resumeCandidate.items);
    setResumeCandidate(null);
  }, [resumeCandidate]);

  const handleStartFresh = useCallback(async () => {
    if (!productId) return;
    setLoading(true);
    try {
      const newProj = await createBuilderProject({
        productId,
        canvasWidthCm:  CANVAS_WIDTH_CM,
        canvasHeightCm: CANVAS_HEIGHT_CM,
      });
      setProject(newProj);
      setItems(newProj.items);
      setResumeCandidate(null);
    } catch {
      toast.error('Failed to start new project');
    } finally {
      setLoading(false);
    }
  }, [productId]);

  // ── Autosave ────────────────────────────────────────────────────────────────
  const scheduleAutosave = useCallback((newItems: CanvasItem[]) => {
    isDirty.current = true;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);

    autosaveTimer.current = setTimeout(async () => {
      if (!project) return;
      setIsSaving(true);
      try {
        await updateBuilderProject(project.id, { items: newItems });
        setLastSavedAt(new Date());
        isDirty.current = false;
      } catch {
        toast.error('Autosave failed');
      } finally {
        setIsSaving(false);
      }
    }, AUTOSAVE_DELAY_MS);
  }, [project]);

  // ── Unsaved-state guard ─────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  // ── Preview polling ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!project) return;
    if (preview?.status === 'COMPLETE' || preview?.status === 'FAILED') {
      if (previewPollTimer.current) clearInterval(previewPollTimer.current);
      return;
    }
    if (preview?.status === 'PENDING' || preview?.status === 'PROCESSING') {
      previewPollTimer.current = setInterval(async () => {
        const updated = await getPreviewStatus(project.id).catch(() => null);
        if (updated) setPreview(updated);
      }, PREVIEW_POLL_MS);
    }
    return () => {
      if (previewPollTimer.current) clearInterval(previewPollTimer.current);
    };
  }, [preview?.status, project]);

  // ── Canvas item operations ──────────────────────────────────────────────────
  const updateItems = useCallback((next: CanvasItem[]) => {
    const normalised = normaliseZIndexes(next);
    setItems(normalised);
    scheduleAutosave(normalised);
  }, [scheduleAutosave]);

  const handleAddItem = useCallback((item: Omit<CanvasItem, 'id'>) => {
    const withId: CanvasItem = { ...item, id: `local-${Date.now()}` };
    updateItems([...items, withId]);
  }, [items, updateItems]);

  const handleMove = useCallback((id: string, xCm: number, yCm: number) => {
    updateItems(items.map((it) => it.id === id ? { ...it, xCm, yCm } : it));
  }, [items, updateItems]);

  const selectedItem = items.find((it) => it.id === selectedId) ?? null;

  const handleDelete = useCallback(() => {
    if (!selectedId) return;
    updateItems(items.filter((it) => it.id !== selectedId));
    setSelectedId(null);
  }, [selectedId, items, updateItems]);

  const handleRotate = useCallback((deg: number) => {
    if (!selectedId) return;
    updateItems(items.map((it) => it.id === selectedId ? { ...it, rotation: it.rotation + deg } : it));
  }, [selectedId, items, updateItems]);

  const handleFlipH = useCallback(() => {
    if (!selectedId) return;
    updateItems(items.map((it) => it.id === selectedId ? { ...it, flipH: !it.flipH } : it));
  }, [selectedId, items, updateItems]);

  const handleFlipV = useCallback(() => {
    if (!selectedId) return;
    updateItems(items.map((it) => it.id === selectedId ? { ...it, flipV: !it.flipV } : it));
  }, [selectedId, items, updateItems]);

  const handleZUp = useCallback(() => {
    if (!selectedId) return;
    const idx = items.findIndex((it) => it.id === selectedId);
    if (idx < items.length - 1) {
      const next = [...items];
      [next[idx], next[idx + 1]] = [next[idx + 1]!, next[idx]!];
      updateItems(next);
    }
  }, [selectedId, items, updateItems]);

  const handleZDown = useCallback(() => {
    if (!selectedId) return;
    const idx = items.findIndex((it) => it.id === selectedId);
    if (idx > 0) {
      const next = [...items];
      [next[idx], next[idx - 1]] = [next[idx - 1]!, next[idx]!];
      updateItems(next);
    }
  }, [selectedId, items, updateItems]);

  const handleResize = useCallback((widthCm: number, heightCm: number) => {
    if (!selectedId) return;
    updateItems(items.map((it) => it.id === selectedId ? { ...it, widthCm, heightCm } : it));
  }, [selectedId, items, updateItems]);

  // ── Preview request ─────────────────────────────────────────────────────────
  const handleRequestPreview = useCallback(async () => {
    if (!project) return;
    setRequestingPreview(true);
    try {
      await requestPreviewRender(project.id);
      const status = await getPreviewStatus(project.id);
      setPreview(status);
    } catch {
      toast.error('Failed to request preview');
    } finally {
      setRequestingPreview(false);
    }
  }, [project]);

  // ── Add to cart (P3-04) ─────────────────────────────────────────────────────
  const handleAddToCart = useCallback(async () => {
    if (!project || items.length === 0 || !productMeta) return;
    setAddingToCart(true);
    try {
      // 1. Flush any pending autosave
      if (autosaveTimer.current) {
        clearTimeout(autosaveTimer.current);
        autosaveTimer.current = null;
      }
      await updateBuilderProject(project.id, { items });
      setLastSavedAt(new Date());
      isDirty.current = false;

      // 2. Lock project: mark READY + freeze immutable version snapshot
      await lockBuilderProject(project.id);

      // 3. Add builder item to cart
      addBuilderItem({
        product: {
          id: project.productId,
          name: productMeta.name,
          slug: productMeta.slug,
          category: productMeta.category,
        },
        variant: productMeta.variant,
        builderProjectId: project.id,
        unitPrice: productMeta.variant.price,
      });

      // 4. Open cart and navigate
      setIsCartOpen(true);
      navigate('/cart');
    } catch {
      toast.error('Failed to add to cart');
    } finally {
      setAddingToCart(false);
    }
  }, [project, items, productMeta, addBuilderItem, setIsCartOpen, navigate]);

  // ── Render ──────────────────────────────────────────────────────────────────
  if (!authChecked || loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <Loader2 size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  // Resume prompt
  if (resumeCandidate) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="max-w-sm w-full p-6 border rounded-xl bg-card shadow space-y-4 text-center">
          <h2 className="text-lg font-semibold">Resume previous project?</h2>
          <p className="text-sm text-muted-foreground">
            You have an unfinished gang sheet from{' '}
            {new Date(resumeCandidate.updatedAt).toLocaleDateString()}.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleStartFresh}
              className="flex-1 rounded border border-border px-4 py-2 text-sm hover:bg-muted transition-colors"
            >
              Start fresh
            </button>
            <button
              type="button"
              onClick={handleResume}
              className="flex-1 rounded bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Resume
            </button>
          </div>
        </div>
      </div>
    );
  }

  const canvasW = project?.canvasWidthCm  ?? CANVAS_WIDTH_CM;
  const canvasH = project?.canvasHeightCm ?? CANVAS_HEIGHT_CM;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2 border-b bg-card shrink-0">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-1 rounded hover:bg-accent transition-colors"
          title="Back"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-sm font-semibold truncate">
          {project?.title ?? 'Gang Sheet Builder'}
        </h1>
        <span className="ml-auto text-xs text-muted-foreground">
          {canvasW}×{canvasH} cm · {items.length} item{items.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Toolbar */}
      <BuilderToolbar
        selected={selectedItem}
        onDelete={handleDelete}
        onRotate={handleRotate}
        onFlipH={handleFlipH}
        onFlipV={handleFlipV}
        onZUp={handleZUp}
        onZDown={handleZDown}
      />

      {/* Main area */}
      <div className="flex flex-1 min-h-0">
        {/* Canvas */}
        <BuilderCanvas
          widthCm={canvasW}
          heightCm={canvasH}
          items={items}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onMove={handleMove}
        />

        {/* Right panel */}
        <BuilderAssetPanel
          canvasWidthCm={canvasW}
          canvasHeightCm={canvasH}
          selected={selectedItem}
          onAddItem={handleAddItem}
          onResizeSelected={handleResize}
        />
      </div>

      {/* Footer */}
      <BuilderFooterBar
        isSaving={isSaving}
        lastSavedAt={lastSavedAt}
        itemCount={items.length}
        preview={preview}
        isRequestingPreview={requestingPreview}
        onRequestPreview={handleRequestPreview}
        onAddToCart={handleAddToCart}
        isAddingToCart={addingToCart}
      />
    </div>
  );
}
