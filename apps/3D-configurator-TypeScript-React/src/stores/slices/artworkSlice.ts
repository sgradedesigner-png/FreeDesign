// src/stores/slices/artworkSlice.ts
import type { StateCreator } from 'zustand';
import type { ZoneKey, ZoneRect } from '../../types/zone';
import type { Placement, ZoneDraft } from '../../types/placement';
import type { ConfiguratorStore } from '../types';
import { MIN_SCALE, MAX_SCALE, DEFAULT_SCALE } from '../../config/constants';

export interface ArtworkSlice {
  // State
  zoneDrafts: Map<ZoneKey, ZoneDraft>;
  currentImage: HTMLImageElement | null;
  currentPlacement: Placement | null;

  // Actions
  setImage: (image: HTMLImageElement | null) => void;
  setPlacement: (placement: Partial<Placement>) => void;
  clearArtwork: () => void;
  placeAtUV: (hitUV: { x: number; y: number }, printZone: ZoneRect) => void;
  scaleBy: (factor: number) => void;
  rotateByDeg: (degrees: number) => void;
  centerAndFit: (printZone: ZoneRect) => void;
  saveDraft: (zoneKey: ZoneKey) => void;
  loadDraft: (zoneKey: ZoneKey) => void;
  lockDraft: (zoneKey: ZoneKey) => void;
  unlockDraft: (zoneKey: ZoneKey) => void;
  hasDraft: (zoneKey: ZoneKey) => boolean;
  getDraft: (zoneKey: ZoneKey) => ZoneDraft | undefined;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export const createArtworkSlice: StateCreator<
  ConfiguratorStore,
  [['zustand/immer', never]],
  [],
  ArtworkSlice
> = (set, get) => ({
  zoneDrafts: new Map(),
  currentImage: null,
  currentPlacement: null,

  // External DOM objects - bypass immer
  setImage: (image) => set({ currentImage: image }),

  setPlacement: (placement) =>
    set((state) => {
      if (state.currentPlacement) {
        return {
          currentPlacement: { ...state.currentPlacement, ...placement },
        };
      } else {
        return {
          currentPlacement: {
            u: 0.5,
            v: 0.5,
            uScale: DEFAULT_SCALE,
            vScale: DEFAULT_SCALE,
            rotationRad: 0,
            ...placement,
          },
        };
      }
    }),

  clearArtwork: () => set({ currentImage: null, currentPlacement: null }),

  placeAtUV: (hitUV, printZone) =>
    set((state) => {
      const u =
        (hitUV.x - printZone.uMin) /
        Math.max(1e-6, printZone.uMax - printZone.uMin);
      const v =
        (hitUV.y - printZone.vMin) /
        Math.max(1e-6, printZone.vMax - printZone.vMin);

      // Get initial rotation from zone's correction angle
      const initialRotation = printZone.correctionRad ? -printZone.correctionRad : 0;

      if (!state.currentPlacement) {
        return {
          currentPlacement: {
            u,
            v,
            uScale: DEFAULT_SCALE,
            vScale: DEFAULT_SCALE,
            rotationRad: initialRotation,
          },
        };
      } else {
        return {
          currentPlacement: { ...state.currentPlacement, u, v },
        };
      }
    }),

  scaleBy: (factor) =>
    set((state) => {
      if (!state.currentPlacement) return state;
      return {
        currentPlacement: {
          ...state.currentPlacement,
          uScale: clamp(state.currentPlacement.uScale * factor, MIN_SCALE, MAX_SCALE),
          vScale: clamp(state.currentPlacement.vScale * factor, MIN_SCALE, MAX_SCALE),
        },
      };
    }),

  rotateByDeg: (degrees) =>
    set((state) => {
      if (!state.currentPlacement) return state;
      const rad = (degrees * Math.PI) / 180;
      return {
        currentPlacement: {
          ...state.currentPlacement,
          rotationRad: (state.currentPlacement.rotationRad || 0) + rad,
        },
      };
    }),

  centerAndFit: (_printZone) =>
    set((state) => {
      if (!state.currentImage) return state;

      const img = state.currentImage;
      const imgAspect = img.width / Math.max(1, img.height);

      // Get current zone's physical dimensions from printZoneCM
      const printZoneCM = state.printZoneCM;
      const printZone = state.printZone;
      const activeZoneKey = state.activeZoneKey;

      // Front zone reference size (32x40 cm)
      const FRONT_WIDTH_CM = 32;

      // Calculate zone scale factor relative to front zone
      // This ensures arm zones get smaller initial scale than front/back
      let zoneScaleFactor = 1.0;
      if (printZoneCM) {
        zoneScaleFactor = printZoneCM.width / FRONT_WIDTH_CM;
      }

      // Base scale (80% of zone) adjusted by zone scale factor
      const baseScale = 0.8 * zoneScaleFactor;

      // For uniform scaling (preserve image aspect ratio):
      // - Use same base for both dimensions
      // - Adjust one dimension based on image aspect ratio
      let uScale: number;
      let vScale: number;

      if (imgAspect >= 1) {
        // Landscape or square image: width is larger or equal
        uScale = baseScale;
        vScale = baseScale / imgAspect;
      } else {
        // Portrait image: height is larger
        vScale = baseScale;
        uScale = baseScale * imgAspect;
      }

      // Get initial rotation from zone's correction angle
      // This makes the artwork appear upright on arm zones
      let initialRotation = 0;
      if (printZone?.correctionRad) {
        // Apply inverse of correction to make artwork appear upright
        initialRotation = -printZone.correctionRad;
      }

      console.log('[centerAndFit] Zone scale factor:', zoneScaleFactor, 'baseScale:', baseScale);
      console.log('[centerAndFit] Image aspect:', imgAspect, 'Result scale:', uScale, vScale);
      console.log('[centerAndFit] Zone:', activeZoneKey, 'Initial rotation:', initialRotation);

      return {
        currentPlacement: {
          u: 0.5,
          v: 0.5,
          uScale: clamp(uScale, MIN_SCALE, MAX_SCALE),
          vScale: clamp(vScale, MIN_SCALE, MAX_SCALE),
          rotationRad: initialRotation,
        },
      };
    }),

  saveDraft: (zoneKey) => {
    const state = get();
    const newMap = new Map(state.zoneDrafts);
    const draft: ZoneDraft = {
      image: state.currentImage,
      placement: state.currentPlacement ? { ...state.currentPlacement } : null,
      locked: state.zoneDrafts.get(zoneKey)?.locked ?? false,
    };
    newMap.set(zoneKey, draft);
    set({ zoneDrafts: newMap });
  },

  loadDraft: (zoneKey) => {
    const state = get();
    const draft = state.zoneDrafts.get(zoneKey);
    if (draft) {
      set({
        currentImage: draft.image,
        currentPlacement: draft.placement ? { ...draft.placement } : null,
      });
    } else {
      set({ currentImage: null, currentPlacement: null });
    }
  },

  lockDraft: (zoneKey) => {
    const state = get();
    const draft = state.zoneDrafts.get(zoneKey);
    if (!draft) return;
    const newMap = new Map(state.zoneDrafts);
    newMap.set(zoneKey, { ...draft, locked: true });
    set({ zoneDrafts: newMap });
  },

  unlockDraft: (zoneKey) => {
    const state = get();
    const draft = state.zoneDrafts.get(zoneKey);
    if (!draft) return;
    const newMap = new Map(state.zoneDrafts);
    newMap.set(zoneKey, { ...draft, locked: false });
    set({ zoneDrafts: newMap });
  },

  hasDraft: (zoneKey) => {
    const draft = get().zoneDrafts.get(zoneKey);
    return !!(draft?.image && draft?.placement);
  },

  getDraft: (zoneKey) => get().zoneDrafts.get(zoneKey),
});
