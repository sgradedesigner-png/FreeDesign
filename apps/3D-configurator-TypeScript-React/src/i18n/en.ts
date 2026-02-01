// src/i18n/en.ts

export interface TranslationKeys {
  app: {
    title: string;
  };
  header: {
    darkMode: string;
    lightMode: string;
  };
  zones: {
    front: string;
    back: string;
    left_arm: string;
    right_arm: string;
    all: string;
  };
  tools: {
    upload: string;
    selectZoneToUpload: string;
    color: string;
    width: string;
    snap: string;
    centerSnap: string;
    gridSnap: string;
    gridSize: string;
    safeZone: string;
  };
  actions: {
    submit: string;
    lock: string;
    unlock: string;
    export: string;
    exportAll: string;
    reset: string;
    center: string;
    autoPlace: string;
  };
  canvas: {
    zoomIn: string;
    zoomOut: string;
    resetZoom: string;
    dragToMove: string;
    scrollToZoom: string;
  };
  viewer: {
    loading: string;
    clickToPlace: string;
  };
  editor: {
    uploadHint: string;
    placeHint: string;
    dragHint: string;
  };
  controls: {
    zoomIn: string;
    zoomOut: string;
    rotateLeft: string;
    rotateRight: string;
  };
  export: {
    exporting: string;
    success: string;
    failed: string;
    button: string;
    complete: string;
    noDesigns: string;
    summary: string;
    zonesExported: string;
    zones: string;
    color: string;
  };
  keyboard: {
    rotate: string;
    scale: string;
    delete: string;
  };
  presets: {
    title: string;
    uploadFirst: string;
    leftChest: string;
    centerChest: string;
    fullFront: string;
    oversizeFront: string;
    backCollar: string;
    upperBack: string;
    fullBack: string;
    sleeveSmall: string;
    sleeveMedium: string;
    sleeveLarge: string;
  };
}

export const en: TranslationKeys = {
  app: {
    title: '3D Configurator',
  },
  header: {
    darkMode: 'Dark mode',
    lightMode: 'Light mode',
  },
  zones: {
    front: 'Front',
    back: 'Back',
    left_arm: 'Left Arm',
    right_arm: 'Right Arm',
    all: 'All Zones',
  },
  tools: {
    upload: 'Upload Image',
    selectZoneToUpload: 'Select a specific zone to upload an image',
    color: 'T-Shirt Color',
    width: 'Width (cm)',
    snap: 'Snap Settings',
    centerSnap: 'Center Snap',
    gridSnap: 'Grid Snap',
    gridSize: 'Grid Size (cm)',
    safeZone: 'Show Safe Zone',
  },
  actions: {
    submit: 'Submit',
    lock: 'Lock',
    unlock: 'Unlock',
    export: 'Export',
    exportAll: 'Export All',
    reset: 'Reset',
    center: 'Center',
    autoPlace: 'Auto Place',
  },
  canvas: {
    zoomIn: 'Zoom In',
    zoomOut: 'Zoom Out',
    resetZoom: 'Reset Zoom',
    dragToMove: 'Drag to move',
    scrollToZoom: 'Scroll to zoom',
  },
  viewer: {
    loading: 'Loading model...',
    clickToPlace: 'Click on model to place artwork',
  },
  editor: {
    uploadHint: 'Upload an image to start designing',
    placeHint: 'Click on 3D model to place artwork',
    dragHint: 'Drag to move, pinch to zoom',
  },
  controls: {
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    rotateLeft: 'Rotate left',
    rotateRight: 'Rotate right',
  },
  export: {
    exporting: 'Exporting...',
    success: 'Export complete',
    failed: 'Export failed',
    button: 'Export Design',
    complete: 'Download Complete',
    noDesigns: 'Add artwork to at least one zone to export',
    summary: 'Export Summary',
    zonesExported: 'Zones exported',
    zones: 'Zones',
    color: 'Color',
  },
  keyboard: {
    rotate: 'R - Rotate 15°',
    scale: 'Scroll - Scale',
    delete: 'Del - Clear',
  },
  presets: {
    title: 'Quick Placement',
    uploadFirst: 'Upload an image first',
    leftChest: 'Left Chest',
    centerChest: 'Center Chest',
    fullFront: 'Full Front',
    oversizeFront: 'Oversize',
    backCollar: 'Back Collar',
    upperBack: 'Upper Back',
    fullBack: 'Full Back',
    sleeveSmall: 'Small',
    sleeveMedium: 'Medium',
    sleeveLarge: 'Large',
  },
};
