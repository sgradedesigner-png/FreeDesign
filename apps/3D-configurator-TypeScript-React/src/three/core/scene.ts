// src/three/core/scene.ts
import * as THREE from 'three';

/** Light profile configuration */
export interface LightProfile {
  ambient?: { intensity?: number; color?: number };
  hemi?: { intensity?: number; skyColor?: number; groundColor?: number };
  key?: { intensity?: number; color?: number; position?: [number, number, number] };
  fill?: { intensity?: number; color?: number; position?: [number, number, number] };
  rim?: { intensity?: number; color?: number; position?: [number, number, number] };
}

/** Scene initialization options */
export interface SceneOptions {
  fov?: number;
  near?: number;
  far?: number;
  aspect?: number;
  cameraZ?: number;
  background?: number | 'transparent' | null;
  lightProfile?: 'studio' | 'neutral' | 'dramatic' | LightProfile;
  showGrid?: boolean;
}

/** Scene groups structure */
export interface SceneGroups {
  root: THREE.Group;
  product: THREE.Group;
  decals: THREE.Group;
  zones: THREE.Group;
  helpers: THREE.Group;
}

/** Scene context returned from factory */
export interface SceneContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  groups: SceneGroups;
  lightRig: THREE.Group;
  grid: THREE.GridHelper;
}

const DEFAULTS: Required<Omit<SceneOptions, 'lightProfile'>> & { lightProfile: 'studio' } = {
  fov: 35,
  near: 0.1,
  far: 100,
  aspect: 16 / 9,
  cameraZ: 2.2,
  background: 0xf4f5f7,
  lightProfile: 'studio',
  showGrid: false,
};

export const LIGHT_PROFILES: Record<string, LightProfile> = {
  studio: {
    ambient: { intensity: 0.25, color: 0xffffff },
    hemi: { intensity: 0.55, skyColor: 0xffffff, groundColor: 0x444444 },
    key: { intensity: 2.2, color: 0xfff1e0, position: [2.5, 3.5, 2.5] },
    fill: { intensity: 0.9, color: 0xcfe7ff, position: [-2.5, 1.5, 2.0] },
    rim: { intensity: 1.2, color: 0xffffff, position: [-1.0, 2.5, -2.5] },
  },
  neutral: {
    ambient: { intensity: 0.2, color: 0xffffff },
    hemi: { intensity: 0.4, skyColor: 0xe0e0e0, groundColor: 0x909090 },
    key: { intensity: 1.2, color: 0xffffff, position: [2.0, 2.0, 2.0] },
    fill: { intensity: 0.6, color: 0xffffff, position: [-2.0, 1.0, 2.0] },
    rim: { intensity: 0.8, color: 0xffffff, position: [-1.0, 2.0, -2.0] },
  },
  dramatic: {
    ambient: { intensity: 0.12, color: 0xffffff },
    hemi: { intensity: 0.25, skyColor: 0xffffff, groundColor: 0x222233 },
    key: { intensity: 3.0, color: 0xffe7c7, position: [3.5, 3.5, 1.5] },
    fill: { intensity: 0.35, color: 0x88aaff, position: [-2.5, 1.0, 2.5] },
    rim: { intensity: 1.8, color: 0xffffff, position: [-1.5, 3.0, -2.5] },
  },
};

function createGroups(): SceneGroups {
  const root = new THREE.Group();
  root.name = 'ROOT';
  const product = new THREE.Group();
  product.name = 'ProductRoot';
  const decals = new THREE.Group();
  decals.name = 'DecalsRoot';
  const zones = new THREE.Group();
  zones.name = 'ZonesRoot';
  const helpers = new THREE.Group();
  helpers.name = 'HelpersRoot';
  root.add(product, decals, zones, helpers);
  return { root, product, decals, zones, helpers };
}

function createLightRig(profile: LightProfile): THREE.Group {
  const p = profile;
  const rig = new THREE.Group();
  rig.name = 'LightRig';

  const ambient = new THREE.AmbientLight(
    p.ambient?.color ?? 0xffffff,
    p.ambient?.intensity ?? 0.2
  );
  ambient.name = 'Ambient';

  const hemi = new THREE.HemisphereLight(
    p.hemi?.skyColor ?? 0xffffff,
    p.hemi?.groundColor ?? 0x444444,
    p.hemi?.intensity ?? 0.4
  );
  hemi.name = 'Hemi';
  hemi.position.set(0, 1, 0);

  const key = new THREE.DirectionalLight(
    p.key?.color ?? 0xffffff,
    p.key?.intensity ?? 1.5
  );
  key.name = 'Key';
  key.position.fromArray(p.key?.position ?? [2, 3, 2]);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.radius = 2;

  const fill = new THREE.DirectionalLight(
    p.fill?.color ?? 0xffffff,
    p.fill?.intensity ?? 0.7
  );
  fill.name = 'Fill';
  fill.position.fromArray(p.fill?.position ?? [-2, 1, 2]);

  const rim = new THREE.DirectionalLight(
    p.rim?.color ?? 0xffffff,
    p.rim?.intensity ?? 1.0
  );
  rim.name = 'Rim';
  rim.position.fromArray(p.rim?.position ?? [-1, 2, -2]);

  rig.add(ambient, hemi, key, fill, rim);
  return rig;
}

