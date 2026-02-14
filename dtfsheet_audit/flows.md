# UX Flows and User Journeys

## A) DTF Transfers by Size (product selection -> add to cart)
### Entry points
- `https://dtfsheet.com/`
- `https://dtfsheet.com/pages/startorder`
- `https://dtfsheet.com/products/custom-image-dtfsheet-transfer`

### Flow
1. User opens DTF by-size product page.
2. Selects size option (multiple preset sizes from small to full-front).
3. Selects finishing service:
   - roll (uncut)
   - pre-cut (+per-item surcharge)
4. Uploads artwork file and optionally enters notes.
5. Adjusts quantity (bulk discount breakpoints shown).
6. Clicks add to cart.

### Validations and constraints observed
- Quantity minimum of 1.
- File upload expected for normal fulfillment.
- Optional notes field for print instructions.

### Upsells and conversion aids
- Tiered bulk discount chips.
- Cross-sell blocks and related product sliders.
- Review scores and trust badges near CTA.

### Cart behavior
- Frontend calls `cart.js`/`cart.json`.
- Variant-based cart add; cart refresh occurs asynchronously.

### Shipping promise UI
- Top bar countdown + urgency.
- Same-day style messaging and business-day delivery framing.

### Error states observed
- Upload script runtime errors can occur in console (3rd-party upload stack).
- Missing asset/font occasionally seen in console logs.

## B) DTF Gang Sheet Upload (ready-to-print)
### Entry points
- `https://dtfsheet.com/pages/startorder`
- `https://dtfsheet.com/products/dtfsheet-custom-gang-sheet-order`

### Flow
1. User chooses gang sheet upload path.
2. Selects sheet length tier (22-inch wide product family).
3. Uploads print-ready gang sheet file.
4. Sets quantity.
5. Adds to cart.

### Validations and constraints observed
- Upload-ready file expected.
- Length tier must be selected before add-to-cart payload is complete.

### Upsells and conversion aids
- Size/length ladder with value framing.
- Quality check and durability badges.
- Related products in merchandising sections.

### Cart behavior
- Same Shopify cart API behavior (`/cart.js`/`/cart.json`).

### Shipping promise UI
- Same announcement bar and speed claims reused from core template.

### Error states observed
- Upload integration can throw JS errors in-browser under some environments.

## C) DTF Gang Sheet Builder (online builder)
### Entry points
- `https://dtfsheet.com/pages/startorder`
- `https://dtfsheet.com/products/dtfsheet%E2%84%A2-custom-gang-sheet-order-builder`

### Flow
1. User opens builder product.
2. Selects sheet length (22-inch width).
3. Clicks "Create Design" to open builder experience.
4. Completes layout/build process.
5. Returns/continues to cart flow with selected variant and quantity.
6. Optional branch: "Already have a file? Upload now."

### Validations and constraints observed
- Product variant selection needed before cart step.
- Builder path and upload path are separated to reduce user confusion.

### Upsells and conversion aids
- Popular/best-value size labels.
- Trust/payment security strip.
- Reviews module embedded below.

### Cart behavior
- Variant and quantity feed standard cart endpoints.

### Shipping promise UI
- Same speed/turnaround promise language.

### Error states observed
- Builder/upload-related script errors visible in console traces.

## D) UV DTF by Size + UV Gang Sheet
### Entry points
- `https://dtfsheet.com/products/uv-dtf-easy`
- `https://dtfsheet.com/products/uv-dtf-transfers-gang-sheets`
- `https://dtfsheet.com/products/uv-dtf-transfers-gang-sheets-auto-builder`

### Flow (by size)
1. User selects UV DTF by-size product.
2. Chooses size option.
3. Chooses roll vs pre-cut where shown.
4. Uploads file.
5. Sets quantity and adds to cart.

### Flow (gang sheet)
1. User selects UV gang sheet upload or builder.
2. Chooses sheet dimension/length variant.
3. Uploads file or starts builder.
4. Adds to cart.

### Validations and constraints observed
- Explicit usage disclaimer: UV DTF intended for hard surfaces, not fabric.
- Size/variant selection required.

### Upsells and conversion aids
- Same discount and trust patterns as DTF line.
- Shared cross-sell modules and review components.

### Cart behavior
- Standard Shopify variant cart add and cart refresh APIs.

### Shipping promise UI
- Shared countdown and shipping-speed framework.

### Error states observed
- Similar 3rd-party upload script errors occasionally observed.

## E) Blanks collections (t-shirts/hoodies/sweatshirts)
### Entry points
- Header mega menu -> Blanks
- Collection URLs:
  - `https://dtfsheet.com/collections/bella-canvas-jersey-tee-3001-collection`
  - `https://dtfsheet.com/collections/gildan-heavy-blend%E2%84%A2-hoodie-18500`
  - `https://dtfsheet.com/collections/gildan-heavy-blend%E2%84%A2-crewneck-sweatshirt-18000`

### Flow
1. User opens blanks collection.
2. Uses menu/filter/sort to narrow products.
3. Opens product card -> product detail.
4. Selects size/color variants on product page.
5. Adds to cart.

### Validations and constraints observed
- Variant selection required for blanks SKUs.
- Sorting/filtering represented via collection query params.

### Upsells and conversion aids
- Product badges, ratings, related inventory.
- Cross-navigation to other blanks families.

### Cart behavior
- Same cart endpoints and asynchronous cart state updates.

### Shipping promise UI
- Same top-level shipping countdown/claims reused site-wide.

### Error states observed
- No unique blanks-specific blocker observed in this crawl.
