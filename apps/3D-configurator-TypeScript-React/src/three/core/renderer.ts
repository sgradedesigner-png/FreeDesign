// src/three/core/renderer.ts
import * as THREE from 'three';

/** Renderer options */
export interface RendererOptions {
  alpha?: boolean;
  antialias?: boolean;
  toneMapping?: THREE.ToneMapping;
  toneMappingExposure?: number;
  maxPixelRatio?: number;
}

/** Renderer creation result */
export interface RendererResult {
  renderer: THREE.WebGLRenderer;
  canvas: HTMLCanvasElement;
}

const DEFAULTS: Required<RendererOptions> = {
  alpha: false,
  antialias: true,
  toneMapping: THREE.ACESFilmicToneMapping,
  toneMappingExposure: 1.0,
  maxPixelRatio: 2,
};

/**
 * Create a WebGL renderer and attach to container
 */
export function createRenderer(
  container: HTMLElement,
  opts: RendererOptions = {}
): RendererResult {
  const cfg = { ...DEFAULTS, ...opts };

  const renderer = new THREE.WebGLRenderer({
    antialias: cfg.antialias,
    alpha: cfg.alpha,
  });

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = cfg.toneMapping;
  renderer.toneMappingExposure = cfg.toneMappingExposure;
  renderer.setPixelRatio(Math.min(cfg.maxPixelRatio, window.devicePixelRatio || 1));

  // Style canvas for proper positioning
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';

  container.appendChild(renderer.domElement);
  resizeRenderer(renderer, container);

  return { renderer, canvas: renderer.domElement };
}

/** Resize result */
export interface ResizeResult {
  width: number;
  height: number;
}

/**
 * Resize renderer to match container bounds
 */
export function resizeRenderer(
  renderer: THREE.WebGLRenderer,
  container: HTMLElement,
  maxPixelRatio = 2
): ResizeResult {
  const rect = container.getBoundingClientRect();

  // Skip if container has no size
  if (rect.width < 10 || rect.height < 10) {
    return { width: 0, height: 0 };
  }

  const dpr = Math.min(maxPixelRatio, window.devicePixelRatio || 1);
  renderer.setPixelRatio(dpr);

  const width = Math.floor(rect.width);
  const height = Math.floor(rect.height);

  // setSize with updateStyle=true to ensure canvas CSS is updated
  renderer.setSize(width, height, true);
  return { width, height };
}

/**
 * Dispose renderer resources
 */
export function disposeRenderer(renderer: THREE.WebGLRenderer): void {
  renderer.dispose();
  renderer.domElement.remove();
}
