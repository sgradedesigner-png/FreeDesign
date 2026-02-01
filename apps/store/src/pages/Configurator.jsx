import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// --- Core Modules ---
import { initScene, getContext } from '../three/core/scene.js';
import { createRenderer, resizeRendererToElement } from '../three/core/renderer.js';
import { createControls, setControlMode, updateControls } from '../three/core/controls.js';
import { hitTest } from '../three/core/raycast.js';

import { createArtworkController } from '../three/editor/placement.js';
import { setupUVEditor } from '../three/editor/uvCanvas.js';

import { buildPrintZoneFromMesh, isUVInsidePrintZone } from '../three/zones/zoneDetector.js';
import { uvToPrintCM } from '../three/zones/zoneMetrics.js';
import { pickOnMeshByUV } from '../three/zones/uvPick.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'; 
import {
  createDecalMaterial,
  setArtworkTextureFromImage,
  hasArtworkTexture
} from '../three/decal/decalMaterial.js';

import { buildPoseFromHit } from '../three/decal/decalPose.js';
import { buildDecalMesh, disposeDecalMesh } from '../three/decal/decalBuilder.js';

import { bakeManyPNGsAndJSON } from '../three/print/exportPNG.js';
import { loadImageFromFile } from '../three/utils/image.js';
import { downloadDataURL, downloadText } from '../three/utils/download.js';

import { ZONE_CM } from '../three/config/printZones.js';
import { DEFAULT_DPI, DEFAULT_TEMPLATE_PX, DECAL_DEPTH, WORLD_ZONE_W } from '../three/config/constants.js';
import { getSafeRectRel, clampPlacementToSafe } from '../three/editor/safeZone.js';

// Assets
import tshirtUrl from '../assets/model/Tshirt/TShirt.glb?url';
import uvTemplateUrl from '../assets/uv/tshirt_uv.png?url';

