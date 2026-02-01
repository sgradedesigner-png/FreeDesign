# 3D T-Shirt Configurator - E-Commerce Integration Handoff

## Project Overview

This is a **React + Three.js** based 3D T-shirt configurator that allows users to:
- Upload custom artwork/images
- Place artwork on different zones (Front, Back, Left Arm, Right Arm)
- Adjust position, size, and rotation
- Preview in real-time 3D
- Export high-resolution print files + metadata

---

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **3D Engine**: Three.js
- **State Management**: Zustand (with Immer)
- **UI**: Shadcn/ui + TailwindCSS
- **Styling**: Dark/Light theme support
- **i18n**: English + Mongolian

---

## Key Integration Points

### 1. Export Data Structure

When user clicks "Export", the system generates an `ExportPackage`:

```typescript
interface ExportPackage {
  id: string;                    // Unique export ID (e.g., "exp_m5xyz_abc123")
  version: string;               // "1.0.0"
  createdAt: string;             // ISO timestamp
  product: {
    type: 'tshirt' | 'hoodie' | 'cap';
    name: string;
    color: string;               // Hex color (e.g., "#ffffff")
    size?: string;               // Optional size (S, M, L, XL)
  };
  zones: ZoneExportData[];       // Array of zone designs
  settings: {
    dpi: number;                 // Default: 300
    templatePx: number;          // Default: 4096
  };
  summary: {
    totalZonesWithDesign: number;
    zoneKeys: ZoneKey[];         // e.g., ["front", "back"]
  };
}

interface ZoneExportData {
  zoneKey: 'front' | 'back' | 'left_arm' | 'right_arm';
  zoneName: string;              // Display name
  zoneSizeCM: {
    width: number;               // Zone width in cm
    height: number;              // Zone height in cm
  };
  originalImageDataUrl: string;  // Base64 PNG of original uploaded image
  originalImageSize: {
    width: number;
    height: number;
  };
  templatePngDataUrl: string;    // Base64 PNG of rendered template (4096px)
  templateSizePx: {
    width: number;
    height: number;
  };
  placementUV: {
    u: number;                   // Horizontal position (0-1)
    v: number;                   // Vertical position (0-1)
    uScale: number;              // Horizontal scale
    vScale: number;              // Vertical scale
    rotationRad: number;         // Rotation in radians
  };
  placementCM: {
    x_cm: number;                // X position from left edge
    y_cm: number;                // Y position from top edge
    width_cm: number;            // Actual width in cm
    height_cm: number;           // Actual height in cm
    rotation_deg: number;        // Rotation in degrees
  };
}
```

### 2. Zone Dimensions (Print Areas)

```typescript
// T-Shirt print zone sizes in centimeters
const ZONE_SIZES = {
  tshirt: {
    front:     { width: 30, height: 40 },
    back:      { width: 30, height: 40 },
    left_arm:  { width: 10, height: 12 },
    right_arm: { width: 10, height: 12 },
  }
};
```

---

## Supabase Integration

### Recommended Database Schema

```sql
-- Orders table
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'pending',
  total_price DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Design configurations table
CREATE TABLE design_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id),
  export_id TEXT NOT NULL,              -- From ExportPackage.id
  product_type TEXT NOT NULL,
  product_color TEXT NOT NULL,
  product_size TEXT,
  settings JSONB,                       -- { dpi, templatePx }
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Zone designs table
CREATE TABLE zone_designs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  design_config_id UUID REFERENCES design_configs(id),
  zone_key TEXT NOT NULL,               -- 'front', 'back', etc.
  zone_name TEXT NOT NULL,
  zone_size_cm JSONB NOT NULL,          -- { width, height }
  placement_uv JSONB NOT NULL,          -- { u, v, uScale, vScale, rotationRad }
  placement_cm JSONB NOT NULL,          -- { x_cm, y_cm, width_cm, height_cm, rotation_deg }
  original_image_path TEXT,             -- Supabase storage path
  template_png_path TEXT,               -- Supabase storage path
  original_image_size JSONB,            -- { width, height }
  template_size_px JSONB,               -- { width, height }
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Storage Buckets

```
supabase-storage/
├── design-originals/          # Original uploaded images
│   └── {export_id}/
│       ├── front_original.png
│       ├── back_original.png
│       └── ...
├── design-templates/          # High-res print templates
│   └── {export_id}/
│       ├── front_template.png
│       ├── back_template.png
│       └── ...
└── design-previews/           # 3D preview screenshots (optional)
    └── {export_id}/
        └── preview.png
```

### Helper Functions (Already Provided)

```typescript
// Located in: src/services/exportService.ts

// Prepare data for Supabase upload (separates files from metadata)
import { prepareForSupabase, dataUrlToBlob } from '@/services/exportService';

const { metadata, files } = prepareForSupabase(exportPackage);

// metadata: JSON data without base64 images (ready for DB insert)
// files: Array of { key, dataUrl, filename } for storage upload

