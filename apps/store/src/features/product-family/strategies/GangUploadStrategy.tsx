import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Star, Heart, Share2, ShoppingCart, Upload, FileImage, LogIn, Loader2 } from 'lucide-react';
import type { ProductStrategy, ProductStrategyProps } from '../types';
import { useCart } from '../../../context/CartContext';
import { useWishlist } from '../../../context/WishlistContext';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button } from '../../../components/ui/button';
import {
  GangSheetLengthSelector,
  type GangSheetLength,
} from '../../../components/customize/GangSheetLengthSelector';
import {
  UploadStatusChip,
  type UploadStatus,
} from '../../../components/customize/UploadStatusChip';

interface UploadAsset {
  id: string;
  cloudinaryUrl: string;
  fileName: string;
  validationStatus: UploadStatus;
  errorMessage?: string;
}

/**
 * Gang Upload Product Info Component
 * Handles DTF gang sheet products where users upload ready-to-print files
 */
function GangUploadProductInfo({ product, selectedVariant }: ProductStrategyProps) {
  const { language } = useTheme();
  const { addItem } = useCart();
  const { addToWishlist, isInWishlist } = useWishlist();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // State
  const [quantity, setQuantity] = useState(1);
  const [gangSheetLength, setGangSheetLength] = useState<GangSheetLength>(50);
  const [uploadAsset, setUploadAsset] = useState<UploadAsset | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const apiBase = import.meta.env.VITE_API_URL || '';

  // Calculate price based on gang sheet length
  // Longer sheets are more cost-effective per cm
  const calculatePrice = (basePrice: number, length: GangSheetLength): number => {
    const lengthMultipliers: Record<GangSheetLength, number> = {
      30: 1.0, // Base price for 30cm
      50: 1.5, // 50cm is 1.5x the price
      70: 2.0, // 70cm is 2x the price
      100: 2.5, // 100cm is 2.5x the price (best value per cm)
    };
    return basePrice * lengthMultipliers[length];
  };

  const unitPrice = selectedVariant
    ? calculatePrice(selectedVariant.price, gangSheetLength)
    : 0;
  const subtotal = unitPrice * quantity;

  // Handle file upload
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      // Step 1: Request signed upload params
      const { data: { session } } = await supabase.auth.getSession();
      const authHeader = session ? { Authorization: `Bearer ${session.access_token}` } : {};

      const signResponse = await fetch(`${apiBase}/api/uploads/sign-v2`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader,
        },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          fileSizeBytes: file.size,
          uploadFamily: 'gang_upload',
        }),
      });

      if (!signResponse.ok) {
        const error = await signResponse.json();
        throw new Error(error.error || error.message || 'Failed to get upload signature');
      }

      const signData = await signResponse.json();
      const { intentId, uploadUrl, fields } = signData;

      // Step 2: Upload to Cloudinary
      const formData = new FormData();
      formData.append('file', file);
      formData.append('signature', fields.signature);
      formData.append('timestamp', fields.timestamp.toString());
      formData.append('api_key', fields.apiKey);
      formData.append('folder', fields.folder);
      formData.append('public_id', fields.publicId);

      const cloudinaryResponse = await fetch(uploadUrl, {
        method: 'POST',
        body: formData,
      });

      if (!cloudinaryResponse.ok) {
        throw new Error('Failed to upload to Cloudinary');
      }

      const cloudinaryData = await cloudinaryResponse.json();

      // Step 3: Complete upload and create validation job
      const completeResponse = await fetch(`${apiBase}/api/uploads/complete-v2`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader,
        },
        body: JSON.stringify({
          intentId,
          cloudinaryPublicId: cloudinaryData.public_id,
          uploadFamily: 'gang_upload',
        }),
      });

      if (!completeResponse.ok) {
        const error = await completeResponse.json();
        throw new Error(error.error || error.message || 'Failed to complete upload');
      }

      const { uploadAsset: asset } = await completeResponse.json();

      setUploadAsset({
        id: asset.id,
        cloudinaryUrl: asset.cloudinaryUrl,
        fileName: asset.fileName,
        validationStatus: asset.validationStatus.toLowerCase() as UploadStatus,
      });

      // Poll for validation status
      pollValidationStatus(asset.id);
    } catch (error) {
      console.error('Upload error:', error);
      setUploadError(
        error instanceof Error ? error.message : 'Failed to upload file'
      );
    } finally {
      setIsUploading(false);
    }
  };

  // Poll validation status every 3 seconds
  const pollValidationStatus = async (assetId: string) => {
    const maxAttempts = 20; // 1 minute max
    let attempts = 0;

    const poll = setInterval(async () => {
      attempts++;

      try {
        const { data: { session: pollSession } } = await supabase.auth.getSession();
        const pollAuthHeader = pollSession
          ? { Authorization: `Bearer ${pollSession.access_token}` }
          : {};
        const response = await fetch(`${apiBase}/api/uploads/assets/${assetId}`, {
          headers: pollAuthHeader,
        });

        if (!response.ok) {
          clearInterval(poll);
          return;
        }

        const data = await response.json();
        const status = data.validationStatus.toLowerCase() as UploadStatus;

        setUploadAsset((prev) =>
          prev
            ? {
                ...prev,
                validationStatus: status,
                errorMessage: data.metadata?.validationError?.message,
              }
            : null
        );

        // Stop polling if validation is complete
        if (status === 'passed' || status === 'failed' || status === 'dead_letter') {
          clearInterval(poll);
        }

        // Stop polling after max attempts
        if (attempts >= maxAttempts) {
          clearInterval(poll);
        }
      } catch (error) {
        console.error('Polling error:', error);
        clearInterval(poll);
      }
    }, 3000);
  };

  // Handle add to cart
  const handleAddToCart = () => {
    if (!selectedVariant || !uploadAsset || uploadAsset.validationStatus !== 'passed') {
      return;
    }

    addItem({
      productId: product.id,
      productName: product.name,
      productSlug: product.slug,
      productCategory: product.category,
      variantId: selectedVariant.id,
      variantName: selectedVariant.name,
      variantPrice: unitPrice,
      variantOriginalPrice: null,
      variantImage: selectedVariant.imagePath,
      variantSku: selectedVariant.sku,
      quantity,
      size: null,
      isCustomized: true,
      optionPayload: {
        gangSheetLength,
        uploadAssetId: uploadAsset.id,
        uploadFileName: uploadAsset.fileName,
        uploadUrl: uploadAsset.cloudinaryUrl,
      },
    });
  };

  // Handle add to wishlist
  const handleAddToWishlist = () => {
    if (!selectedVariant) return;
    addToWishlist(product);
  };

  const inWishlist = isInWishlist(product.id);
  const canAddToCart =
    selectedVariant && uploadAsset && uploadAsset.validationStatus === 'passed';

  return (
    <div className="space-y-6">
      {/* Product Title */}
      <div>
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-2">
          {product.name}
        </h1>
        {product.subtitle && (
          <p className="text-lg text-muted-foreground">{product.subtitle}</p>
        )}
      </div>

      {/* Rating */}
      {product.rating > 0 && (
        <div className="flex items-center gap-2">
          <div className="flex items-center">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                size={18}
                className={
                  i < Math.floor(product.rating)
                    ? 'fill-primary text-primary'
                    : 'text-muted'
                }
              />
            ))}
          </div>
          <span className="text-sm text-muted-foreground">
            {product.rating.toFixed(1)} ({product.reviews}{' '}
            {language === 'mn' ? 'үнэлгээ' : 'reviews'})
          </span>
        </div>
      )}

      {/* Short Description */}
      {product.shortDescription && (
        <p className="text-foreground leading-relaxed">
          {product.shortDescription}
        </p>
      )}

      {/* Gang Sheet Length Selector */}
      <GangSheetLengthSelector
        selectedLength={gangSheetLength}
        onLengthChange={setGangSheetLength}
        disabled={isUploading}
      />

      {/* Upload Panel */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          {language === 'mn' ? 'Gang Sheet Upload' : 'Upload Gang Sheet'}
        </label>

        {!uploadAsset ? (
          !user ? (
            /* Not logged in — show login prompt */
            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
              <LogIn size={40} className="mx-auto text-muted-foreground mb-3" />
              <p className="text-sm font-medium text-foreground mb-1">
                {language === 'mn'
                  ? 'Файл upload хийхийн өмнө нэвтрэх шаардлагатай'
                  : 'Sign in required to upload files'}
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                {language === 'mn'
                  ? 'Таны файл таны акканттай холбогдон хадгалагдана'
                  : 'Your file will be saved and linked to your account'}
              </p>
              <Button
                size="sm"
                onClick={() =>
                  navigate(`/login?returnTo=${encodeURIComponent(location.pathname)}`)
                }
              >
                <LogIn size={16} className="mr-2" />
                {language === 'mn' ? 'Нэвтрэх' : 'Sign In'}
              </Button>
            </div>
          ) : isUploading ? (
            /* Uploading — loading animation */
            <div className="border-2 border-primary/40 border-dashed rounded-lg p-6 text-center bg-primary/5">
              <Loader2
                size={40}
                className="mx-auto text-primary mb-3 animate-spin"
              />
              <p className="text-sm font-semibold text-foreground mb-1">
                {language === 'mn' ? 'Файл upload хийж байна...' : 'Uploading your file...'}
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                {language === 'mn'
                  ? 'Хуудсыг хаахгүй байна уу'
                  : 'Please do not close this page'}
              </p>
              {/* Indeterminate progress bar */}
              <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full animate-upload-progress" />
              </div>
            </div>
          ) : (
            /* Idle — file picker */
            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
              <input
                type="file"
                id="gang-sheet-upload"
                data-testid="gang-sheet-upload-input"
                accept="image/png,image/jpeg,image/jpg,application/pdf"
                onChange={handleFileSelect}
                className="hidden"
              />
              <label htmlFor="gang-sheet-upload" className="cursor-pointer">
                <Upload size={48} className="mx-auto text-muted-foreground mb-3" />
                <p className="text-sm font-medium text-foreground mb-1">
                  {language === 'mn' ? 'Файл upload хийх' : 'Click to upload or drag and drop'}
                </p>
                <p className="text-xs text-muted-foreground">
                  PNG, JPEG, PDF (max 50MB) • Min 1200px wide • Min 150 DPI
                </p>
              </label>
            </div>
          )
        ) : (
          <div className="border border-border rounded-lg p-4">
            <div className="flex items-start gap-3">
              <FileImage size={40} className="text-primary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {uploadAsset.fileName}
                </p>
                <UploadStatusChip
                  status={uploadAsset.validationStatus}
                  errorMessage={uploadAsset.errorMessage}
                  className="mt-2"
                />
              </div>
              <button
                onClick={() => setUploadAsset(null)}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                {language === 'mn' ? 'Устгах' : 'Remove'}
              </button>
            </div>
          </div>
        )}

        {uploadError && (
          <p className="text-sm text-red-600 dark:text-red-400 mt-2">
            {uploadError}
          </p>
        )}
      </div>

      {/* Quantity Selector */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          {language === 'mn' ? 'Тоо ширхэг' : 'Quantity'}
        </label>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setQuantity(Math.max(1, quantity - 1))}
            className="w-10 h-10 flex items-center justify-center border border-border rounded-lg hover:bg-muted transition-colors text-foreground font-semibold"
          >
            −
          </button>
          <input
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-20 h-10 text-center border border-border rounded-lg bg-background text-foreground font-semibold focus:ring-2 focus:ring-primary outline-none"
          />
          <button
            onClick={() => setQuantity(quantity + 1)}
            className="w-10 h-10 flex items-center justify-center border border-border rounded-lg hover:bg-muted transition-colors text-foreground font-semibold"
          >
            +
          </button>
        </div>
      </div>

      {/* Price Summary */}
      <div className="bg-muted/30 border border-border rounded-lg p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">
            {language === 'mn' ? 'Нэгжийн үнэ' : 'Unit Price'} ({gangSheetLength}cm):
          </span>
          <span className="font-medium text-foreground">
            ₮{unitPrice.toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between text-lg font-bold pt-2 border-t border-border">
          <span className="text-foreground">
            {language === 'mn' ? 'Нийт' : 'Subtotal'}:
          </span>
          <span className="text-primary">₮{subtotal.toLocaleString()}</span>
        </div>
      </div>

      {/* Upload Requirement Notice */}
      {!canAddToCart && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <p className="text-sm text-yellow-800 dark:text-yellow-300">
            {language === 'mn'
              ? '⚠️ Сагслахын өмнө gang sheet upload хийж, validation амжилттай болгох шаардлагатай.'
              : '⚠️ Please upload your gang sheet and wait for validation before adding to cart.'}
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="space-y-3">
        <Button
          onClick={handleAddToCart}
          className="w-full h-12 text-base font-semibold"
          disabled={!canAddToCart}
          data-testid="gang-upload-add-to-cart"
        >
          <ShoppingCart size={20} className="mr-2" />
          {language === 'mn' ? 'Сагслах' : 'Add to Cart'}
        </Button>

        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            onClick={handleAddToWishlist}
            className="h-10"
            disabled={!selectedVariant}
          >
            <Heart
              size={18}
              className={`mr-2 ${inWishlist ? 'fill-red-500 text-red-500' : ''}`}
            />
            {language === 'mn' ? 'Хүслийн жагсаалт' : 'Wishlist'}
          </Button>
          <Button variant="outline" className="h-10">
            <Share2 size={18} className="mr-2" />
            {language === 'mn' ? 'Хуваалцах' : 'Share'}
          </Button>
        </div>
      </div>

      {/* Features/Benefits */}
      {product.features && product.features.length > 0 && (
        <div className="border-t border-border pt-6">
          <h3 className="font-semibold text-foreground mb-3">
            {language === 'mn' ? 'Онцлог' : 'Features'}
          </h3>
          <ul className="space-y-2">
            {product.features.map((feature, index) => (
              <li key={index} className="flex items-start gap-2 text-sm">
                <span className="text-primary mt-1">•</span>
                <span className="text-foreground">{feature}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Gang Upload Strategy Implementation
 */
export const GangUploadStrategy: ProductStrategy = {
  renderProductInfo: (props) => <GangUploadProductInfo {...props} />,

  getGalleryImages: ({ product, selectedVariant }) => {
    if (selectedVariant) {
      if (selectedVariant.galleryPaths?.length) {
        return selectedVariant.galleryPaths;
      }
      if (selectedVariant.imagePath) {
        return [selectedVariant.imagePath];
      }
    }

    if (product.mockupImagePath) {
      return [product.mockupImagePath];
    }
    if (product.gallery_paths?.length) {
      return product.gallery_paths;
    }
    if (product.image_path) {
      return [product.image_path];
    }

    return [];
  },
};
