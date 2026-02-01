// src/components/editor2d/ZoomControls.tsx
import { Plus, Minus, RotateCw, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useConfiguratorStore } from '@/stores';
import { useI18n } from '@/hooks';
import { clamp } from '@/utils/canvas';

interface ZoomControlsProps {
  className?: string;
}

export function ZoomControls({ className = '' }: ZoomControlsProps) {
  const { t } = useI18n();
  const currentPlacement = useConfiguratorStore((s) => s.currentPlacement);

  const handleZoomIn = () => {
    const placement = useConfiguratorStore.getState().currentPlacement;
    if (!placement) return;
    useConfiguratorStore.getState().setPlacement({
      ...placement,
      uScale: clamp(placement.uScale * 1.1, 0.05, 1.2),
      vScale: clamp(placement.vScale * 1.1, 0.05, 1.2),
    });
  };

  const handleZoomOut = () => {
    const placement = useConfiguratorStore.getState().currentPlacement;
    if (!placement) return;
    useConfiguratorStore.getState().setPlacement({
      ...placement,
      uScale: clamp(placement.uScale * 0.9, 0.05, 1.2),
      vScale: clamp(placement.vScale * 0.9, 0.05, 1.2),
    });
  };

  const handleRotateLeft = () => {
    const placement = useConfiguratorStore.getState().currentPlacement;
    if (!placement) return;
    useConfiguratorStore.getState().setPlacement({
      ...placement,
      rotationRad: (placement.rotationRad || 0) - Math.PI / 12,
    });
  };

  const handleRotateRight = () => {
    const placement = useConfiguratorStore.getState().currentPlacement;
    if (!placement) return;
    useConfiguratorStore.getState().setPlacement({
      ...placement,
      rotationRad: (placement.rotationRad || 0) + Math.PI / 12,
    });
  };

  const isDisabled = !currentPlacement;

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <Button
        variant="outline"
        size="icon"
        onClick={handleZoomOut}
        disabled={isDisabled}
        className="h-8 w-8"
        title={t('controls.zoomOut')}
      >
        <Minus className="h-4 w-4" />
      </Button>

      <Button
        variant="outline"
        size="icon"
        onClick={handleZoomIn}
        disabled={isDisabled}
        className="h-8 w-8"
        title={t('controls.zoomIn')}
      >
        <Plus className="h-4 w-4" />
      </Button>

      <div className="w-px h-6 bg-border mx-1" />

      <Button
        variant="outline"
        size="icon"
        onClick={handleRotateLeft}
        disabled={isDisabled}
        className="h-8 w-8"
        title={t('controls.rotateLeft')}
      >
        <RotateCcw className="h-4 w-4" />
      </Button>

      <Button
        variant="outline"
        size="icon"
        onClick={handleRotateRight}
        disabled={isDisabled}
        className="h-8 w-8"
        title={t('controls.rotateRight')}
      >
        <RotateCw className="h-4 w-4" />
      </Button>
    </div>
  );
}
