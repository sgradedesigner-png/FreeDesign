// src/App.tsx
import { useEffect } from 'react';
import { AppLayout } from '@/components/layout';
import { ThreeCanvas } from '@/components/viewer3d';
import { UVCanvas, ZoomControls } from '@/components/editor2d';
import { ZoneTabs } from '@/components/zones';
import { UploadButton, ExportButton, PresetPlacements } from '@/components/tools';
import { useThemeEffect } from '@/hooks';

// Tools panel with zone tabs and upload
function ToolsPanel() {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium mb-2 text-muted-foreground">Zones</h3>
        <ZoneTabs orientation="vertical" />
      </div>
      <hr className="border-border" />
      <div>
        <h3 className="text-sm font-medium mb-2 text-muted-foreground">Artwork</h3>
        <UploadButton />
      </div>
      <hr className="border-border" />
      <PresetPlacements />
      <hr className="border-border" />
      <div>
        <h3 className="text-sm font-medium mb-2 text-muted-foreground">Export</h3>
        <ExportButton />
      </div>
    </div>
  );
}

// 2D Canvas Editor with zoom controls
function CanvasEditor() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-semibold text-lg">2D Editor</h2>
        <ZoomControls />
      </div>
      <div className="flex-1 bg-muted/30 rounded-lg overflow-hidden border border-border min-h-[300px]">
        <UVCanvas />
      </div>
    </div>
  );
}

export default function App() {
  // Apply theme on mount
  useThemeEffect();

  // Initialize theme class on mount
  useEffect(() => {
    const theme = localStorage.getItem('theme') || 'light';
    document.documentElement.classList.add(theme);
  }, []);

  return (
    <AppLayout
      leftPanel={<ToolsPanel />}
      centerPanel={
        <div className="flex flex-col h-full w-full">
          {/* Zone tabs for quick switching */}
          <div className="p-2 border-b border-border bg-card/50 backdrop-blur-sm flex-shrink-0">
            <ZoneTabs orientation="horizontal" className="justify-center" />
          </div>
          {/* 3D Viewer */}
          <div className="flex-1 relative min-h-0">
            <ThreeCanvas
              modelUrl="/assets/models/Tshirt/TShirt.glb"
              className="absolute inset-0"
            />
          </div>
        </div>
      }
      rightPanel={<CanvasEditor />}
    />
  );
}
