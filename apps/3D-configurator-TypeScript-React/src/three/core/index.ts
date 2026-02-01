// src/three/core/index.ts
export {
  createScene,
  updateCameraAspect,
  setSceneBackground,
  updateLightProfile,
  disposeScene,
  attachToGroup,
  LIGHT_PROFILES,
  type SceneOptions,
  type SceneContext,
  type SceneGroups,
  type LightProfile,
} from './scene';

export {
  createRenderer,
  resizeRenderer,
  disposeRenderer,
  type RendererOptions,
  type RendererResult,
  type ResizeResult,
} from './renderer';

export {
  createControls,
  type ControlMode,
  type ControlsOptions,
  type ControlsResult,
} from './controls';

export {
  hitTest,
  eventToNDC,
  raycastFromUV,
  createRaycaster,
  type RaycastHit,
} from './raycast';
