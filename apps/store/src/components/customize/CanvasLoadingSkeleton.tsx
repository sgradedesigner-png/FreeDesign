interface Props {
  width: number;
  height: number;
}

export default function CanvasLoadingSkeleton({ width, height }: Props) {
  return (
    <div
      className="animate-pulse rounded-xl bg-muted"
      style={{ width, height }}
      role="status"
      aria-label="Loading garment preview…"
    />
  );
}
