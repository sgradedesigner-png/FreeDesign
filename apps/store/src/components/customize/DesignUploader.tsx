import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Upload, X } from 'lucide-react';

export type UploadedDesignAsset = {
  id: string;
  originalUrl: string;
  thumbnailUrl: string | null;
  widthPx: number | null;
  heightPx: number | null;
  isValid: boolean;
  fileName: string;
};

type DesignUploaderProps = {
  asset: UploadedDesignAsset | null;
  uploading: boolean;
  error?: string | null;
  onFileSelected: (file: File) => void;
  onClear: () => void;
};

export default function DesignUploader({
  asset,
  uploading,
  error,
  onFileSelected,
  onClear,
}: DesignUploaderProps) {
  return (
    <div className="space-y-3 rounded-xl border border-border p-4">
      <div>
        <h3 className="font-semibold">Design Upload</h3>
        <p className="text-sm text-muted-foreground">
          Upload PNG, JPG, WEBP, or SVG (max 20MB)
        </p>
      </div>

      {!asset ? (
        <div className="space-y-3">
          <Input
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
            disabled={uploading}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              onFileSelected(file);
            }}
          />
          {uploading ? (
            <div className="flex items-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Uploading design...
            </div>
          ) : (
            <div className="flex items-center text-xs text-muted-foreground">
              <Upload className="mr-2 h-3.5 w-3.5" />
              Recommended: 300 DPI and at least 800x800 pixels
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-border/80 bg-muted/30 p-3">
          <div className="flex items-start gap-3">
            <img
              src={asset.thumbnailUrl || asset.originalUrl}
              alt={asset.fileName}
              className="h-20 w-20 rounded-md object-cover"
            />
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium">{asset.fileName}</p>
              <p className="text-xs text-muted-foreground">
                {asset.widthPx && asset.heightPx
                  ? `${asset.widthPx}x${asset.heightPx}px`
                  : 'Dimensions unavailable'}
              </p>
              <p className={`text-xs ${asset.isValid ? 'text-emerald-600' : 'text-amber-600'}`}>
                {asset.isValid ? 'Quality check passed' : 'Low resolution warning'}
              </p>
            </div>
            <Button type="button" size="icon" variant="ghost" onClick={onClear}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

