● Төлөвлөгөө бэлэн боллоо. Одоо таны зөвшөөрөл хүсэж байна.
                                                                      ──────────────────────────────────────────────────────────────────────
 Ready to code?                                                       

 Here is Claude's plan:                                               
╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌ VITE-3D-Configurator → React Migration Plan                            
 Технологийн Сонголт                                                  
  
 - 3D: Plain Three.js + useRef
 - State: Zustand
 - UI: Shadcn/ui + TailwindCSS
 - Language: TypeScript

 ---
 1. Шинэ Төслийн Бүтэц

 src/
 ├── App.tsx                    # Root component
 ├── main.tsx                   # Entry point
 │
 ├── components/
 │   ├── layout/
 │   │   ├── AppLayout.tsx      # 3-column grid
 │   │   └── Header.tsx         # Theme/language toggles
 │   │
 │   ├── viewer3d/
 │   │   ├── ThreeCanvas.tsx    # Three.js container (useRef)
 │   │   ├── useThreeScene.ts   # Scene/camera/renderer hook
 │   │   ├── useGLTFLoader.ts   # Model loading hook
 │   │   ├── useDecalSystem.ts  # Decal management hook
 │   │   └── useRaycast.ts      # Raycasting hook
 │   │
 │   ├── editor2d/
 │   │   ├── UVCanvas.tsx       # 2D Canvas editor
 │   │   ├── useUVEditor.ts     # Editor logic hook
 │   │   ├── OverlayBox.tsx     # Resize handles
 │   │   └── ZoomControls.tsx   # +/- buttons
 │   │
 │   ├── zones/
 │   │   └── ZoneTabs.tsx       # Front/Back/Arms tabs
 │   │
 │   ├── tools/
 │   │   ├── ColorPicker.tsx    # T-shirt color
 │   │   ├── SettingsPanel.tsx  # Snap, grid, width settings
 │   │   ├── ActionsPanel.tsx   # Submit/Export buttons
 │   │   └── UploadButton.tsx   # File upload
 │   │
 │   └── ui/                    # Shadcn components
 │
 ├── stores/
 │   ├── useConfiguratorStore.ts  # Main Zustand store
 │   └── slices/
 │       ├── sceneSlice.ts      # 3D scene state
 │       ├── zoneSlice.ts       # Zone selection
 │       ├── artworkSlice.ts    # Artwork placement
 │       ├── decalSlice.ts      # Decal meshes
 │       ├── uiSlice.ts         # Theme, language
 │       └── exportSlice.ts     # Export state
 │
 ├── three/                     # Pure Three.js (minimal changes)     
 │   ├── core/
 │   │   ├── scene.ts           # Scene factory
 │   │   ├── renderer.ts        # Renderer factory
 │   │   ├── controls.ts        # OrbitControls factory
 │   │   └── raycast.ts         # Raycasting utils
 │   ├── decal/
 │   │   ├── decalMaterial.ts
 │   │   ├── decalPose.ts
 │   │   └── decalBuilder.ts
 │   └── zones/
 │       ├── zoneDetector.ts
 │       ├── zoneMetrics.ts
 │       └── uvPick.ts
 │
 ├── editor/                    # 2D Canvas logic
 │   ├── placement.ts
 │   ├── safeZone.ts
 │   ├── uvDraw.ts
 │   └── transforms.ts
 │
 ├── print/                     # Export system
 │   ├── exportPNG.ts
 │   ├── exportJSON.ts
 │   └── dpiEvaluator.ts
 │
 ├── config/
 │   ├── constants.ts
 │   ├── printZones.ts
 │   └── safeMargins.ts
 │
 ├── hooks/
 │   ├── useTheme.ts
 │   ├── useI18n.ts
 │   └── useKeyboardShortcuts.ts
 │
 ├── types/
 │   ├── zone.ts
 │   ├── placement.ts
 │   ├── decal.ts
 │   └── store.ts
 │
 └── i18n/
     ├── en.ts
     └── mn.ts

 ---
 2. Zustand Store Бүтэц

 Main Store

 // stores/useConfiguratorStore.ts
 export const useConfiguratorStore = create<ConfiguratorStore>()(     
   devtools(
     immer((...a) => ({
       ...createSceneSlice(...a),
       ...createZoneSlice(...a),
       ...createArtworkSlice(...a),
       ...createDecalSlice(...a),
       ...createUISlice(...a),
       ...createExportSlice(...a),
     }))
   )
 );

 Гол Slices:

 sceneSlice: scene, camera, renderer, controls, modelLoaded,
 baseColor, baseMaterials

 zoneSlice: zones, activeZoneKey, zoneMeshes, printZoneCM

 artworkSlice: zoneDrafts, currentImage, currentPlacement, scaleBy(), 
  rotateByDeg(), centerAndFit()

 uiSlice: theme, language, snapSettings, isDragging, isResizing       

 exportSlice: isExporting, exportProgress, exportAllZones()

 ---
 3. TypeScript Interfaces

 // types/zone.ts
 export type ZoneKey = 'front' | 'back' | 'left_arm' | 'right_arm';   

 export interface ZoneRect {
   uMin: number; uMax: number;
   vMin: number; vMax: number;
   outline: { u: number; v: number }[] | null;
   name: string; side: ZoneKey;
   correctionRad: number;
 }

 // types/placement.ts
 export interface Placement {
   u: number;           // 0-1, horizontal center
   v: number;           // 0-1, vertical center
   uScale: number;      // 0.05-1.2
   vScale: number;      // 0.05-1.2
   rotationRad: number;
 }

 export interface ZoneDraft {
   image: HTMLImageElement | null;
   placement: Placement | null;
   locked: boolean;
 }

 // types/decal.ts
 export interface DecalPose {
   object: THREE.Mesh;
   position: THREE.Vector3;
   baseOrientation: THREE.Euler;
 }

 ---
 4. Migration Phases (Үе шатууд)

 Phase 1: Төсөл үүсгэх

 npm create vite@latest . -- --template react-ts
 npm install three zustand immer
 npm install -D @types/three
 npx tailwindcss init -p
 npx shadcn@latest init
 - TypeScript paths тохируулах
 - TailwindCSS dark mode тохируулах
 - public/assets/ хуулах

 Phase 2: Types & Config

 - /types/ дотор бүх interface үүсгэх
 - /config/ файлуудыг TypeScript руу хөрвүүлэх

 Phase 3: Three.js Modules

 - /three/core/ - scene, renderer, controls factory functions
 - /three/decal/ - decal system
 - /three/zones/ - zone detection
 - Гол өөрчлөлт: Singleton pattern устгах, factory function болгох    

 Phase 4: Zustand Store

 - Бүх slices үүсгэх
 - Store actions хэрэгжүүлэх
 - DevTools интеграци

 Phase 5: Shadcn/UI Components

 npx shadcn@latest add button input checkbox tabs card tooltip        

 Phase 6: Layout Components

 - AppLayout.tsx - 3-column responsive grid
 - Header.tsx - Theme/language toggle

 Phase 7: Three.js Canvas (Гол хэсэг)

 // ThreeCanvas.tsx - Pattern
 const containerRef = useRef<HTMLDivElement>(null);
 const rendererRef = useRef<THREE.WebGLRenderer | null>(null);        

 useEffect(() => {
   // Initialize Three.js
   const { scene, camera } = createSceneWithLights(...);
   const { renderer } = createRenderer(containerRef.current);
   const controls = createControls(camera, renderer.domElement);      

   // Store in Zustand
   setScene(scene); setCamera(camera); ...

   // Animation loop
   const animate = () => { ... };
   animate();

   return () => { /* Cleanup */ };
 }, []);

 Phase 8: 2D Canvas Editor

 - UVCanvas.tsx - useRef + drawing functions
 - Event handlers (pointer, touch, wheel)
 - Resize handles overlay

 Phase 9: Zone System

 - ZoneTabs.tsx - Zone switching
 - Camera movement on zone change
 - Draft save/restore logic

 Phase 10: Artwork Upload

 - File input → Image loading
 - centerAndFit() on upload
 - 3D placement with raycast

 Phase 11: Tool Panels

 - ColorPicker, SettingsPanel, ActionsPanel
 - Width input, snap toggles

 Phase 12: Export System

 - PNG export бүх zone-д
 - JSON metadata
 - 3D preview screenshot

 Phase 13: Theme & i18n

 - useTheme hook (localStorage)
 - useI18n hook

 Phase 14: Keyboard & Events

 - useKeyboardShortcuts hook
 - Proper event cleanup

 Phase 15: Performance

 - React.memo expensive components
 - Selective Zustand subscriptions
 - requestAnimationFrame scheduling

 ---
 5. Гол Code Patterns

 Three.js + useRef

 const containerRef = useRef<HTMLDivElement>(null);
 useEffect(() => {
   // Initialize
   return () => { /* Dispose */ };
 }, []);

 Selective Zustand Subscription

 // Зөвхөн хэрэгтэй state-г subscribe хийх
 const activeZone = useConfiguratorStore(s => s.activeZoneKey);       

 Event Cleanup

 useEffect(() => {
   const handler = (e: KeyboardEvent) => { ... };
   window.addEventListener('keydown', handler);
   return () => window.removeEventListener('keydown', handler);       
 }, []);

 ---
 6. Өөрчлөх Гол Файлууд
 Одоогийн: main.js
 Шинэ: Zustand stores + App.tsx
 Өөрчлөлт: Global state → Zustand slices
 ────────────────────────────────────────
 Одоогийн: core/scene.js
 Шинэ: three/core/scene.ts
 Өөрчлөлт: Singleton → Factory
 ────────────────────────────────────────
 Одоогийн: editor/uvCanvas.js
 Шинэ: components/editor2d/UVCanvas.tsx
 Өөрчлөлт: Class → React component
 ────────────────────────────────────────
 Одоогийн: editor/placement.js
 Шинэ: stores/slices/artworkSlice.ts
 Өөрчлөлт: Object → Zustand slice
 ────────────────────────────────────────
 Одоогийн: decal/decalMaterial.js
 Шинэ: three/decal/decalMaterial.ts
 Өөрчлөлт: Global → Per-zone
 ---
 7. Verification (Шалгах)

 1. Build шалгах
 npm run build
 npm run preview
 2. Функционал шалгах
   - Model ачаалагдаж байна
   - Zone tab солих
   - Зураг upload хийх
   - 3D дээр click → place
   - 2D canvas дээр drag/resize
   - Zoom in/out (+/- buttons)
   - Rotation (R key)
   - Submit & Lock
   - Export PNG + JSON
   - Dark mode toggle
   - Language toggle
 3. Performance
   - 60fps animation
   - No unnecessary re-renders

 ---
 Dependencies

 {
   "dependencies": {
     "react": "^18.x",
     "react-dom": "^18.x",
     "three": "^0.160.x",
     "zustand": "^4.x",
     "immer": "^10.x"
   },
   "devDependencies": {
     "@types/three": "^0.160.x",
     "typescript": "^5.x",
     "tailwindcss": "^3.x",
     "vite": "^5.x"
   }
 }
╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