// Convert data URL to Blob for file upload
const blob = dataUrlToBlob(file.dataUrl);
await supabase.storage.from('bucket').upload(file.filename, blob);
```

---

## E-Commerce Integration Steps

### Step 1: Embed Configurator

```html
<!-- Option A: iframe embed -->
<iframe
  src="https://your-configurator-url.com"
  width="100%"
  height="800px"
  frameborder="0"
></iframe>

<!-- Option B: Direct React component import -->
import App from '@3d-configurator/App';
```

### Step 2: Capture Export Data

Modify the ExportButton to send data to your backend:

```typescript
// In src/components/tools/ExportButton.tsx

const handleExport = async () => {
  const exportPackage = await buildExportPackage(zoneDrafts, baseColor);

  // Option 1: Send to parent window (if iframe)
  window.parent.postMessage({
    type: 'DESIGN_EXPORT',
    payload: exportPackage
  }, '*');

  // Option 2: Send to your API
  await fetch('/api/designs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(exportPackage)
  });

  // Option 3: Use Supabase directly
  const { metadata, files } = prepareForSupabase(exportPackage);
  // Upload files and save metadata...
};
```

### Step 3: Backend API Example (Node.js + Supabase)

```typescript
// server/api/designs.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

export async function saveDesign(exportPackage: ExportPackage, userId: string) {
  const { metadata, files } = prepareForSupabase(exportPackage);

  // 1. Upload files to storage
  for (const file of files) {
    const blob = dataUrlToBlob(file.dataUrl);
    await supabase.storage
      .from('designs')
      .upload(file.filename, blob, { contentType: 'image/png' });
  }

  // 2. Create order
  const { data: order } = await supabase
    .from('orders')
    .insert({ user_id: userId, status: 'pending' })
    .select()
    .single();

  // 3. Save design config
  const { data: config } = await supabase
    .from('design_configs')
    .insert({
      order_id: order.id,
      export_id: metadata.id,
      product_type: metadata.product.type,
      product_color: metadata.product.color,
      product_size: metadata.product.size,
      settings: metadata.settings,
    })
    .select()
    .single();

  // 4. Save zone designs
  for (const zone of metadata.zones) {
    await supabase.from('zone_designs').insert({
      design_config_id: config.id,
      zone_key: zone.zoneKey,
      zone_name: zone.zoneName,
      zone_size_cm: zone.zoneSizeCM,
      placement_uv: zone.placementUV,
      placement_cm: zone.placementCM,
      original_image_path: zone.originalImagePath,
      template_png_path: zone.templatePngPath,
      original_image_size: zone.originalImageSize,
      template_size_px: zone.templateSizePx,
    });
  }

  return { orderId: order.id, exportId: metadata.id };
}
```

---

## Key Files Reference

```
src/
├── services/
│   └── exportService.ts        # Export logic, Supabase helpers
├── types/
│   └── export.ts               # TypeScript interfaces
├── stores/
│   └── useConfiguratorStore.ts # Zustand state management
├── components/
│   ├── tools/
│   │   ├── ExportButton.tsx    # Export trigger
│   │   ├── UploadButton.tsx    # Image upload
│   │   └── PresetPlacements.tsx # Quick placement buttons
│   ├── viewer3d/
│   │   ├── ThreeCanvas.tsx     # 3D viewer
│   │   └── useMultiDecalSystem.ts # Multi-zone decals
│   └── editor2d/
│       └── UVCanvas.tsx        # 2D editor
├── config/
│   ├── printZones.ts           # Zone dimensions (cm)
│   ├── placementPresets.ts     # Preset placements
│   └── constants.ts            # DPI, template size
└── App.tsx                     # Main application
```

---

## Environment Variables (For Production)

```env
# .env.local
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_URL=https://your-api.com
```

---

## Print Production Notes

### DPI and Resolution
- Default export: **300 DPI** at **4096px** template width
- Front/Back zones: 30cm × 40cm = ~3543px × 4724px at 300 DPI
- Arm zones: 10cm × 12cm = ~1181px × 1417px at 300 DPI

### File Formats
- **Template PNG**: Transparent background, ready for print overlay
- **Original PNG**: Full resolution uploaded image
- **JSON Metadata**: Exact placement coordinates in cm

### Coordinate System
- `placementCM.x_cm`: Distance from LEFT edge to image LEFT edge
- `placementCM.y_cm`: Distance from TOP edge to image TOP edge
- `placementCM.rotation_deg`: Clockwise rotation in degrees

### Arm Zone Rotation Correction (Important!)

The T-shirt model's sleeves are angled, so artwork placed on arm zones requires rotation correction to appear upright on the 3D model.

**How it works:**

1. **Zone Detection** (`src/three/zones/zoneDetector.ts`):
   - Each zone has a `correctionRad` value
   - Front/Back zones: `correctionRad = 0` (no correction needed)
   - Left Arm zone: `correctionRad = +25°` (0.436 rad)
   - Right Arm zone: `correctionRad = -25°` (−0.436 rad)

2. **Initial Placement** (`src/stores/slices/artworkSlice.ts`):
   - When image is uploaded/placed, `rotationRad = -correctionRad` is automatically applied
   - This makes the artwork appear upright on the angled 3D sleeve

3. **2D vs 3D Display**:
   - **2D Canvas**: Does NOT display rotation - artwork always appears straight/upright for easier editing
   - **3D View**: Applies full `rotationRad` to render artwork correctly on angled sleeves

4. **Export Data**:
   - `placementUV.rotationRad` contains the full rotation (including correction)
   - `placementCM.rotation_deg` contains the same in degrees
   - Print production should use these values as-is

**Files involved:**
- `src/three/zones/zoneDetector.ts` - defines `correctionRad` per zone
- `src/stores/slices/artworkSlice.ts` - applies initial rotation in `centerAndFit()` and `placeAtUV()`
- `src/components/editor2d/useUVEditor.ts` - 2D drawing (rotation disabled)
- `src/components/editor2d/OverlayBox.tsx` - resize handles (rotation disabled)
- `src/components/viewer3d/useMultiDecalSystem.ts` - 3D decal rendering (rotation applied)

---

## Quick Start for Integration

1. **Clone the configurator** to your project
2. **Build**: `npm run build` → outputs to `dist/`
3. **Deploy** the `dist/` folder to your hosting
4. **Embed** via iframe or import as React component
5. **Listen** for `DESIGN_EXPORT` postMessage events
6. **Save** to your Supabase database using the schema above
7. **Process** orders with the stored design data

---

## Contact & Support

For questions about the configurator internals, refer to:
- `public/MigrationPlan.md` - Full technical architecture
- `src/types/` - All TypeScript interfaces
- `src/services/exportService.ts` - Export logic details

---

## Recent Changes Log

### 2026-01-26: 2D Canvas Rotation Display Disabled

**Асуудал:** Хэрэглэгч 2D editor дээр зураг эргэсэн байдлаар харагддаг байсан (ялангуяа гарын хэсэгт). Энэ нь засварлахад хүндрэлтэй байсан.

**Шийдэл:** 2D canvas дээр rotation харуулахгүй болгосон. Зураг 2D дээр шулуун харагдана, харин 3D model дээр зөв өнцөгтэй харагдана.

#### Өөрчилсөн файлууд:

**1. `src/components/editor2d/useUVEditor.ts` (мөр 413-449)**

```typescript
// ӨМНӨ (rotation харуулдаг байсан):
ctx.translate(cx, cy);
ctx.rotate(p.rotationRad || 0);
ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);

