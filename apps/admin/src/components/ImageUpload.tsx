import { useState, useCallback } from 'react';
import { Upload, X, Loader2, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { logger } from '@/lib/logger';

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
    logger.debug('[ImageUpload] ========== Starting Presigned Upload ==========');
    logger.debug('[ImageUpload] File details:', {
      name: file.name,
      type: file.type,
      size: file.size,
      lastModified: new Date(file.lastModified).toISOString(),
    });

    try {
      // Step 1: Request presigned URL from backend
      logger.debug('[ImageUpload] Step 1: Requesting presigned URL...');

      const presignedResponse = await api.post('/admin/upload/presigned-url', {
        filename: file.name,
        contentType: file.type,
        productId: productId,
      });

      logger.debug('[ImageUpload] ✅ Presigned URL received');
      logger.debug('[ImageUpload] Response:', presignedResponse.data);

      const { uploadUrl, publicUrl, timestamp, signature, apiKey, folder, publicId } = presignedResponse.data;

      // Step 2: Upload file directly to Cloudinary using signed params
      logger.debug('[ImageUpload] Step 2: Uploading to Cloudinary...');
      logger.debug('[ImageUpload] Upload URL:', uploadUrl);
      logger.debug('[ImageUpload] Public URL:', publicUrl);
      logger.debug('[ImageUpload] Folder:', folder);
      logger.debug('[ImageUpload] Public ID:', publicId);

      // Build FormData with file and signed params
      const formData = new FormData();
      formData.append('file', file);
      formData.append('timestamp', timestamp.toString());
      formData.append('signature', signature);
      formData.append('api_key', apiKey);
      formData.append('folder', folder);
      if (publicId) {
        formData.append('public_id', publicId);
      }

      logger.debug('[ImageUpload] FormData prepared with signed params');

      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        body: formData,
        // Don't set Content-Type header - browser will set it with boundary for FormData
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        logger.error('[ImageUpload] Cloudinary error response:', errorText);
        throw new Error(`Cloudinary upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`);
      }

      logger.debug('[ImageUpload] ✅ Upload to Cloudinary successful!');
      logger.debug('[ImageUpload] Response status:', uploadResponse.status);
      logger.debug('[ImageUpload] Image URL:', publicUrl);

      return publicUrl;
    } catch (error: any) {
      logger.error('[ImageUpload] ❌ Upload failed');
      logger.error('[ImageUpload] Error type:', error.constructor?.name);
      logger.error('[ImageUpload] Error message:', error.message);

      // Axios error details (for presigned URL request)
      if (error.response) {
        logger.error('[ImageUpload] Backend error details:');
        logger.error('[ImageUpload]   Status:', error.response.status);
        logger.error('[ImageUpload]   Status Text:', error.response.statusText);
        logger.error('[ImageUpload]   Data:', error.response.data);
      } else if (error.request) {
        logger.error('[ImageUpload] No response from backend');
      }

      logger.error('[ImageUpload] Full error:', error);

      throw error;
    }
  };

  const handleFiles = async (files: FileList | null) => {
    logger.debug('[ImageUpload] handleFiles called');
    logger.debug('[ImageUpload] Files received:', files?.length || 0);

    if (!files || files.length === 0) {
      logger.debug('[ImageUpload] No files to upload');
      return;
    }

    if (images.length >= maxImages) {
      logger.warn('[ImageUpload] Max images limit reached:', maxImages);
      alert(`Maximum ${maxImages} images allowed`);
      return;
    }

    try {
      setUploading(true);
      logger.debug('[ImageUpload] Starting upload process...');
      logger.debug('[ImageUpload] Current images:', images.length);
      logger.debug('[ImageUpload] Max images:', maxImages);

      const newUrls: string[] = [];

      for (let i = 0; i < files.length; i++) {
        if (images.length + newUrls.length >= maxImages) {
          logger.warn('[ImageUpload] Reached max images, stopping upload');
          break;
        }

        const file = files[i];
        logger.debug(`[ImageUpload] Processing file ${i + 1}/${files.length}:`, file.name);

        // Validate file type
        if (!file.type.startsWith('image/')) {
          logger.error('[ImageUpload] Invalid file type:', file.type);
          alert(`${file.name} is not an image file`);
          continue;
        }

        // Validate file size (5MB)
        if (file.size > 5 * 1024 * 1024) {
          logger.error('[ImageUpload] File too large:', file.size, 'bytes');
          alert(`${file.name} is too large (max 5MB)`);
          continue;
        }

        logger.debug('[ImageUpload] File validation passed, uploading...');
        const url = await uploadImage(file);
        logger.debug('[ImageUpload] Upload completed, URL:', url);
        newUrls.push(url);
      }

      logger.debug('[ImageUpload] All uploads completed');
      logger.debug('[ImageUpload] New URLs:', newUrls);

      onChange([...images, ...newUrls]);
      logger.debug('[ImageUpload] Images state updated');
    } catch (error: any) {
      logger.error('[ImageUpload] ❌ Upload process failed');
      logger.error('[ImageUpload] Error:', error);
      logger.error('[ImageUpload] Error message:', error?.message);
      logger.error('[ImageUpload] Error response:', error?.response?.data);

      // Show user-friendly error message
      const errorMessage = error?.response?.data?.message || error?.message || 'Failed to upload images';
      alert(`Upload failed: ${errorMessage}`);
    } finally {
      setUploading(false);
      logger.debug('[ImageUpload] Upload process finished');
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
