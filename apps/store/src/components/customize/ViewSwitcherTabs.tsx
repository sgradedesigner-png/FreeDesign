import type { ViewName } from '@/types/garment';
import { cn } from '@/lib/utils';

const VIEW_DISPLAY_NAMES: Record<ViewName, string> = {
  front: 'Front',
  back: 'Back',
  left: 'Left Sleeve',
  right: 'Right Sleeve',
};

interface Props {
  availableViews: ViewName[];
  activeView: ViewName;
  onViewChange: (view: ViewName) => void;
  /** Optional per-view thumbnail data URLs from Stage.toDataURL() */
  viewThumbDataUrls?: Partial<Record<ViewName, string>>;
  /** Views that have a design placed (show indicator dot) */
  viewsWithDesign?: Set<ViewName>;
}

export default function ViewSwitcherTabs({
  availableViews,
  activeView,
  onViewChange,
  viewThumbDataUrls = {},
  viewsWithDesign = new Set(),
}: Props) {
  if (availableViews.length <= 1) return null;

  return (
    <div data-testid="view-switcher-tabs" className="flex gap-1 rounded-lg border border-border bg-muted/50 p-1">
      {availableViews.map((view) => {
        const isActive = view === activeView;
        const thumb = viewThumbDataUrls[view];
        const hasDesign = viewsWithDesign.has(view);

        return (
          <button
            key={view}
            type="button"
            data-testid={`view-tab-${view}`}
            onClick={() => onViewChange(view)}
            className={cn(
              'relative flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2',
              'text-sm font-medium transition-colors duration-200 ease-out',
              'outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
              isActive
                ? 'bg-background text-foreground ring-1 ring-border/70'
                : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'
            )}
          >
            {/* Thumbnail preview (shown once stage has exported) */}
            {thumb && (
              <img
                src={thumb}
                alt=""
                className="h-5 w-5 rounded-sm object-cover"
                aria-hidden
              />
            )}

            <span>{VIEW_DISPLAY_NAMES[view]}</span>

            {/* Green dot = view has a design placed */}
            {hasDesign && (
              <span
                className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-green-500"
                aria-label="Design placed"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
