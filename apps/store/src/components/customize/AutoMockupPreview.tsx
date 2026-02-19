import { Loader2 } from 'lucide-react';

type AutoMockupPreviewProps = {
  previewUrl: string | null;
  fallbackUrl: string | null;
  loading: boolean;
  error?: string | null;
  activeAreaLabel?: string | null;
};

const PLACEHOLDER = 'https://placehold.co/800x1000/png?text=No+Mockup';

export default function AutoMockupPreview({
  previewUrl,
  fallbackUrl,
  loading,
  error,
  activeAreaLabel,
}: AutoMockupPreviewProps) {
  const imageSrc = previewUrl || fallbackUrl || PLACEHOLDER;

  return (
    <div className="space-y-3 rounded-xl border border-border p-4">
      <div>
        <h3 className="font-semibold">Auto Mockup Preview</h3>
        <p className="text-sm text-muted-foreground">
          Cloudinary overlay render {activeAreaLabel ? `for ${activeAreaLabel}` : ''}
        </p>
      </div>

      <div className="relative overflow-hidden rounded-lg border border-border bg-muted/40">
        <img
          src={imageSrc}
          alt="Auto generated mockup preview"
          className="aspect-[4/3] w-full bg-background object-contain"
        />

        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-background/70">
            <div className="flex items-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Rendering preview...
            </div>
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Preview updates automatically when placement changes.
        </p>
      )}
    </div>
  );
}
