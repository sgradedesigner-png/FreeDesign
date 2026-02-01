// src/components/viewer3d/useThreeScene.ts
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  createScene,
  createRenderer,
  createControls,
  resizeRenderer,
  updateCameraAspect,
  disposeScene,
  disposeRenderer,
  type SceneContext,
  type ControlsResult,
} from '@/three/core';
import { useConfiguratorStore } from '@/stores';

interface UseThreeSceneOptions {
  onReady?: (context: SceneContext) => void;
}

export function useThreeScene(
  containerRef: React.RefObject<HTMLDivElement>,
  options: UseThreeSceneOptions = {}
) {
  const [sceneContext, setSceneContext] = useState<SceneContext | null>(null);
  const controlsRef = useRef<ControlsResult | null>(null);
  const animationIdRef = useRef<number>(0);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const initializedRef = useRef(false);
  const onReadyRef = useRef(options.onReady);

  // Update ref when options change
  onReadyRef.current = options.onReady;

  useEffect(() => {
    const container = containerRef.current;
    if (!container || initializedRef.current) return;

    // Debug container size
    const rect = container.getBoundingClientRect();
    console.log('[useThreeScene] Container size:', rect.width, 'x', rect.height);

    if (rect.width < 10 || rect.height < 10) {
      console.warn('[useThreeScene] Container too small, will retry...');
      // Retry after a short delay
      const timeoutId = setTimeout(() => {
        initializedRef.current = false;
      }, 100);
      return () => clearTimeout(timeoutId);
    }

    initializedRef.current = true;

    // Create scene, camera, lights
    const ctx = createScene({
      background: 0xf4f5f7,
      lightProfile: 'studio',
      cameraZ: 2.2,
    });

    // Create renderer
    const { renderer } = createRenderer(container, { antialias: true });
    rendererRef.current = renderer;
    console.log('[useThreeScene] Renderer created, canvas:', renderer.domElement.width, 'x', renderer.domElement.height);

    // Create controls
    const controlsResult = createControls(ctx.camera, renderer.domElement, {
      enableDamping: true,
      dampingFactor: 0.08,
      rotateSpeed: 0.6,
      enablePan: false,
      enableZoom: false,
      target: { x: 0, y: 1, z: 0 },
      minDistance: 1,
      maxDistance: 5,
    });
    controlsRef.current = controlsResult;

    // Store in Zustand - use getState to avoid re-render dependency
    const store = useConfiguratorStore.getState();
    store.setScene(ctx.scene);
    store.setCamera(ctx.camera);
    store.setRenderer(renderer);
    store.setControls(controlsResult.controls);

    setSceneContext(ctx);

    // Resize handler
    const handleResize = () => {
      if (!container || !renderer || !ctx.camera) return;
      const { width, height } = resizeRenderer(renderer, container);
      if (width > 0 && height > 0) {
        updateCameraAspect(ctx.camera, width, height);
      }
    };

    // Initial resize
    handleResize();

    // Animation loop
    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate);
      controlsResult.update();
      renderer.render(ctx.scene, ctx.camera);
    };
    animate();

    // Resize listener
    window.addEventListener('resize', handleResize);

    // Callback
    onReadyRef.current?.(ctx);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationIdRef.current);
      controlsResult.dispose();
      disposeScene(ctx.scene);
      disposeRenderer(renderer);
      initializedRef.current = false;
    };
  }, [containerRef]);

  return {
    sceneContext,
    controls: controlsRef.current,
    renderer: rendererRef.current,
  };
}