// ОДОО (rotation харуулахгүй):
ctx.translate(cx, cy);
// ctx.rotate(p.rotationRad || 0); // DISABLED: rotation not shown in 2D
ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
```

**2. `src/components/editor2d/OverlayBox.tsx` (мөр 70-81, 198)**

```typescript
// ӨМНӨ:
const rotation = (currentPlacement.rotationRad || 0) * (180 / Math.PI);
// ...
transform: `rotate(${rotation}deg)`,

// ОДОО:
// const rotation = (currentPlacement.rotationRad || 0) * (180 / Math.PI); // DISABLED
// ...
// transform: `rotate(${rotation}deg)`, // DISABLED: rotation not shown in 2D
```

#### Буцаах заавар (How to Revert):

Хэрэв 2D canvas дээр rotation буцааж харуулах шаардлагатай бол:

**useUVEditor.ts файлд:**
```typescript
// Мөр 448-г олоод comment-г арилга:
// FROM:
// ctx.rotate(p.rotationRad || 0); // DISABLED: rotation not shown in 2D

// TO:
ctx.rotate(p.rotationRad || 0);
```

**OverlayBox.tsx файлд:**
```typescript
// Мөр 80-г олоод comment-г арилга:
// FROM:
// const rotation = (currentPlacement.rotationRad || 0) * (180 / Math.PI); // DISABLED

// TO:
const rotation = (currentPlacement.rotationRad || 0) * (180 / Math.PI);

// Мөр 208-г олоод comment-г арилга:
// FROM:
// transform: `rotate(${rotation}deg)`, // DISABLED: rotation not shown in 2D

// TO:
transform: `rotate(${rotation}deg)`,
```

#### Яагаад ийм шийдэл хэрэгтэй вэ?

| Байдал | 2D Canvas | 3D Model |
|--------|-----------|----------|
| Front/Back zone | Шулуун (0°) | Шулуун (0°) |
| Left Arm zone | Шулуун (0°) | -25° эргэсэн |
| Right Arm zone | Шулуун (0°) | +25° эргэсэн |

- **2D дээр:** Хэрэглэгч зургаа шулуун харж, хялбар засварлана
- **3D дээр:** Гарын налуу дагуу зураг зөв өнцөгтэй харагдана
- **Export дээр:** `rotationRad` бүрэн хадгалагдана (print production-д хэрэглэгдэнэ)

---

*Last Updated: 2026-01-26 (Added 2D rotation disable documentation with revert instructions)*
