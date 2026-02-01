// src/three/core/controls.ts
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/** Control mode */
export type ControlMode = 'EDIT' | 'LOCKED';

/** Controls options */
export interface ControlsOptions {
  enableDamping?: boolean;
  dampingFactor?: number;
  rotateSpeed?: number;
  panSpeed?: number;
  enablePan?: boolean;
  enableZoom?: boolean;
  minDistance?: number;
  maxDistance?: number;
  target?: { x: number; y: number; z: number };
}

/** Controls result with mode management */
export interface ControlsResult {
  controls: OrbitControls;
  setMode: (mode: ControlMode) => void;
  getMode: () => ControlMode;
  setEnabled: (enabled: boolean) => void;
  update: () => void;
  dispose: () => void;
}

const DEFAULTS: Required<Omit<ControlsOptions, 'target' | 'minDistance' | 'maxDistance'>> = {
  enableDamping: true,
  dampingFactor: 0.08,
  rotateSpeed: 0.6,
  panSpeed: 0.8,
  enablePan: false,
  enableZoom: false,
};

/**
 * Create OrbitControls with mode management
 * EDIT mode: zoom disabled (wheel reserved for artwork scale)
 * LOCKED mode: zoom enabled (user can inspect)
 */
export function createControls(
  camera: THREE.Camera,
  canvas: HTMLCanvasElement,
  opts: ControlsOptions = {}
): ControlsResult {
  if (!camera) throw new Error('[controls] camera is required');
  if (!canvas) throw new Error('[controls] canvas is required');

  const cfg = { ...DEFAULTS, ...opts };

  const controls = new OrbitControls(camera, canvas);

  controls.enableDamping = cfg.enableDamping;
  controls.dampingFactor = cfg.dampingFactor;
  controls.rotateSpeed = cfg.rotateSpeed;
  controls.panSpeed = cfg.panSpeed;
  controls.enablePan = cfg.enablePan;
  controls.enableZoom = cfg.enableZoom;

  if (typeof opts.minDistance === 'number') {
    controls.minDistance = opts.minDistance;
  }
  if (typeof opts.maxDistance === 'number') {
    controls.maxDistance = opts.maxDistance;
  }

  if (opts.target) {
    controls.target.set(opts.target.x, opts.target.y, opts.target.z);
  }

  controls.update();

  let mode: ControlMode = 'EDIT';

  const setMode = (newMode: ControlMode): void => {
    mode = newMode === 'LOCKED' ? 'LOCKED' : 'EDIT';
    controls.enabled = true;
    controls.enableZoom = mode === 'LOCKED';
  };

  const getMode = (): ControlMode => mode;

  const setEnabled = (enabled: boolean): void => {
    controls.enabled = enabled;
  };

  const update = (): void => {
    controls.update();
  };

  const dispose = (): void => {
    controls.dispose();
  };

  return { controls, setMode, getMode, setEnabled, update, dispose };
}
