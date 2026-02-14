# Website Structure + Implementation Blueprint

## Audit summary (public pages only)
- Domain audited: `https://dtfsheet.com/`
- URL inventory source: `sitemap.xml` and child sitemaps.
- Coverage:
  - `1106` URLs total
  - `536` product routes
  - `28` collection routes
  - `34` page routes
  - `507` blog routes (index + posts)
- Key commerce funnels implemented:
  - DTF by-size
  - DTF gang sheet upload
  - DTF gang sheet builder
  - UV by-size
  - UV gang sheet (upload + builder)
  - blanks collections (tees/hoodies/sweatshirts)

## Website structure patterns worth cloning
### Navigation model
- Primary mega-menu by intent:
  - DTF custom transfer
  - UV DTF
  - blanks
  - support/FAQ/contact
- "Start order" landing page as funnel router.

### Product model families
- Family 1: by-size products with two options:
  - size
  - finishing (roll vs pre-cut surcharge)
- Family 2: gang sheet upload products:
  - fixed width + length variants
  - upload-ready artwork path
- Family 3: gang sheet builder products:
  - select length then open builder
- Family 4: blanks catalog:
  - normal size/color apparel variants

### Conversion architecture
- Shared trust stack:
  - review modules
  - speed/turnaround claims
  - quality badges
- Shared urgency:
  - countdown + shipping bar
- Shared CTA strategy:
  - upload now
  - create design
  - add to cart
  - free sample handoff

## Build on My Stack

### 1) Feature-to-stack mapping
| DTFSheet feature | Vite + React + TS implementation | Supabase | Cloudinary | Cloudflare |
|---|---|---|---|---|
| Mega-menu + funnel landing | `react-router` routes + menu config JSON; reusable `MegaMenu`, `StartOrderPage` | `menus`, `menu_items`, `cms_pages` | Not required | Cache static assets + edge redirects |
| Collection pages | `CollectionPage` with filters/sort/pagination | `collections`, `products`, `collection_products`, RPC for faceted query | Product image hosting URLs | Cache collection SSR/edge responses |
| Product pages (by-size, UV, blanks) | `ProductPage` + strategy components per product family | `products`, `product_variants`, `product_options`, `upload_requirements` | Product media + swatches | WAF + bot management |
| Gang sheet upload | Upload widget + validation UI + add-to-cart custom metadata | `upload_assets`, `cart_items.custom_options`, `order_items.production_notes` | Signed direct uploads, transformations, moderation tags | Turnstile optional for abuse control |
| Gang sheet builder | Builder canvas route + project autosave + checkout handoff | `gang_sheet_projects`, `gang_sheet_items` | Store source files + generated sprites/previews | Worker endpoint for preview generation |
| Cart + checkout | Local cart state + Supabase-backed cart + payment session endpoint | `carts`, `cart_items`, `orders`, `order_items` | Reference uploaded art per item | Edge function for checkout session |
| Reviews | Product review summary + list + moderation | `reviews`, `review_votes`, `review_media` | Review media hosting | Cache read-heavy review queries |
| Blog + guides | CMS-driven pages and blog templates | `blog_posts`, `blog_categories`, `cms_pages` | Inline media | CDN cache + stale-while-revalidate |

### 2) Supabase schema and RLS notes
Core tables:
- Catalog: `products`, `product_variants`, `product_images`, `collections`, `collection_products`, `product_tags`.
- Upload/builder: `upload_assets`, `gang_sheet_projects`, `gang_sheet_items`.
- Commerce: `carts`, `cart_items`, `orders`, `order_items`, `shipments`.
- Content/support: `cms_pages`, `blog_posts`, `faqs`, `reviews`.

RLS baseline:
- Public read: catalog, content, published reviews.
- Authenticated read/write own rows:
  - `carts`, `cart_items`, `orders`, `upload_assets`, `gang_sheet_projects`, `reviews`.
- Admin/service role:
  - catalog management
  - order status updates
  - moderation/reprint actions
  - background workers.

Recommended policies:
- `orders`: `select` where `customer_id = auth.uid()` or admin.
- `upload_assets`: `insert/select/update` only by owner; immutable file metadata after lock.
- `reviews`: insert only for verified order-item ownership.

### 3) Cloudinary signed upload pipeline
1. React requests signed params from Supabase Edge Function.
2. Browser uploads directly to Cloudinary with signed payload.
3. Store returned `public_id`, dimensions, mime metadata in `upload_assets`.
4. Async validator job checks:
   - file type
   - dimensions/DPI heuristics
   - transparency/background rules where applicable
5. On pass/fail, update `validation_status`; surface actionable messages in UI.

Security notes:
- Never expose Cloudinary API secret in client.
- Use short-lived signatures and folder scoping by tenant/user.

### 4) Background jobs (order + file review)
Use Supabase queue table + scheduled workers (or dedicated worker service).

Job types:
- `validate_upload_asset`
- `generate_builder_preview`
- `preflight_order_artwork`
- `route_to_print_queue`
- `send_order_status_notifications`
- `reprint_request_review`

Processing rules:
- Idempotent job handlers.
- Dead-letter and retry with backoff.
- Operator-visible error reasons.

### 5) Admin panels needed
- Catalog admin:
  - products/variants/options
  - collections
  - pricing tiers and compare-at price
- Order operations:
  - queue view by SLA (same-day cutoff)
  - order/art status
  - hold/reprint/refund tooling
- Upload operations:
  - moderation queue
  - failed validation review
  - manual override with audit log
- Reviews/content:
  - review moderation
  - FAQ/pages/blog editor

### 6) Prioritized backlog (Phase 0-3) with acceptance criteria
#### Phase 0 - Foundation and safety
- Scope:
  - project scaffold, design tokens, routing, auth baseline, schema migrations, RLS baseline
  - observability and error tracking
  - robots/SEO and policy pages
- Acceptance criteria:
  - public catalog pages load in under 2.5s p75 on broadband.
  - all tables have RLS and automated policy tests.
  - CI runs typecheck, tests, lint, migration checks.

#### Phase 1 - Core storefront + by-size products
- Scope:
  - home, start-order page, collections, product detail for by-size and blanks
  - cart lifecycle and checkout session creation
  - review summary/read model
- Acceptance criteria:
  - user can browse collection -> product -> variant select -> add to cart -> checkout start.
  - bulk pricing tiers update correctly by quantity.
  - cart recovers across refresh and device-session boundaries (if logged in).

#### Phase 2 - Upload-heavy flows (gang sheet + UV)
- Scope:
  - DTF gang sheet upload product
  - UV by-size and UV gang sheet templates
  - signed Cloudinary uploads + async validation + fail messaging
- Acceptance criteria:
  - supported files upload successfully with status transitions.
  - invalid files produce deterministic, user-readable errors.
  - uploaded assets are linked to cart and persisted to resulting order items.

#### Phase 3 - Builder, operations, and scale hardening
- Scope:
  - gang sheet builder MVP with autosave project model
  - production/admin queues and SLA dashboards
  - review moderation, support tooling, growth analytics cleanup
- Acceptance criteria:
  - builder project can be created, edited, resumed, and attached to order item.
  - order ops team can process queue states end-to-end without DB console access.
  - p95 API latency for read paths under agreed SLA in production load test.
