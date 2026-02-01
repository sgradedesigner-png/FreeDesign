// src/stores/slices/exportSlice.ts
import type { StateCreator } from 'zustand';
import type { ZoneKey } from '../../types/zone';
import type { ConfiguratorStore } from '../types';

export interface ExportResult {
  zoneKey: ZoneKey;
  pngDataUrl: string;
  jsonData: object;
}

export interface ExportSlice {
  // State
  isExporting: boolean;
  exportProgress: number;
  exportResults: ExportResult[];

  // Actions
  setIsExporting: (exporting: boolean) => void;
  setExportProgress: (progress: number) => void;
  addExportResult: (result: ExportResult) => void;
  clearExportResults: () => void;
  startExport: () => void;
  finishExport: () => void;
}

export const createExportSlice: StateCreator<
  ConfiguratorStore,
  [['zustand/immer', never]],
  [],
  ExportSlice
> = (set) => ({
  isExporting: false,
  exportProgress: 0,
  exportResults: [],

  setIsExporting: (exporting) =>
    set((state) => {
      state.isExporting = exporting;
    }),

  setExportProgress: (progress) =>
    set((state) => {
      state.exportProgress = Math.max(0, Math.min(100, progress));
    }),

  addExportResult: (result) =>
    set((state) => {
      state.exportResults.push(result);
    }),

  clearExportResults: () =>
    set((state) => {
      state.exportResults = [];
    }),

  startExport: () =>
    set((state) => {
      state.isExporting = true;
      state.exportProgress = 0;
      state.exportResults = [];
    }),

  finishExport: () =>
    set((state) => {
      state.isExporting = false;
      state.exportProgress = 100;
    }),
});
