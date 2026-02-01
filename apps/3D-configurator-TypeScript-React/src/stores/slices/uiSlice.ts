// src/stores/slices/uiSlice.ts
import type { StateCreator } from 'zustand';
import type { SnapSettings } from '../../types/placement';
import type { ConfiguratorStore } from '../types';

export type ThemeMode = 'light' | 'dark';
export type Language = 'en' | 'mn';

export interface UISlice {
  // State
  theme: ThemeMode;
  language: Language;
  snapSettings: SnapSettings;
  isDragging: boolean;
  isResizing: boolean;
  showGrid: boolean;
  showSafeZone: boolean;
  canvasZoom: number;

  // Actions
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  setLanguage: (language: Language) => void;
  setSnapSettings: (settings: Partial<SnapSettings>) => void;
  setIsDragging: (dragging: boolean) => void;
  setIsResizing: (resizing: boolean) => void;
  setShowGrid: (show: boolean) => void;
  setShowSafeZone: (show: boolean) => void;
  setCanvasZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
}

const DEFAULT_SNAP_SETTINGS: SnapSettings = {
  enableCenterSnap: true,
  enableGridSnap: false,
  gridCm: 1,
};

const getInitialTheme = (): ThemeMode => {
  if (typeof window === 'undefined') return 'light';
  const stored = localStorage.getItem('theme');
  if (stored === 'dark' || stored === 'light') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
};

const getInitialLanguage = (): Language => {
  if (typeof window === 'undefined') return 'en';
  const stored = localStorage.getItem('language');
  if (stored === 'en' || stored === 'mn') return stored;
  return 'mn';
};

export const createUISlice: StateCreator<
  ConfiguratorStore,
  [['zustand/immer', never]],
  [],
  UISlice
> = (set) => ({
  theme: getInitialTheme(),
  language: getInitialLanguage(),
  snapSettings: { ...DEFAULT_SNAP_SETTINGS },
  isDragging: false,
  isResizing: false,
  showGrid: false,
  showSafeZone: true,
  canvasZoom: 1,

  setTheme: (theme) =>
    set((state) => {
      state.theme = theme;
      if (typeof window !== 'undefined') {
        localStorage.setItem('theme', theme);
        document.documentElement.classList.toggle('dark', theme === 'dark');
      }
    }),

  toggleTheme: () =>
    set((state) => {
      const newTheme = state.theme === 'light' ? 'dark' : 'light';
      state.theme = newTheme;
      if (typeof window !== 'undefined') {
        localStorage.setItem('theme', newTheme);
        document.documentElement.classList.toggle('dark', newTheme === 'dark');
      }
    }),

  setLanguage: (language) =>
    set((state) => {
      state.language = language;
      if (typeof window !== 'undefined') {
        localStorage.setItem('language', language);
      }
    }),

  setSnapSettings: (settings) =>
    set((state) => {
      Object.assign(state.snapSettings, settings);
    }),

  setIsDragging: (dragging) =>
    set((state) => {
      state.isDragging = dragging;
    }),

  setIsResizing: (resizing) =>
    set((state) => {
      state.isResizing = resizing;
    }),

  setShowGrid: (show) =>
    set((state) => {
      state.showGrid = show;
    }),

  setShowSafeZone: (show) =>
    set((state) => {
      state.showSafeZone = show;
    }),

  setCanvasZoom: (zoom) =>
    set((state) => {
      state.canvasZoom = Math.max(0.5, Math.min(3, zoom));
    }),

  zoomIn: () =>
    set((state) => {
      state.canvasZoom = Math.min(3, state.canvasZoom * 1.2);
    }),

  zoomOut: () =>
    set((state) => {
      state.canvasZoom = Math.max(0.5, state.canvasZoom / 1.2);
    }),

  resetZoom: () =>
    set((state) => {
      state.canvasZoom = 1;
    }),
});
