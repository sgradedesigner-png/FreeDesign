// src/three/decal/decalMaterial.ts
import * as THREE from 'three';

/** Decal material options */
export interface DecalMaterialOptions {
  transparent?: boolean;
  depthTest?: boolean;
  depthWrite?: boolean;
  polygonOffsetFactor?: number;
  color?: number;
}

/** Decal material result */
export interface DecalMaterialResult {
  material: THREE.MeshStandardMaterial;
  setTexture: (
    img: HTMLImageElement,
    renderer?: THREE.WebGLRenderer,
    opts?: { flipU?: boolean }
  ) => void;
  hasTexture: () => boolean;
  dispose: () => void;
}

const DEFAULTS: Required<DecalMaterialOptions> = {
  transparent: true,
  depthTest: true,
  depthWrite: false,
  polygonOffsetFactor: -4,
  color: 0xffffff,
};

/**
 * Create a decal material for artwork display
 */
export function createDecalMaterial(
  renderer?: THREE.WebGLRenderer,
  opts: DecalMaterialOptions = {}
): DecalMaterialResult {
  const cfg = { ...DEFAULTS, ...opts };

  const material = new THREE.MeshStandardMaterial({
    transparent: cfg.transparent,
    depthTest: cfg.depthTest,
    depthWrite: cfg.depthWrite,
    polygonOffset: true,
    polygonOffsetFactor: cfg.polygonOffsetFactor,
    color: cfg.color,
  });

  if (renderer) {
    material.needsUpdate = true;
  }

  let artworkTexture: THREE.Texture | null = null;

  const setTexture = (
    img: HTMLImageElement,
    rend?: THREE.WebGLRenderer,
    textureOpts: { flipU?: boolean } = {}
  ): void => {
    const { flipU = false } = textureOpts;

    // Dispose previous texture
    if (artworkTexture) {
      artworkTexture.dispose();
      artworkTexture = null;
    }

    const tex = new THREE.Texture(img);
    tex.colorSpace = THREE.SRGBColorSpace;

    // Use RepeatWrapping for flipping
    tex.wrapS = flipU ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;

    tex.generateMipmaps = false;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = rend ? rend.capabilities.getMaxAnisotropy() : 1;

    if (flipU) {
      tex.repeat.set(-1, 1);
      tex.offset.set(1, 0);
    } else {
      tex.repeat.set(1, 1);
      tex.offset.set(0, 0);
    }

    tex.needsUpdate = true;

    material.map = tex;
    material.needsUpdate = true;
    artworkTexture = tex;
  };

  const hasTexture = (): boolean => !!artworkTexture;

  const dispose = (): void => {
    if (artworkTexture) {
      artworkTexture.dispose();
      artworkTexture = null;
    }
    material.dispose();
  };

  return { material, setTexture, hasTexture, dispose };
}
