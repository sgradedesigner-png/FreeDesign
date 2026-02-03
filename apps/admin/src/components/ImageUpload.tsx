import { useState, useCallback } from 'react';
import { Upload, X, Loader2, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';

type ImageUploadProps = {
  productId?: string;
  images: string[];
  onChange: (images: string[]) => void;
  maxImages?: number;
};

export function ImageUpload({
  productId,
  images,
  onChange,
  maxImages = 10,
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const uploadImage = async (file: File): Promise<string> => {
    console.log('[ImageUpload] ========== Starting Presigned Upload ==========');
    console.log('[ImageUpload] File details:', {
      name: file.name,
      type: file.type,
      size: file.size,
      lastModified: new Date(file.lastModified).toISOString(),
    });

    try {
      // Step 1: Request presigned URL from backend
      console.log('[ImageUpload] Step 1: Requesting presigned URL...');

      const presignedResponse = await api.post('/admin/upload/presigned-url', {
        filename: file.name,
        contentType: file.type,
        productId: productId,
      });

      console.log('[ImageUpload] ✅ Presigned URL received');
      console.log('[ImageUpload] Response:', presignedResponse.data);

      const { uploadUrl, publicUrl, key } = presignedResponse.data;

      // Step 2: Upload file directly to R2 using presigned URL
      console.log('[ImageUpload] Step 2: Uploading to R2...');
      console.log('[ImageUpload] Upload URL length:', uploadUrl.length);
      console.log('[ImageUpload] Public URL:', publicUrl);

      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error(`R2 upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`);
      }

      console.log('[ImageUpload] ✅ Upload to R2 successful!');
      console.log('[ImageUpload] Response status:', uploadResponse.status);
      console.log('[ImageUpload] Image URL:', publicUrl);

      return publicUrl;
    } catch (error: any) {
      console.error('[ImageUpload] ❌ Upload failed');
      console.error('[ImageUpload] Error type:', error.constructor?.name);
      console.error('[ImageUpload] Error message:', error.message);

      // Axios error details (for presigned URL request)
      if (error.response) {
        console.error('[ImageUpload] Backend error details:');
        console.error('[ImageUpload]   Status:', error.response.status);
        console.error('[ImageUpload]   Status Text:', error.response.statusText);
        console.error('[ImageUpload]   Data:', error.response.data);
      } else if (error.request) {
        console.error('[ImageUpload] No response from backend');
      }

      console.error('[ImageUpload] Full error:', error);

      throw error;
    }
  };

  const handleFiles = async (files: FileList | null) => {
    console.log('[ImageUpload] handleFiles called');
    console.log('[ImageUpload] Files received:', files?.length || 0);

    if (!files || files.length === 0) {
      console.log('[ImageUpload] No files to upload');
      return;
    }

    if (images.length >= maxImages) {
      console.warn('[ImageUpload] Max images limit reached:', maxImages);
      alert(`Maximum ${maxImages} images allowed`);
      return;
    }

    try {
      setUploading(true);
      console.log('[ImageUpload] Starting upload process...');
      console.log('[ImageUpload] Current images:', images.length);
      console.log('[ImageUpload] Max images:', maxImages);

      const newUrls: string[] = [];

      for (let i = 0; i < files.length; i++) {
        if (images.length + newUrls.length >= maxImages) {
          console.warn('[ImageUpload] Reached max images, stopping upload');
          break;
        }

        const file = files[i];
        console.log(`[ImageUpload] Processing file ${i + 1}/${files.length}:`, file.name);

        // Validate file type
        if (!file.type.startsWith('image/')) {
          console.error('[ImageUpload] Invalid file type:', file.type);
          alert(`${file.name} is not an image file`);
          continue;
        }

        // Validate file size (5MB)
        if (file.size > 5 * 1024 * 1024) {
          console.error('[ImageUpload] File too large:', file.size, 'bytes');
          alert(`${file.name} is too large (max 5MB)`);
          continue;
        }

        console.log('[ImageUpload] File validation passed, uploading...');
        const url = await uploadImage(file);
        console.log('[ImageUpload] Upload completed, URL:', url);
        newUrls.push(url);
      }

      console.log('[ImageUpload] All uploads completed');
      console.log('[ImageUpload] New URLs:', newUrls);

      onChange([...images, ...newUrls]);
      console.log('[ImageUpload] Images state updated');
    } catch (error: any) {
      console.error('[ImageUpload] ❌ Upload process failed');
      console.error('[ImageUpload] Error:', error);
      console.error('[ImageUpload] Error message:', error?.message);
      console.error('[ImageUpload] Error response:', error?.response?.data);

      // Show user-friendly error message
      const errorMessage = error?.response?.data?.message || error?.message || 'Failed to upload images';
      alert(`Upload failed: ${errorMessage}`);
    } finally {
      setUploading(false);
      console.log('[ImageUpload] Upload process finished');
    }
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [images, maxImages]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files);
    }
  };

  const removeImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    onChange(newImages);
  };

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <div
        className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragActive
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-primary/50'
        } ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          type="file"
          multiple
          accept="image/*"
          onChange={handleChange}
          disabled={uploading || images.length >= maxImages}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />

        <div className="flex flex-col items-center gap-2">
          {uploading ? (
            <>
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Uploading...</p>
            </>
          ) : (
            <>
              <Upload className="w-10 h-10 text-muted-foreground" />
              <p className="text-sm font-medium">
                Drag & drop images here, or click to select
              </p>
              <p className="text-xs text-muted-foreground">
                PNG, JPG, WebP up to 5MB ({images.length}/{maxImages})
              </p>
            </>
          )}
        </div>
      </div>

      {/* Image Grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {images.map((url, index) => (
            <div
              key={index}
              className="relative group aspect-square rounded-lg border bg-muted overflow-hidden"
            >
              <img
                src={url}
                alt={`Product ${index + 1}`}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => removeImage(index)}
                  disabled={uploading}
                >
                  <X className="w-4 h-4 mr-1" />
                  Remove
                </Button>
              </div>
              {index === 0 && (
                <div className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs px-2 py-1 rounded">
                  Main
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {images.length === 0 && !uploading && (
        <div className="text-center p-8 border border-dashed rounded-lg">
          <ImageIcon className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            No images uploaded yet
          </p>
        </div>
      )}
    </div>
  );
}