/**
 * Create a new Three.js scene with camera, lights, and groups
 * Factory function - no singletons
 */
export function createScene(opts: SceneOptions = {}): SceneContext {
  const cfg = { ...DEFAULTS, ...opts };

  const scene = new THREE.Scene();

  // Background
  if (cfg.background === 'transparent' || cfg.background === null) {
    scene.background = null;
  } else if (typeof cfg.background === 'number') {
    scene.background = new THREE.Color(cfg.background);
  } else {
    scene.background = new THREE.Color(DEFAULTS.background as number);
  }

  // Groups
  const groups = createGroups();
  scene.add(groups.root);

  // Grid helper
  const grid = new THREE.GridHelper(10, 20, 0x888888, 0xcccccc);
  grid.name = 'GridHelper';
  grid.visible = !!cfg.showGrid;
  groups.helpers.add(grid);

  // Camera
  const camera = new THREE.PerspectiveCamera(
    cfg.fov,
    cfg.aspect,
    cfg.near,
    cfg.far
  );
  camera.position.set(0, 1.15, cfg.cameraZ);
  camera.lookAt(0, 1, 0);
  camera.name = 'MainCamera';

  // Lights
  const profile =
    typeof cfg.lightProfile === 'string'
      ? LIGHT_PROFILES[cfg.lightProfile] ?? LIGHT_PROFILES.studio
      : cfg.lightProfile ?? LIGHT_PROFILES.studio;
  const lightRig = createLightRig(profile);
  scene.add(lightRig);

  // Color space
  THREE.ColorManagement.enabled = true;

  return { scene, camera, groups, lightRig, grid };
}

/** Update camera aspect ratio on resize */
export function updateCameraAspect(
  camera: THREE.PerspectiveCamera,
  width: number,
  height: number
): void {
  const aspect = Math.max(1e-6, width / Math.max(1, height));
  camera.aspect = aspect;
  camera.updateProjectionMatrix();
}

/** Set scene background */
export function setSceneBackground(
  scene: THREE.Scene,
  background: number | 'transparent' | null
): void {
  if (background === 'transparent' || background === null) {
    scene.background = null;
  } else if (typeof background === 'number') {
    scene.background = new THREE.Color(background);
  }
}

/** Update light profile */
export function updateLightProfile(
  scene: THREE.Scene,
  currentRig: THREE.Group,
  profile: 'studio' | 'neutral' | 'dramatic' | LightProfile
): THREE.Group {
  scene.remove(currentRig);
  const resolved =
    typeof profile === 'string'
      ? LIGHT_PROFILES[profile] ?? LIGHT_PROFILES.studio
      : profile;
  const newRig = createLightRig(resolved);
  scene.add(newRig);
  return newRig;
}

/** Dispose all scene resources */
export function disposeScene(scene: THREE.Scene): void {
  scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) {
      mesh.geometry.dispose();
    }
    if (mesh.material) {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        const matRecord = m as unknown as Record<string, unknown>;
        for (const key in matRecord) {
          const value = matRecord[key];
          if (value && typeof value === 'object' && (value as THREE.Texture).isTexture) {
            (value as THREE.Texture).dispose();
          }
        }
        m.dispose();
      }
    }
  });

  if (scene.environment) {
    scene.environment.dispose();
  }
}

/** Attach object to a scene group */
export function attachToGroup(
  groups: SceneGroups,
  object: THREE.Object3D,
  slot: 'product' | 'decals' | 'zones' | 'helpers' | 'root' = 'product'
): void {
  switch (slot) {
    case 'product':
      groups.product.add(object);
      break;
    case 'decals':
      groups.decals.add(object);
      break;
    case 'zones':
      groups.zones.add(object);
      break;
    case 'helpers':
      groups.helpers.add(object);
      break;
    default:
      groups.root.add(object);
      break;
  }
}