export default function Configurator() {
  // DOM Refs
  const viewerRef = useRef(null);
  const canvas3DRef = useRef(null);
  const artCanvasRef = useRef(null);
  const artViewportRef = useRef(null);
  const hudRef = useRef(null);
  const overlayBoxRef = useRef(null);
  const fileInputRef = useRef(null);
  const inpWidthCmRef = useRef(null);

  // Engine State
  const engine = useRef({
    scene: null, camera: null, renderer: null, controls: null, tshirtRoot: null,
    zones: {}, activeZoneKey: 'front', zoneMesh: null, printZone: null, printZoneCM: { width: 30, height: 40 },
    zoneDrafts: {
      front: { image: null, placement: null, locked: false },
      back: { image: null, placement: null, locked: false },
      left_arm: { image: null, placement: null, locked: false },
      right_arm: { image: null, placement: null, locked: false },
    },
    zoneDecals: {}, editor: null, artworkCtrl: null,
    isDragging: false, decalPose: null, decalW: 0.25, decalH: 0.25, worldZoneWDynamic: WORLD_ZONE_W,
    modelSize: null, baseMats: [], currentBaseColor: '#1f6feb',
    rafId: null, decalRafId: null, resizingCorner: null, resizeStart: null
  });

  // UI State
  const [activeZoneKey, setActiveZoneKey] = useState('front');
  const [isZoneLocked, setIsZoneLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [snapCenter, setSnapCenter] = useState(true);
  const [snapGrid, setSnapGrid] = useState(false);
  const [gridCm, setGridCm] = useState(1);
  const [artworkWidthCm, setArtworkWidthCm] = useState(24.7);

// --- INITIALIZATION ---
  useEffect(() => {
    if (!viewerRef.current) return;
    
    // Canvas давхардахаас сэргийлж цэвэрлэнэ
    viewerRef.current.innerHTML = ''; 

    // 1. Scene Setup
    initScene({ 
      background: null, 
      lightProfile: 'studio', 
      aspect: viewerRef.current.clientWidth / Math.max(1, viewerRef.current.clientHeight) 
    });

    const { scene, camera } = getContext();
    const { renderer, canvas } = createRenderer(viewerRef.current, { alpha: true });
    
    // 🔥🔥🔥 ЗАСВАР: Өнгө болон Гэрэлтүүлгийг сайжруулах хэсэг 🔥🔥🔥
    
    // 1. Өнгөний орон зайг SRGB болгох (Өнгийг зөв харагдуулна)
    renderer.outputColorSpace = THREE.SRGBColorSpace; 
    
    // 2. Tone Mapping (Контраст болон гялбааг сайжруулна - Vanilla JS шиг болгоно)
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0; // Хэт харанхуй байвал 1.2 эсвэл 1.5 болгож ихэсгээрэй

    // 3. Сүүдэр (хэрэв гэрэлтүүлэг сүүдэртэй бол)
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    // -------------------------------------------------------------
    /*// 🔥🔥🔥 ШИНЭ: ГЭРЭЛТҮҮЛЭГ НЭМЭХ ХЭСЭГ 🔥🔥🔥

    // 1. ОРЧНЫ ГЭРЭЛ (Environment Map) - Хамгийн чухал нь!
    // Энэ нь цамцны материал гэрлийг ойлгож, илүү бодитой гялалзаж харагдахад тусална.
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    const envMap = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envMap;
    // scene.background = null; // Арын фоныг тунгалаг хэвээр үлдээнэ

    // 2. ҮНДСЭН ГЭРЭЛ (Key Light) - Баруун урдаас тусна
    const mainLight = new THREE.DirectionalLight(0xffffff, 2.0); // 2.0 бол гэрлийн хүч
    mainLight.position.set(5, 10, 7);
    mainLight.castShadow = true;
    scene.add(mainLight);

    // 3. ДҮҮРГЭГЧ ГЭРЭЛ (Fill Light) - Зүүн талаас зөөлөн тусна (сүүдрийг бүдгэрүүлнэ)
    const fillLight = new THREE.DirectionalLight(0xffffff, 1.0);
    fillLight.position.set(-5, 0, 5);
    scene.add(fillLight);

    // 4. АРЫН ГЭРЭЛ (Back Light) - Ардаас тусч моделийг фонноос салгаж харагдуулна
    const backLight = new THREE.DirectionalLight(0xffffff, 1.5);
    backLight.position.set(0, 5, -10);
    scene.add(backLight);

    // 5. ОРЧНЫ ЕРӨНХИЙ ГЭРЭЛ (Ambient Light) - Тас харанхуй хэсэг үлдээхгүйн тулд
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    // 🔥🔥🔥 --------------------------------- 🔥🔥🔥
    */
    // Engine ref-д хадгалах
    engine.current.scene = scene; 
    engine.current.camera = camera; 
    engine.current.renderer = renderer; 
    canvas3DRef.current = canvas;

    const controls = createControls(camera, canvas);
    setControlMode('EDIT');
    engine.current.controls = controls;

    // 2. Artwork Controller
    engine.current.artworkCtrl = createArtworkController({
      onUpdate: () => {
        redraw2D();
        const poseOK = updatePoseFromPlacementUV();
        if (engine.current.artworkCtrl.hasImage() && (engine.current.decalPose || poseOK)) scheduleDecalRebuild();
      }
    });

    // 3. Load Model
    const loader = new GLTFLoader();
    loader.load(tshirtUrl, async (gltf) => {
      const root = gltf.scene;
      engine.current.tshirtRoot = root;
      scene.add(root);
      collectBaseMaterials(root);
      setTshirtBaseColor(engine.current.currentBaseColor);

      const box = new THREE.Box3().setFromObject(root);
      engine.current.modelSize = box.getSize(new THREE.Vector3());
      root.position.sub(box.getCenter(new THREE.Vector3()));
      fitCameraToModel(1.35);

      const zones = {};
      root.traverse((o) => {
        if (!o.isMesh) return;
        if (o.name === 'PRINT_ZONE_FRONT') zones.front = buildPrintZoneFromMesh(o, 'front');
        if (o.name === 'PRINT_ZONE_BACK') zones.back = buildPrintZoneFromMesh(o, 'back');
        if (o.name === 'PRINT_ZONE_LEFT_ARM') zones.left_arm = buildPrintZoneFromMesh(o, 'left_arm');
        if (o.name === 'PRINT_ZONE_RIGHT_ARM') zones.right_arm = buildPrintZoneFromMesh(o, 'right_arm');
      });
      engine.current.zones = zones;
      await initEditorOnce();
      handleZoneChange('front');
      setLoading(false);
      handleResize();
    });

    // 4. Animation Loop
    const animate = () => {
      engine.current.rafId = requestAnimationFrame(animate);
      updateControls();
      renderer.render(scene, camera);
      engine.current.editor?.updateOverlayBox?.();
    };
    animate();

    // 5. Events
    window.addEventListener('resize', handleResize);
    window.addEventListener('keydown', onKeyDown);
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    const vp = artViewportRef.current;
    if(vp) vp.addEventListener('wheel', onArtWheel, { passive: false });

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', onKeyDown);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      if(vp) vp.removeEventListener('wheel', onArtWheel);
      cancelAnimationFrame(engine.current.rafId);
      cancelAnimationFrame(engine.current.decalRafId);
      if (viewerRef.current && canvas) viewerRef.current.removeChild(canvas);
      renderer.dispose();
      engine.current.editor?.dispose?.();
    };
  }, []);

  // --- LOGIC ---
  const handleResize = () => {
    const { renderer, camera, modelSize } = engine.current;
    if (!viewerRef.current || !renderer || !camera) return;
    resizeRendererToElement(renderer, viewerRef.current);
    camera.aspect = viewerRef.current.clientWidth / Math.max(1, viewerRef.current.clientHeight);
    camera.updateProjectionMatrix();
    if (modelSize) fitCameraToModel(1.35);
  };

  const fitCameraToModel = (framing = 1.35) => {
    const { modelSize, controls, camera } = engine.current;
    if (!modelSize) return;
    const maxDim = Math.max(modelSize.x, modelSize.y, modelSize.z);
    const fov = THREE.MathUtils.degToRad(camera.fov);
    const dist = framing * (maxDim / 2) / Math.tan(fov / 2);
    controls.target.set(0,0,0);
    camera.position.set(0, 0, dist);
    camera.updateProjectionMatrix();
    controls.update();
  };

  const moveCameraToSide = (side) => {
    const { modelSize, camera, controls } = engine.current;
    if (!modelSize) return;
    const maxDim = Math.max(modelSize.x, modelSize.y, modelSize.z);
    const dist = maxDim * 2.0;
    const pos = new THREE.Vector3();
    switch (side) {
      case 'front': pos.set(0, 0, dist); break;
      case 'back': pos.set(0, 0, -dist); break;
      case 'left_arm': pos.set(dist * 0.9, 0, 0); break;
      case 'right_arm': pos.set(-dist * 0.9, 0, 0); break;
      case 'all': default: pos.set(0, 0, dist * 1.2); break;
    }
    camera.position.copy(pos);
    controls.target.set(0, 0, 0);
    camera.lookAt(0, 0, 0);
    controls.update();
  };

 // src/pages/Configurator.jsx

  const collectBaseMaterials = (root) => {
    const mats = new Set();
    root.traverse((o) => {
      if (!o.isMesh) return;
      if (o.name?.startsWith('PRINT_ZONE_')) return;
      
      const m = o.material;
      
      // 🔥 ШИНЭ: Материалыг даавуу шиг болгох тохиргоо
      if (m) {
        // 1. Roughness (Барзгар): 0.0 = Толь шиг, 1.0 = Шохой шиг
        // Даавуу ихэнхдээ 0.6 - 0.8 хооронд байдаг.
        m.roughness = 0.7; 

        // 2. Metalness (Металл): Даавуу металл биш тул 0 байх ёстой.
        m.metalness = 0.0;
        
        // 3. (Сонголтоор) Хэрэв texture хэт гялгар байвал
        m.envMapIntensity = 0.8; // Орчны гэрлийн ойлтыг багасгах
        
        m.needsUpdate = true;
      }

      if (Array.isArray(m)) m.forEach(mm => mm && mats.add(mm));
      else if (m) mats.add(m);
    });
    engine.current.baseMats = [...mats].filter(m => m && m.isMaterial);
  };

  const setTshirtBaseColor = (hex) => {
    engine.current.currentBaseColor = hex;
    const c = new THREE.Color(hex);
    engine.current.baseMats.forEach((m) => { if (m.color) { m.color.copy(c); m.needsUpdate = true; } });
  };

  const ensureZoneDecal = (key) => {
    const { zoneDecals, renderer } = engine.current;
    if (!zoneDecals[key]) zoneDecals[key] = { mesh: null, pose: null, material: createDecalMaterial(renderer).material, image: null, placement: null, printZoneCM: null };
    return zoneDecals[key];
  };

  const clearZoneDecal = (key) => {
    const zs = ensureZoneDecal(key);
    if(zs.mesh) { disposeDecalMesh(zs.mesh, engine.current.scene); zs.mesh = null; }
    zs.pose = null; zs.image = null; zs.placement = null;
  }

  const scheduleDecalRebuild = () => {
    if (engine.current.decalRafId) return;
    engine.current.decalRafId = requestAnimationFrame(() => { engine.current.decalRafId = 0; applyDecalFromPose(); });
  };

  const applyDecalFromPose = () => {
    const { activeZoneKey, artworkCtrl, zones, scene } = engine.current;
    const zs = ensureZoneDecal(activeZoneKey);
    if (!zs.pose || !artworkCtrl.hasImage() || !hasArtworkTexture()) return;
    if (!zs.material?.map) return;
    syncDecalWHFromPlacement();
    const userRot = artworkCtrl.getPlacement()?.rotationRad || 0;
    const fixRot = zones?.[activeZoneKey]?.correctionRad || 0;
    let depth = DECAL_DEPTH;
    if (activeZoneKey === 'left_arm' || activeZoneKey === 'right_arm') depth = 0.05;
    const mesh = buildDecalMesh(zs.pose, { width: engine.current.decalW, height: engine.current.decalH, depth }, userRot + fixRot, zs.material);
    if (zs.mesh) disposeDecalMesh(zs.mesh, scene);
    zs.mesh = mesh;
    scene.add(zs.mesh);
  };

  const syncDecalWHFromPlacement = () => {
    const { artworkCtrl, worldZoneWDynamic } = engine.current;
    const p = artworkCtrl.getPlacement();
    const img = artworkCtrl.getImage();
    if (!p || !img) return;
    const w = p.uScale * worldZoneWDynamic;
    const ratio = img.height / Math.max(1e-6, img.width);
    engine.current.decalW = Math.min(1.5, Math.max(0.05, w));
    engine.current.decalH = Math.min(1.5, Math.max(0.05, w * ratio));
  };

  const relToAbsUV = (pu, pv, rect) => {
    const u = rect.uMin + pu * (rect.uMax - rect.uMin);
    const v = rect.vMin + pv * (rect.vMax - rect.vMin);
    const EPS = 1e-4;
    return new THREE.Vector2(Math.min(1-EPS, Math.max(EPS, u)), Math.min(1-EPS, Math.max(EPS, v)));
  };

  const updatePoseFromPlacementUV = () => {
    const { printZone, zoneMesh, artworkCtrl, activeZoneKey } = engine.current;
    if (!printZone || !zoneMesh?.isMesh) return false;
    const p = artworkCtrl.getPlacement?.();
    if (!p) return false;
    const prefUV = relToAbsUV(p.u, p.v, printZone);
    let hit = pickOnMeshByUV(zoneMesh, prefUV, { uvAttr: 'uv' });
    if (!hit) hit = pickOnMeshByUV(zoneMesh, prefUV, { uvAttr: 'uv2' });
    if (!hit) return false;
    const pose = buildPoseFromHit(hit);
    if (!pose) return false;
    pose.object = zoneMesh;
    engine.current.decalPose = pose;
    const zs = ensureZoneDecal(activeZoneKey);
    zs.pose = pose;
    return true;
  };

  const clampPlacementNow = () => {
    const { artworkCtrl, activeZoneKey, printZoneCM } = engine.current;
    const p = artworkCtrl.getPlacement?.();
    if (!p) return false;
    const key = activeZoneKey || 'front';
    const safe = getSafeRectRel(key, printZoneCM);
    clampPlacementToSafe(p, safe);
    artworkCtrl.setPlacement(p);
    return true;
  };

  const handleZoneChange = (key) => {
    const state = engine.current;
    // Save previous
    if (state.activeZoneKey !== 'all') {
      const d = state.zoneDrafts[state.activeZoneKey];
      if (d) {
        d.image = state.artworkCtrl.getImage?.() || null;
        d.placement = state.artworkCtrl.getPlacement?.() ? { ...state.artworkCtrl.getPlacement() } : null;
      }
    }
    // "All" View Logic
    if (key === 'all') {
      state.activeZoneKey = 'all';
      setActiveZoneKey('all');
      state.zoneMesh = null; state.printZone = null; state.decalPose = null;
      state.artworkCtrl.setImage(null); state.artworkCtrl.setPlacement(null);
      setControlMode('VIEW');
      redraw2D();
      moveCameraToSide('all');
      setIsZoneLocked(true);
      return;
    }
    // Normal Zone Logic
    if (!state.zones?.[key]) return;
    state.activeZoneKey = key;
    setActiveZoneKey(key);
    state.printZoneCM = (ZONE_CM?.tshirt?.[key]) || { width: 30, height: 40 };
    const meshName = `PRINT_ZONE_${key.toUpperCase()}`;
    let found = null;
    state.tshirtRoot?.traverse(o => { if (o.name === meshName) found = o; });
    state.zoneMesh = found;
    if (found) {
        const b = new THREE.Box3().setFromObject(found);
        const s = b.getSize(new THREE.Vector3());
        state.worldZoneWDynamic = Math.max(s.x, s.z);
    }
    state.printZone = state.zones[key];
    const d = state.zoneDrafts[key];
    state.artworkCtrl.setImage(d.image || null);
    state.artworkCtrl.setPlacement(d.placement ? { ...d.placement } : null);
    const zs = ensureZoneDecal(key);
    if(d.image) setArtworkTextureFromImage(d.image, zs.material, state.renderer, { flipU: false });
    const locked = !!d.locked;
    setControlMode(locked ? 'LOCKED' : 'EDIT');
    setIsZoneLocked(locked);
    redraw2D();
    if (d.image && d.placement) {
        state.decalPose = null;
        if(updatePoseFromPlacementUV()) scheduleDecalRebuild();
    }
    moveCameraToSide(key);
  };

  const initEditorOnce = async () => {
    if (engine.current.editor) return;
    let img = null;
    try { img = new Image(); img.src = uvTemplateUrl; await new Promise(r => img.onload = r); } catch(e) {}
    engine.current.editor = setupUVEditor({
        artCanvas: artCanvasRef.current, artViewport: artViewportRef.current, overlayBox: overlayBoxRef.current,
        hud: hudRef.current, camera: engine.current.camera, canvas3D: canvas3DRef.current,
        printZoneCM: engine.current.printZoneCM,
        getPose: () => engine.current.decalPose,
        getDecalSize: () => ({ w: engine.current.decalW, h: engine.current.decalH }),
        setDecalSize: (w, h) => { engine.current.decalW = w; engine.current.decalH = h; },
        artworkCtrl: engine.current.artworkCtrl,
        readSnapUI: () => ({ enableCenter: snapCenter, enableGrid: snapGrid, gridCm: gridCm }),
        onApplyDecalFromPose: () => { updatePoseFromPlacementUV(); scheduleDecalRebuild(); redraw2D(); },
        template: img ? { img } : null,
        zones: engine.current.zones,
        getActiveZoneKey: () => engine.current.activeZoneKey,
        getAllZoneDrafts: () => engine.current.zoneDrafts,
        getIsDark: () => document.documentElement.classList.contains('dark')
    });
  };

  const redraw2D = () => { engine.current.editor?.drawEditor?.(); engine.current.editor?.updateOverlayBox?.(); };

  // Handlers
  const onUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (engine.current.activeZoneKey === 'all') { alert("Select a zone first"); return; }
    if (isZoneLocked) { setLockedState(engine.current.activeZoneKey, false); clearZoneDecal(engine.current.activeZoneKey); }
    const img = await loadImageFromFile(file);
    const { artworkCtrl, activeZoneKey, renderer, zoneDrafts } = engine.current;
    artworkCtrl.setImage(img);
    const zs = ensureZoneDecal(activeZoneKey);
    setArtworkTextureFromImage(img, zs.material, renderer, { flipU: true });
    let p = { u: 0.5, v: 0.5, rotationRad: 0, uScale: 0.3, vScale: 0.3 };
    const ratio = img.height / Math.max(1e-6, img.width);
    p.vScale = p.uScale * ratio;
    artworkCtrl.setPlacement(p);
    clampPlacementNow();
    updatePoseFromPlacementUV();
    scheduleDecalRebuild();
    redraw2D();
    zoneDrafts[activeZoneKey].image = img;
    zoneDrafts[activeZoneKey].placement = { ...p };
    zoneDrafts[activeZoneKey].locked = false;
    setLockedState(activeZoneKey, false);
    if(fileInputRef.current) fileInputRef.current.value = "";
  };

  const onPointerDown = (e) => {
    const state = engine.current;
    const locked = state.zoneDrafts[state.activeZoneKey]?.locked;
    if (!state.printZone ||  locked) return;
    const hit = hitTest(e, state.camera, state.zoneMesh, canvas3DRef.current);
    if (!hit || !isUVInsidePrintZone(hit.uv, state.printZone)) return;
    if(!state.artworkCtrl.hasImage()) return;
    state.isDragging = true;
    state.controls.enabled = false;
    state.artworkCtrl.placeAtUV(hit.uv, state.printZone);
    clampPlacementNow();
    const pose = buildPoseFromHit(hit);
    if(pose) { pose.object = state.zoneMesh; state.decalPose = pose; ensureZoneDecal(state.activeZoneKey).pose = pose; scheduleDecalRebuild(); }
    redraw2D();
  };

  const onPointerMove = (e) => {
    const state = engine.current;
    const locked = state.zoneDrafts[state.activeZoneKey]?.locked;
    if (locked || !state.isDragging) return;
    const hit = hitTest(e, state.camera, state.zoneMesh, canvas3DRef.current);
    if (!hit || !isUVInsidePrintZone(hit.uv, state.printZone)) return;
    state.artworkCtrl.placeAtUV(hit.uv, state.printZone);
    clampPlacementNow();
    const pose = buildPoseFromHit(hit);
    if(pose) { pose.object = state.zoneMesh; state.decalPose = pose; ensureZoneDecal(state.activeZoneKey).pose = pose; scheduleDecalRebuild(); }
    redraw2D();
  };

  const onPointerUp = () => { engine.current.isDragging = false; if(engine.current.controls) engine.current.controls.enabled = true; };
  const onArtWheel = (e) => {
    if(!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
     const state = engine.current;
    const locked = state.zoneDrafts[state.activeZoneKey]?.locked; // ✅ ЗАСВАР
    if(locked) return;
    engine.current.artworkCtrl.scaleBy(e.deltaY > 0 ? 0.95 : 1.05);
    clampPlacementNow(); scheduleDecalRebuild(); redraw2D();
  };
  const onKeyDown = (e) => {
     const state = engine.current;
    const locked = state.zoneDrafts[state.activeZoneKey]?.locked; // ✅ ЗАСВАР
    if(e.key.toLowerCase() === 'r' && !!locked) { engine.current.artworkCtrl.rotateByDeg(5); scheduleDecalRebuild(); redraw2D(); }
  };
  const setLockedState = (key, lock) => {
     engine.current.zoneDrafts[key].locked = !!lock;
     if(key === engine.current.activeZoneKey) { setIsZoneLocked(!!lock); setControlMode(!!lock ? 'LOCKED' : 'EDIT'); }
  };
  const toggleLock = () => { if(engine.current.activeZoneKey === 'all') return; setLockedState(engine.current.activeZoneKey, !isZoneLocked); };
  
  const handleExport = async () => {
    const { zones, activeZoneKey, currentBaseColor, artworkCtrl, printZoneCM } = engine.current;
    const jobs = [];
    ['front', 'back', 'left_arm', 'right_arm'].forEach(k => {
        const zs = ensureZoneDecal(k);
        if(zs.image && zs.placement && zones[k]) {
            jobs.push({ key: k, artworkImage: zs.image, placement: zs.placement, printZone: zones[k], printZoneCM: zs.printZoneCM || (ZONE_CM.tshirt[k]), product: { id: 'tshirt', side: k, baseColor: currentBaseColor } });
        }
    });
    if(jobs.length === 0 && activeZoneKey !== 'all' && artworkCtrl.hasImage()) {
         jobs.push({ key: activeZoneKey, artworkImage: artworkCtrl.getImage(), placement: artworkCtrl.getPlacement(), printZone: zones[activeZoneKey], printZoneCM, product: { id: 'tshirt', side: activeZoneKey, baseColor: currentBaseColor } });
    }
    if(jobs.length === 0) { alert("Nothing to export"); return; }
    const results = await bakeManyPNGsAndJSON({ jobs, dpi: DEFAULT_DPI, templatePx: DEFAULT_TEMPLATE_PX });
    results.forEach(r => { downloadDataURL(r.pngDataURL, `print-${r.key}.png`); downloadText(JSON.stringify(r.json), `print-${r.key}.json`); });
    alert(`Exported ${results.length} files`);
  };

  const handleApplyWidth = () => {
      engine.current.editor?.applyWidthCm?.(artworkWidthCm);
  };

  // Overlay Handles
  const beginResize = (corner, e) => {
      const state = engine.current;
      const locked = state.zoneDrafts[state.activeZoneKey]?.locked; // ✅ ЗАСВАР
      if(locked) return;
      e.preventDefault(); e.stopPropagation();
      const { artworkCtrl, controls } = engine.current;
      if(!artworkCtrl.hasPlacement()) return;
      engine.current.resizingCorner = corner;
      const p = artworkCtrl.getPlacement();
      engine.current.resizeStart = { x: e.clientX, y: e.clientY, uScale: p.uScale, vScale: p.vScale };
      controls.enabled = false;
      window.addEventListener('pointermove', onResizeMove);
      window.addEventListener('pointerup', onResizeUp);
  };
  const onResizeMove = (e) => {
      const { resizingCorner, resizeStart, artworkCtrl } = engine.current;
      if(!resizingCorner) return;
      let dx = e.clientX - resizeStart.x;
      let dy = e.clientY - resizeStart.y;
      if(resizingCorner === 'tl' || resizingCorner === 'bl') dx = -dx;
      if(resizingCorner === 'bl' || resizingCorner === 'tr') dy = -dy;
      const k = 0.0015;
      let sx = Math.max(0.1, 1 + dx * k);
      let sy = Math.max(0.1, 1 + dy * k);
      const p = artworkCtrl.getPlacement();
      p.uScale = resizeStart.uScale * sx;
      p.vScale = resizeStart.vScale * sy;
      artworkCtrl.setPlacement(p);
      scheduleDecalRebuild(); redraw2D();
  };
  const onResizeUp = () => {
      engine.current.resizingCorner = null;
      if(engine.current.controls) engine.current.controls.enabled = true;
      window.removeEventListener('pointermove', onResizeMove);
      window.removeEventListener('pointerup', onResizeUp);
  };

  // Zoom handlers for toolbar
  const handleZoom = (factor) => {
     const locked = engine.current.zoneDrafts[engine.current.activeZoneKey]?.locked;
      if(locked) return;
      engine.current.artworkCtrl.scaleBy(factor);
      clampPlacementNow(); scheduleDecalRebuild(); redraw2D();
  };
  const handleFit = () => {
    const locked = engine.current.zoneDrafts[engine.current.activeZoneKey]?.locked; 
      if(locked) return;
      const p = engine.current.artworkCtrl.getPlacement();
      if(!p) return;
      p.u = 0.5; p.v = 0.5; p.rotationRad = 0;
      p.uScale = 0.3; p.vScale = 0.3; // Simple reset
      engine.current.artworkCtrl.setPlacement(p);
      clampPlacementNow(); scheduleDecalRebuild(); redraw2D();
  };

  return (
    <div className="flex-1 p-4 lg:p-8 grid grid-cols-1 xl:grid-cols-12 gap-8 bg-[#F8FAFC] dark:bg-[#0B1120] text-slate-800 dark:text-slate-300 min-h-screen">
      
      {/* --- LEFT: 2D Editor (5 cols) --- */}
      <section className="xl:col-span-5 flex flex-col bg-white dark:bg-slate-900 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden ring-1 ring-slate-900/5 dark:ring-white/10 h-[85vh]">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div>
            <h2 className="font-bold text-slate-800 dark:text-white">Design Placement</h2>
            <div className="text-xs font-medium text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 px-2 py-0.5 rounded-md inline-block mt-1">
              Print Zone: 30 x 40 cm ({activeZoneKey})
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
            <div className="flex items-center justify-between gap-3">
              <div className="flex gap-2 overflow-x-auto pb-1">
                {['front', 'back', 'left_arm', 'right_arm', 'all'].map(key => (
                    <button 
                        key={key}
                        onClick={() => handleZoneChange(key)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border border-transparent 
                        ${activeZoneKey === key 
                            ? 'bg-slate-800 text-white dark:bg-white dark:text-slate-900 shadow-md' 
                            : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'}`}
                    >
                        {key.replace('_', ' ').replace(/(^\w{1})|(\s+\w{1})/g, letter => letter.toUpperCase())}
                    </button>
                ))}
              </div>
              <p className="hidden sm:block text-[10px] text-slate-400 font-medium tracking-tight whitespace-nowrap">
                Tip: Hold Ctrl + Scroll to Zoom
              </p>
            </div>
        </div>

        {/* Canvas Area */}
        <div className="relative flex-1 overflow-hidden">
             <div className="relative m-3 h-[calc(100%-1.5rem)] rounded-2xl border border-slate-200/60 dark:border-slate-800/60 bg-slate-50 dark:bg-slate-950 overflow-hidden">
                
                {/* 2D Viewport */}
                <div ref={artViewportRef} className="absolute inset-0 w-full h-full flex items-center justify-center">
                    <canvas ref={artCanvasRef} className="block"></canvas>
                    <div ref={overlayBoxRef} id="overlayBox" className="absolute inset-0 pointer-events-none hidden">
                         {!isZoneLocked && (
                            <>
                                <div className="pointer-events-auto absolute w-3 h-3 bg-teal-500 border-2 border-white dark:border-slate-900 rounded-full shadow-md -top-1.5 -left-1.5 cursor-nwse-resize hover:scale-125 transition-transform" onPointerDown={(e) => beginResize('tl', e)}></div>
                                <div className="pointer-events-auto absolute w-3 h-3 bg-teal-500 border-2 border-white dark:border-slate-900 rounded-full shadow-md -top-1.5 -right-1.5 cursor-nesw-resize hover:scale-125 transition-transform" onPointerDown={(e) => beginResize('tr', e)}></div>
                                <div className="pointer-events-auto absolute w-3 h-3 bg-teal-500 border-2 border-white dark:border-slate-900 rounded-full shadow-md -bottom-1.5 -left-1.5 cursor-nesw-resize hover:scale-125 transition-transform" onPointerDown={(e) => beginResize('bl', e)}></div>
                                <div className="pointer-events-auto absolute w-3 h-3 bg-teal-500 border-2 border-white dark:border-slate-900 rounded-full shadow-md -bottom-1.5 -right-1.5 cursor-nwse-resize hover:scale-125 transition-transform" onPointerDown={(e) => beginResize('br', e)}></div>
                            </>
                         )}
                    </div>
                </div>

                {/* Toolbar */}
                <div className="sticky top-3 left-3 z-30 p-3 w-max">
                  <div className="flex flex-col items-stretch gap-2 rounded-2xl bg-slate-950/80 border border-slate-800 p-2 shadow-lg">
                    <button onClick={() => handleZoom(1.1)} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-slate-800 transition-colors text-slate-200 font-bold text-xl active:scale-95">+</button>
                    <button onClick={handleFit} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-slate-800 transition-colors text-slate-200 text-lg active:scale-95">⤢</button>
                    <button onClick={() => handleZoom(0.9)} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-slate-800 transition-colors text-slate-200 font-bold text-xl active:scale-95">−</button>
                    
                    <label className="cursor-pointer inline-flex flex-col items-center justify-center gap-1 w-10 h-14 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-[9px] font-bold shadow-lg shadow-teal-500/25 transition-all active:scale-95 mt-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                        <span>Up</span>
                        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onUpload} disabled={activeZoneKey === 'all'} />
                    </label>
                  </div>
                </div>

             </div>
        </div>
      </section>

      {/* --- MIDDLE: 3D Preview (4 cols) --- */}
      <section className="xl:col-span-4 flex flex-col bg-white dark:bg-slate-900 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden ring-1 ring-slate-900/5 dark:ring-white/10 h-[85vh]">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
            <h2 className="font-bold text-slate-800 dark:text-white">3D Preview</h2>
            <span className="px-2 py-1 rounded bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 text-xs font-bold uppercase tracking-wider">Edit Mode</span>
          </div>

          <div className="relative flex-1 bg-slate-100 dark:bg-slate-950 overflow-hidden">
             {loading && (
                 <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950 text-teal-500 font-bold animate-pulse">
                     Loading Model...
                 </div>
             )}
             <div ref={viewerRef} className="w-full h-full block outline-none"></div>

             {/* Color Panel */}
             <div className="absolute top-4 right-4 flex flex-col gap-2 p-2 bg-white/60 dark:bg-slate-900/60 backdrop-blur-md rounded-xl border border-white/20 shadow-lg z-10">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 text-center uppercase mb-1">Color</span>
                <div className="flex flex-col gap-2">
                    {['#1f6feb', '#ffffff', '#111827', '#6B007B'].map(c => (
                        <button key={c} onClick={() => setTshirtBaseColor(c)} className="w-8 h-8 rounded-full border-2 border-white dark:border-slate-700 shadow-sm ring-2 ring-transparent hover:ring-teal-500 transition-all focus:outline-none" style={{ backgroundColor: c }}></button>
                    ))}
                </div>
             </div>
          </div>
      </section>

      {/* --- RIGHT: Tools (3 cols) --- */}
      <aside className="xl:col-span-3 flex flex-col gap-5 h-[85vh] overflow-y-auto pr-1">
          
          {/* Quick Zone */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 ring-slate-900/5 dark:ring-white/10">
            <h3 className="font-bold text-slate-800 dark:text-white mb-3">Quick Zone</h3>
            <div className="grid grid-cols-2 gap-2">
               {['front', 'back', 'left_arm', 'right_arm'].map(z => (
                   <button key={z} onClick={() => handleZoneChange(z)} className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                       {z.replace('_', ' ').replace(/(^\w{1})|(\s+\w{1})/g, l => l.toUpperCase())}
                   </button>
               ))}
            </div>
          </div>

          {/* Settings */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
            <h3 className="font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
              <span className="w-1 h-4 bg-teal-500 rounded-full"></span>
              <span>Settings</span>
            </h3>
            <div className="flex flex-col gap-3">
              <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors">
                <input type="checkbox" checked={snapCenter} onChange={(e) => setSnapCenter(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500 dark:border-gray-600 dark:bg-gray-700" />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Snap to Center</span>
              </label>

              <div className="flex items-center gap-2">
                <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors flex-1">
                  <input type="checkbox" checked={snapGrid} onChange={(e) => setSnapGrid(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500 dark:border-gray-600 dark:bg-gray-700" />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Snap Grid</span>
                </label>
                <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg px-2 border border-slate-200 dark:border-slate-700">
                  <input type="number" value={gridCm} onChange={(e) => setGridCm(Number(e.target.value))} min="0" step="0.5" className="w-12 bg-transparent border-none text-right text-sm py-1 focus:ring-0 text-slate-700 dark:text-slate-200 p-0" />
                  <span className="text-xs text-slate-400 ml-1">cm</span>
                </div>
              </div>

              <div className="mt-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">Artwork Width</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input type="number" value={artworkWidthCm} onChange={(e) => setArtworkWidthCm(Number(e.target.value))} step="0.1" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">cm</span>
                  </div>
                  <button onClick={handleApplyWidth} className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-white text-sm font-bold rounded-lg transition-colors">Set</button>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex-1">
            <h3 className="font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
              <span class="w-1 h-4 bg-teal-500 rounded-full"></span>
              <span>Actions</span>
            </h3>

            <div className="flex flex-col gap-3">
              <button onClick={toggleLock} className="w-full py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors shadow-lg shadow-slate-900/10 flex items-center justify-center gap-2">
                <span>{isZoneLocked ? '🔓' : '🔒'}</span> <span>{isZoneLocked ? 'Unlock Zone' : 'Submit & Lock'}</span>
              </button>

              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setLockedState(activeZoneKey, false)} disabled={!isZoneLocked} className="py-2.5 bg-white dark:bg-transparent border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50">Edit</button>
                <button onClick={handleExport} className="py-2.5 bg-teal-500 text-white rounded-xl font-semibold hover:bg-teal-600 transition-colors shadow-lg shadow-teal-500/20">Export</button>
              </div>
            </div>
          </div>

      </aside>
    </div>
  );
}