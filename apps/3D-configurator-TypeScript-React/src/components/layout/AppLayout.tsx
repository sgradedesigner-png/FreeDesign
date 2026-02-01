// src/components/layout/AppLayout.tsx
import { ReactNode } from 'react';
import { Header } from './Header';

interface AppLayoutProps {
  /** Left panel - Tools/Settings */
  leftPanel?: ReactNode;
  /** Center panel - 3D Viewer */
  centerPanel?: ReactNode;
  /** Right panel - 2D Canvas Editor */
  rightPanel?: ReactNode;
}

export function AppLayout({
  leftPanel,
  centerPanel,
  rightPanel,
}: AppLayoutProps) {
  return (
    <div className="flex flex-col h-screen bg-background">
      <Header />

      <main className="flex-1 flex overflow-hidden">
        {/* Left Panel - Tools */}
        <aside className="w-64 border-r bg-card flex-shrink-0 overflow-y-auto hidden md:block">
          <div className="p-4">{leftPanel}</div>
        </aside>

        {/* Center Panel - 3D Viewer */}
        <section className="flex-1 relative min-w-0">
          {centerPanel}
        </section>

        {/* Right Panel - 2D Canvas */}
        <aside className="w-80 lg:w-96 border-l bg-card flex-shrink-0 overflow-y-auto hidden lg:block">
          <div className="p-4 h-full">{rightPanel}</div>
        </aside>
      </main>
    </div>
  );
}

/** Responsive variant with collapsible panels */
interface ResponsiveLayoutProps extends AppLayoutProps {
  showLeftPanel?: boolean;
  showRightPanel?: boolean;
}

export function ResponsiveAppLayout({
  leftPanel,
  centerPanel,
  rightPanel,
  showLeftPanel = true,
  showRightPanel = true,
}: ResponsiveLayoutProps) {
  return (
    <div className="flex flex-col h-screen bg-background">
      <Header />

      <main className="flex-1 flex overflow-hidden">
        {/* Left Panel - Tools */}
        {showLeftPanel && leftPanel && (
          <aside className="w-64 border-r bg-card flex-shrink-0 overflow-y-auto">
            <div className="p-4">{leftPanel}</div>
          </aside>
        )}

        {/* Center Panel - 3D Viewer */}
        <section className="flex-1 relative min-w-0">
          {centerPanel}
        </section>

        {/* Right Panel - 2D Canvas */}
        {showRightPanel && rightPanel && (
          <aside className="w-80 lg:w-96 border-l bg-card flex-shrink-0 overflow-y-auto">
            <div className="p-4 h-full">{rightPanel}</div>
          </aside>
        )}
      </main>
    </div>
  );
}

/** Mobile-first stacked layout */
export function MobileAppLayout({
  leftPanel,
  centerPanel,
  rightPanel,
}: AppLayoutProps) {
  return (
    <div className="flex flex-col h-screen bg-background">
      <Header />

      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Mobile: Stacked, Desktop: Side-by-side */}
        <section className="flex-1 lg:flex-[2] relative min-h-[300px]">
          {centerPanel}
        </section>

        <div className="flex flex-col lg:flex-row lg:w-auto">
          {leftPanel && (
            <aside className="lg:w-64 border-t lg:border-t-0 lg:border-l bg-card overflow-y-auto">
              <div className="p-4">{leftPanel}</div>
            </aside>
          )}

          {rightPanel && (
            <aside className="lg:w-80 border-t lg:border-t-0 lg:border-l bg-card overflow-y-auto flex-1 lg:flex-none">
              <div className="p-4 h-full">{rightPanel}</div>
            </aside>
          )}
        </div>
      </main>
    </div>
  );
}
