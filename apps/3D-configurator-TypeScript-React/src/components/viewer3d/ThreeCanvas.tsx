// src/components/viewer3d/ThreeCanvas.tsx
import { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { useThreeScene } from './useThreeScene';
import { useGLTFLoader } from './useGLTFLoader';
import { useRaycast } from './useRaycast';
import { useMultiDecalSystem } from './useMultiDecalSystem';
import { useConfiguratorStore } from '@/stores';
import { useI18n, useCameraMovement } from '@/hooks';

interface ThreeCanvasProps {
  modelUrl?: string;
  className?: string;
}

export function ThreeCanvas({
  modelUrl = '/assets/models/Tshirt/TShirt.glb',
  className = '',
}: ThreeCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasEl, setCanvasEl] = useState<HTMLCanvasElement | null>(null);
  const { t } = useI18n();

  // Get zone mesh from store
  const activeZoneKey = useConfiguratorStore((s) => s.activeZoneKey);
  const zoneMeshes = useConfiguratorStore((s) => s.zoneMeshes);
  const modelLoaded = useConfiguratorStore((s) => s.modelLoaded);
  const currentImage = useConfiguratorStore((s) => s.currentImage);

  const activeZoneMesh = activeZoneKey === 'all' ? null : (zoneMeshes.get(activeZoneKey) ?? null);

  // Camera movement hook
  const { setModelBounds, fitCameraToModel, moveCameraToZone } = useCameraMovement();

  // Handle model load complete
  const handleModelLoad = useCallback(
    (modelScene: THREE.Group) => {
      setModelBounds(modelScene);
      fitCameraToModel(1.35);
      moveCameraToZone('front');
    },
    [setModelBounds, fitCameraToModel, moveCameraToZone]
  );

  // Initialize Three.js scene
  const { sceneContext } = useThreeScene(containerRef as React.RefObject<HTMLDivElement>, {
    onReady: () => {
      // Store canvas reference
      const canvas = containerRef.current?.querySelector('canvas');
      if (canvas) setCanvasEl(canvas);
    },
  });

  // Load GLTF model
  const { loading, error } = useGLTFLoader(modelUrl, {
    groups: sceneContext?.groups,
    onProgress: (progress) => {
      console.log(`Loading: ${Math.round(progress * 100)}%`);
    },
    onError: (err) => {
      console.error('Model load error:', err);
    },
    onLoad: handleModelLoad,
  });

  // Setup raycast for clicking on model
  const { handleClick } = useRaycast({
    targetObject: activeZoneMesh,
    canvas: canvasEl,
    enabled: modelLoaded && !!currentImage,
  });

  // Setup multi-decal system (renders decals for ALL zones with drafts)
  useMultiDecalSystem();

  // Update canvas reference when renderer is ready
  useEffect(() => {
    const canvas = containerRef.current?.querySelector('canvas');
    if (canvas && canvas !== canvasEl) {
      setCanvasEl(canvas as HTMLCanvasElement);
    }
  }, [sceneContext, canvasEl]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full ${className}`}
      onClick={handleClick}
      style={{ touchAction: 'none' }}
    >
      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">{t('viewer.loading')}</p>
          </div>
        </div>
      )}

      {/* Error overlay */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
          <div className="text-center p-4">
            <p className="text-destructive font-medium">Failed to load model</p>
            <p className="text-sm text-muted-foreground mt-1">{error.message}</p>
          </div>
        </div>
      )}

      {/* Click hint */}
      {modelLoaded && currentImage && !loading && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-card/90 backdrop-blur rounded-full text-xs text-muted-foreground">
          {t('viewer.clickToPlace')}
        </div>
      )}
    </div>
  );
}
