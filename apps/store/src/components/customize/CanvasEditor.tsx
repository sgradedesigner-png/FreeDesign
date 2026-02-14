import { useEffect, useMemo, useRef } from 'react';
import { Canvas, FabricImage, Rect } from 'fabric';
import { RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import type { PrintAreaOption } from './PlacementSelector';

export type CanvasPlacementConfig = {
  offsetX: number;
  offsetY: number;
  rotation: number;
  scale: number;
};

type CanvasEditorProps = {
  productName: string;
  baseImage: string | null;
  designImage: string | null;
  selectedAreas: PrintAreaOption[];
  activeAreaId: string | null;
  placementsByArea: Record<string, CanvasPlacementConfig>;
  onActiveAreaChange: (areaId: string) => void;
  onPlacementChange: (areaId: string, placement: CanvasPlacementConfig) => void;
};

type PrintBounds = {
  centerX: number;
  centerY: number;
  width: number;
  height: number;
};

const DEFAULT_PLACEMENT: CanvasPlacementConfig = {
  offsetX: 0,
  offsetY: 0,
  rotation: 0,
  scale: 1,
};

const MIN_SCALE = 0.1;
const MAX_SCALE = 3;
const CANVAS_WIDTH = 560;
const CANVAS_HEIGHT = 680;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function normalizePlacement(value?: Partial<CanvasPlacementConfig>): CanvasPlacementConfig {
  return {
    offsetX: round(clamp(value?.offsetX ?? DEFAULT_PLACEMENT.offsetX, -100, 100)),
    offsetY: round(clamp(value?.offsetY ?? DEFAULT_PLACEMENT.offsetY, -100, 100)),
    rotation: round(clamp(value?.rotation ?? DEFAULT_PLACEMENT.rotation, -180, 180)),
    scale: round(clamp(value?.scale ?? DEFAULT_PLACEMENT.scale, MIN_SCALE, MAX_SCALE)),
  };
}

function getPrintBounds(
  area: PrintAreaOption | null,
  canvasWidth: number,
  canvasHeight: number
): PrintBounds {
  const maxWidth = canvasWidth * 0.75;
  const maxHeight = canvasHeight * 0.68;
  const areaRatio = area && area.maxHeightCm > 0
    ? area.maxWidthCm / area.maxHeightCm
    : 1;

  let width = maxWidth;
  let height = width / areaRatio;

  if (!Number.isFinite(height) || height <= 0 || height > maxHeight) {
    height = maxHeight;
    width = height * areaRatio;
  }

  if (!Number.isFinite(width) || width <= 0) {
    width = maxWidth;
  }

  return {
    centerX: canvasWidth / 2,
    centerY: canvasHeight / 2,
    width,
    height,
  };
}

function getFitScale(design: FabricImage, bounds: PrintBounds): number {
  const sourceWidth = typeof design.width === 'number' && design.width > 0 ? design.width : 1;
  const sourceHeight = typeof design.height === 'number' && design.height > 0 ? design.height : 1;
  const fitScale = Math.min(
    (bounds.width * 0.72) / sourceWidth,
    (bounds.height * 0.72) / sourceHeight
  );

  if (!Number.isFinite(fitScale) || fitScale <= 0) {
    return 1;
  }

  return clamp(fitScale, MIN_SCALE, MAX_SCALE);
}

function placementFromObject(design: FabricImage, bounds: PrintBounds): CanvasPlacementConfig {
  const left = typeof design.left === 'number' ? design.left : bounds.centerX;
  const top = typeof design.top === 'number' ? design.top : bounds.centerY;
  const offsetX = ((left - bounds.centerX) / (bounds.width / 2)) * 100;
  const offsetY = ((top - bounds.centerY) / (bounds.height / 2)) * 100;

  return normalizePlacement({
    offsetX,
    offsetY,
    rotation: design.angle ?? 0,
    scale: design.scaleX ?? 1,
  });
}

function applyPlacementToObject(
  design: FabricImage,
  bounds: PrintBounds,
  placement: CanvasPlacementConfig
) {
  const safe = normalizePlacement(placement);
  const left = bounds.centerX + (safe.offsetX / 100) * (bounds.width / 2);
  const top = bounds.centerY + (safe.offsetY / 100) * (bounds.height / 2);

  design.set({
    left,
    top,
    angle: safe.rotation,
    scaleX: safe.scale,
    scaleY: safe.scale,
  });
  design.setCoords();
}

export default function CanvasEditor({
  productName,
  baseImage,
  designImage,
  selectedAreas,
  activeAreaId,
  placementsByArea,
  onActiveAreaChange,
  onPlacementChange,
}: CanvasEditorProps) {
  const canvasElementRef = useRef<HTMLCanvasElement | null>(null);
  const canvasRef = useRef<Canvas | null>(null);
  const baseImageRef = useRef<FabricImage | null>(null);
  const designImageRef = useRef<FabricImage | null>(null);
  const areaFrameRef = useRef<Rect | null>(null);
  const suppressSyncRef = useRef(false);

  const activeAreaIdRef = useRef<string | null>(activeAreaId);
  const selectedAreasRef = useRef<PrintAreaOption[]>(selectedAreas);
  const placementChangeRef = useRef(onPlacementChange);

  useEffect(() => {
    activeAreaIdRef.current = activeAreaId;
  }, [activeAreaId]);

  useEffect(() => {
    selectedAreasRef.current = selectedAreas;
  }, [selectedAreas]);

  useEffect(() => {
    placementChangeRef.current = onPlacementChange;
  }, [onPlacementChange]);

  const selectedAreaMap = useMemo(
    () => new Map(selectedAreas.map((area) => [area.id, area])),
    [selectedAreas]
  );

  const activeArea = activeAreaId ? selectedAreaMap.get(activeAreaId) ?? null : null;

  const currentPlacement = useMemo(
    () => normalizePlacement(activeAreaId ? placementsByArea[activeAreaId] : undefined),
    [activeAreaId, placementsByArea]
  );

  const syncPlacementFromCanvas = () => {
    if (suppressSyncRef.current) return;
    const canvas = canvasRef.current;
    const design = designImageRef.current;
    const areaId = activeAreaIdRef.current;
    const areas = selectedAreasRef.current;

    if (!canvas || !design || !areaId) return;

    const area = areas.find((item) => item.id === areaId) ?? null;
    const bounds = getPrintBounds(area, canvas.getWidth(), canvas.getHeight());
    const placement = placementFromObject(design, bounds);

    placementChangeRef.current(areaId, placement);
  };

  const updatePlacementForActiveArea = (next: Partial<CanvasPlacementConfig>) => {
    if (!activeAreaId) return;

    const canvas = canvasRef.current;
    const design = designImageRef.current;
    if (!canvas || !design) return;

    const area = selectedAreaMap.get(activeAreaId) ?? null;
    const bounds = getPrintBounds(area, canvas.getWidth(), canvas.getHeight());
    const merged = normalizePlacement({ ...currentPlacement, ...next });

    suppressSyncRef.current = true;
    applyPlacementToObject(design, bounds, merged);
    suppressSyncRef.current = false;

    canvas.requestRenderAll();
    onPlacementChange(activeAreaId, merged);
  };

  useEffect(() => {
    if (!canvasElementRef.current) return;

    const canvas = new Canvas(canvasElementRef.current, {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      backgroundColor: '#f8fafc',
      preserveObjectStacking: true,
      selection: false,
    });

    canvasRef.current = canvas;
    canvas.on('object:moving', syncPlacementFromCanvas);
    canvas.on('object:scaling', syncPlacementFromCanvas);
    canvas.on('object:rotating', syncPlacementFromCanvas);
    canvas.on('object:modified', syncPlacementFromCanvas);

    return () => {
      canvas.dispose();
      canvasRef.current = null;
      baseImageRef.current = null;
      designImageRef.current = null;
      areaFrameRef.current = null;
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (baseImageRef.current) {
      canvas.remove(baseImageRef.current);
      baseImageRef.current = null;
    }

    if (!baseImage) {
      canvas.requestRenderAll();
      return;
    }

    let cancelled = false;

    void FabricImage.fromURL(baseImage, { crossOrigin: 'anonymous' })
      .then((image) => {
        if (cancelled) return;

        const width = typeof image.width === 'number' && image.width > 0 ? image.width : 1;
        const height = typeof image.height === 'number' && image.height > 0 ? image.height : 1;
        const scale = Math.min(canvas.getWidth() / width, canvas.getHeight() / height);

        image.set({
          selectable: false,
          evented: false,
          originX: 'center',
          originY: 'center',
          left: canvas.getWidth() / 2,
          top: canvas.getHeight() / 2,
          scaleX: scale,
          scaleY: scale,
          opacity: 0.95,
          excludeFromExport: true,
        });

        canvas.add(image);
        baseImageRef.current = image;
        canvas.sendObjectToBack(image);

        if (areaFrameRef.current) canvas.bringObjectToFront(areaFrameRef.current);
        if (designImageRef.current) canvas.bringObjectToFront(designImageRef.current);

        canvas.requestRenderAll();
      })
      .catch(() => {
        canvas.requestRenderAll();
      });

    return () => {
      cancelled = true;
    };
  }, [baseImage]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (areaFrameRef.current) {
      canvas.remove(areaFrameRef.current);
      areaFrameRef.current = null;
    }

    const bounds = getPrintBounds(activeArea, canvas.getWidth(), canvas.getHeight());
    const frame = new Rect({
      left: bounds.centerX - bounds.width / 2,
      top: bounds.centerY - bounds.height / 2,
      width: bounds.width,
      height: bounds.height,
      fill: 'rgba(30, 41, 59, 0.08)',
      stroke: 'rgba(15, 23, 42, 0.45)',
      strokeDashArray: [8, 6],
      strokeWidth: 1,
      rx: 8,
      ry: 8,
      selectable: false,
      evented: false,
      excludeFromExport: true,
    });

    areaFrameRef.current = frame;
    canvas.add(frame);

    if (baseImageRef.current) canvas.sendObjectToBack(baseImageRef.current);
    canvas.bringObjectToFront(frame);
    if (designImageRef.current) canvas.bringObjectToFront(designImageRef.current);

    canvas.requestRenderAll();
  }, [activeArea]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (designImageRef.current) {
      canvas.remove(designImageRef.current);
      designImageRef.current = null;
    }

    if (!designImage) {
      canvas.requestRenderAll();
      return;
    }

    let cancelled = false;

    void FabricImage.fromURL(designImage, { crossOrigin: 'anonymous' })
      .then((image) => {
        if (cancelled) return;

        image.set({
          originX: 'center',
          originY: 'center',
          cornerColor: '#2563eb',
          borderColor: '#2563eb',
          cornerStyle: 'circle',
          transparentCorners: false,
          lockUniScaling: true,
          lockScalingFlip: true,
        });

        canvas.add(image);
        designImageRef.current = image;

        if (baseImageRef.current) canvas.sendObjectToBack(baseImageRef.current);
        if (areaFrameRef.current) canvas.bringObjectToFront(areaFrameRef.current);
        canvas.bringObjectToFront(image);

        canvas.setActiveObject(image);
        canvas.requestRenderAll();
      })
      .catch(() => {
        canvas.requestRenderAll();
      });

    return () => {
      cancelled = true;
    };
  }, [designImage]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const design = designImageRef.current;
    if (!canvas || !design || !activeAreaId) return;

    const area = selectedAreaMap.get(activeAreaId) ?? null;
    const bounds = getPrintBounds(area, canvas.getWidth(), canvas.getHeight());
    const hasPlacement = Object.prototype.hasOwnProperty.call(placementsByArea, activeAreaId);
    const nextPlacement = hasPlacement
      ? normalizePlacement(placementsByArea[activeAreaId])
      : normalizePlacement({
        ...DEFAULT_PLACEMENT,
        scale: getFitScale(design, bounds),
      });

    suppressSyncRef.current = true;
    applyPlacementToObject(design, bounds, nextPlacement);
    suppressSyncRef.current = false;

    if (!hasPlacement) {
      onPlacementChange(activeAreaId, nextPlacement);
    }

    canvas.requestRenderAll();
  }, [activeAreaId, placementsByArea, selectedAreaMap, onPlacementChange]);

  return (
    <div className="space-y-4 rounded-xl border border-border p-4">
      <div>
        <h3 className="font-semibold">Canvas Editor</h3>
        <p className="text-sm text-muted-foreground">
          Drag, scale, and rotate artwork per print area for {productName}.
        </p>
      </div>

      {selectedAreas.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {selectedAreas.map((area) => (
            <Button
              key={area.id}
              type="button"
              variant={activeAreaId === area.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => onActiveAreaChange(area.id)}
            >
              {area.label}
            </Button>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Select at least one print area to enable placement editing.
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-border bg-slate-100/50">
        <canvas ref={canvasElementRef} />
      </div>

      {!designImage ? (
        <p className="text-xs text-muted-foreground">
          Upload a design to activate transform controls on the canvas.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Scale</span>
            <span>{currentPlacement.scale.toFixed(2)}x</span>
          </div>
          <Slider
            min={MIN_SCALE}
            max={MAX_SCALE}
            step={0.01}
            value={[currentPlacement.scale]}
            disabled={!activeAreaId || !designImage}
            onValueChange={([value]) => updatePlacementForActiveArea({ scale: value })}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Rotation</span>
            <span>{Math.round(currentPlacement.rotation)}°</span>
          </div>
          <Slider
            min={-180}
            max={180}
            step={1}
            value={[currentPlacement.rotation]}
            disabled={!activeAreaId || !designImage}
            onValueChange={([value]) => updatePlacementForActiveArea({ rotation: value })}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>X Offset</span>
            <span>{Math.round(currentPlacement.offsetX)}%</span>
          </div>
          <Slider
            min={-100}
            max={100}
            step={1}
            value={[currentPlacement.offsetX]}
            disabled={!activeAreaId || !designImage}
            onValueChange={([value]) => updatePlacementForActiveArea({ offsetX: value })}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Y Offset</span>
            <span>{Math.round(currentPlacement.offsetY)}%</span>
          </div>
          <Slider
            min={-100}
            max={100}
            step={1}
            value={[currentPlacement.offsetY]}
            disabled={!activeAreaId || !designImage}
            onValueChange={([value]) => updatePlacementForActiveArea({ offsetY: value })}
          />
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full"
        disabled={!activeAreaId || !designImage}
        onClick={() => {
          const area = activeAreaId ? selectedAreaMap.get(activeAreaId) ?? null : null;
          const canvas = canvasRef.current;
          const design = designImageRef.current;

          if (!activeAreaId || !canvas || !design) return;

          const bounds = getPrintBounds(area, canvas.getWidth(), canvas.getHeight());
          const resetPlacement = normalizePlacement({
            ...DEFAULT_PLACEMENT,
            scale: getFitScale(design, bounds),
          });

          updatePlacementForActiveArea(resetPlacement);
        }}
      >
        <RefreshCcw className="mr-2 h-4 w-4" />
        Reset Active Area Placement
      </Button>
    </div>
  );
}
