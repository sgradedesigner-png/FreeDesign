import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useId, useState } from 'react';
import { Loader2, Upload, X, Image as ImageIcon, ShieldCheck, CloudUpload } from 'lucide-react';

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
  const inputId = useId();
  const [isDragActive, setIsDragActive] = useState(false);

  const handleFile = (file?: File) => {
    if (!file || uploading) return;
    onFileSelected(file);
  };

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div className="flex items-start gap-2">
        <div className="mt-0.5 rounded-md bg-primary/10 p-1.5 text-primary">
          <Upload className="h-4 w-4" />
        </div>
        <div>
          <h3 className="font-semibold leading-tight">Design Upload</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload PNG, JPG, WEBP, or SVG (max 20MB)
          </p>
        </div>
      </div>

      {!asset ? (
        <div
          className={`space-y-3 rounded-lg border border-dashed p-3 transition-colors ${
            isDragActive
              ? 'border-primary bg-primary/10'
              : 'border-border/70 bg-background/20'
          }`}
          onDragEnter={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (!uploading) setIsDragActive(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            event.stopPropagation();
            event.dataTransfer.dropEffect = 'copy';
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (event.currentTarget.contains(event.relatedTarget as Node)) return;
            setIsDragActive(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setIsDragActive(false);
            handleFile(event.dataTransfer.files?.[0]);
          }}
        >
          <input
            id={inputId}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
            disabled={uploading}
            className="hidden"
            onChange={(event) => handleFile(event.target.files?.[0])}
          />
          <label
            htmlFor={inputId}
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-border/60 px-4 py-4 text-center transition-colors ${
              uploading ? 'pointer-events-none opacity-60' : 'hover:border-primary/50 hover:bg-primary/5'
            }`}
          >
            <div className="rounded-full bg-primary/10 p-2 text-primary">
              <CloudUpload className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium text-foreground">
              Drag & drop your design here
            </p>
            <p className="text-xs text-muted-foreground">or click to browse files</p>
          </label>
          {uploading ? (
            <div className="flex items-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Uploading design...
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ImageIcon className="h-3.5 w-3.5" />
              <span>Recommended: 300 DPI and at least 800x800 pixels</span>
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
              <p className="text-sm font-medium break-all">{asset.fileName}</p>
              <p className="text-xs text-muted-foreground">
                {asset.widthPx && asset.heightPx
                  ? `${asset.widthPx}x${asset.heightPx}px`
                  : 'Dimensions unavailable'}
              </p>
              <div className="pt-1">
                {asset.isValid ? (
                  <Badge variant="secondary" className="gap-1 text-emerald-600">
                    <ShieldCheck className="h-3 w-3" />
                    Quality check passed
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-amber-600">
                    Low resolution warning
                  </Badge>
                )}
              </div>
            </div>
            <Button type="button" size="icon" variant="ghost" onClick={onClear} aria-label="Remove uploaded design">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
