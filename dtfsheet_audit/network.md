# Network and Tech Footprint (Public Pages)

## Data sources
- Playwright captures:
  - `dtfsheet_audit/network_dtf_size.txt`
  - `dtfsheet_audit/network_gang_sheet_builder.txt`
  - `dtfsheet_audit/network_uv_dtf_size.txt`
- Parsed summary:
  - `dtfsheet_audit/network_summary.json`
  - `dtfsheet_audit/tech_hosts_summary.json`
- Rendered DOM and console observations from Playwright navigation of key pages.

## Platform/CMS detection
Observed Shopify markers confirm Shopify storefront:
- `Shopify.shop = "dtfsheet.myshopify.com"` in HTML.
- Shopify cloud asset paths: `/cdn/shopifycloud/...`
- Product JSON endpoints: `/products/{handle}.json`
- Cart endpoints: `/cart.js`, `/cart.json`
- Shopify monorail analytics endpoints under `/.well-known/shopify/monorail/*`
- Theme section render pattern with `section_id`.

## Major third-party services observed
### Commerce/reviews/apps
- Judge.me (`judge.me`, `cdnwidget.judge.me`, `api.judge.me`)
- Yotpo API (`api-cdn.yotpo.com`)
- Hulkapps reorder (`reorder-master.hulkapps.com`)
- Reputon widget (`grw.reputon.com`)
- BSS B2B (`b2b-solution-api.bsscommerce.com`)
- UpPromote affiliate scripts
- Appstle loyalty scripts
- Instant/EComposer landing-builder stack (`cdn.instant.so`, `cdn.ecomposer.app`)
- Cloudlift upload script (`assets.cloudlift.app`)

### Analytics and tracking
- Google Analytics / Google Ads / Merchant Center
- TikTok pixel API
- Pinterest conversion API
- Snapchat tracking
- Twitter/X ads conversion endpoints
- Shopify monorail telemetry

## Key XHR/fetch request patterns (tokens redacted)
| Endpoint pattern | Method | Purpose | Payload/query shape (redacted) | Response shape summary |
|---|---|---|---|---|
| `/products/{handle}.json` | GET | Product hydration | none | `product{ id, title, handle, variants, options, images, tags }` |
| `/products/{handle}?variant={id}&section_id={section}` | GET | Server-rendered section HTML refresh | `variant`, `section_id` | HTML fragment for dynamic sections |
| `/cart.js` and `/cart.json` | GET | Cart state polling and updates | optional `timestamp`, `r` | cart object with items, totals, currency |
| `/api/collect` (first-party) | POST | Internal tracking event | event payload | ack/status |
| `/.well-known/shopify/monorail/*` | POST | Shopify telemetry | batched event payload | status only |
| `api-cdn.yotpo.com/.../productFilters` | GET | Review aggregates | `lang` | product rating counters/filters |
| `api-cdn.yotpo.com/.../reviews` | GET | Review listing | `page`, `perPage`, `sort` | review collection with pagination |
| `reorder-master.hulkapps.com/api/get-banner-settings` | GET | Banner config | `domain` | app config JSON |
| `grw.reputon.com/app/storefront/widget` | GET | Reviews widget config/content | `shop` | widget payload |
| `analytics.google.com/g/collect` | POST | GA4 events | many analytics params | `204` no body |
| `analytics.tiktok.com/api/v2/shopify_pixel` | POST | TikTok conversion events | pixel event payload | status |
| `ct.pinterest.com/v3/` | GET/POST | Pinterest tracking | event + ad metadata | status |
| `tr.snapchat.com/p` | POST | Snapchat tracking | event payload | status |
| `analytics.twitter.com/1/i/adsct` | GET | X/Twitter conversion | query event params | status |

## Shopify theme section pattern
Accessible render pattern observed repeatedly:
- `GET /products/{handle}?variant={variant_id}&section_id=sections--{theme_section}`
- Used for:
  - product recommendations
  - cross-sell snippets
  - dynamic product widgets

## Notable runtime observations
- Console/runtime errors on some product pages tied to upload integrations:
  - `NotSupportedError` in upload-related script.
  - `TypeError: Cannot set properties of undefined` from custom JS bundles.
- These are implementation signals for robustness checks during clone implementation.

## Top hosts by request count (sampled key pages)
- `dtfsheet.com`
- `analytics.google.com`
- `analytics.tiktok.com`
- `tr.snapchat.com`
- `ct.pinterest.com`
- `t.co` / `analytics.twitter.com`
- `api.config-security.com`

(Exact counts in `dtfsheet_audit/network_summary.json`.)
