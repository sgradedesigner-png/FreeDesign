type MockupPreviewProps = {
  productName: string;
  baseImage: string | null;
  designThumbnail: string | null;
  selectedAreaLabels: string[];
};

export default function MockupPreview({
  productName,
  baseImage,
  designThumbnail,
  selectedAreaLabels,
}: MockupPreviewProps) {
  return (
    <div className="space-y-3 rounded-xl border border-border p-4">
      <div>
        <h3 className="font-semibold">Preview</h3>
        <p className="text-sm text-muted-foreground">
          Static mockup preview for selected areas
        </p>
      </div>

      <div className="relative overflow-hidden rounded-lg border border-border bg-muted/40">
        <img
          src={baseImage || 'https://placehold.co/800x1000/png?text=No+Mockup'}
          alt={productName}
          className="h-[360px] w-full object-cover"
        />

        {designThumbnail ? (
          <div className="absolute bottom-3 right-3 w-24 rounded-md border border-white/70 bg-white/90 p-1 shadow-lg">
            <img
              src={designThumbnail}
              alt="Design thumbnail"
              className="h-20 w-full rounded object-cover"
            />
          </div>
        ) : null}
      </div>

      {selectedAreaLabels.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {selectedAreaLabels.map((label) => (
            <span
              key={label}
              className="rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground"
            >
              {label}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

