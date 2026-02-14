# DTFSheet Public Route Inventory

## Scope and compliance
- Target: `https://dtfsheet.com/` public pages only.
- Crawl method: static sitemap crawl + Playwright rendering for key pages.
- Guardrails followed:
  - Respected `robots.txt` disallow paths (`dtfsheet_audit/robots_disallow.txt`).
  - Did not access login, checkout, account, or private endpoints.
  - No account or checkout PII was accessed; optional raw HTML export was omitted to reduce personal-data retention.
  - Polite rate: low concurrency with delays.

## robots.txt disallow paths (`User-agent: *`)
```txt
*/collections/*filter*&*filter*
/*/*?*ls%3d*%3fls%3d*
/*/*?*ls=*&ls=*
/*/blogs/*%2b*
/*/blogs/*+*
/*/collections/*%2b*
/*/collections/*+*
/*/collections/*sort_by*
/*/policies/
/*/recommendations/products
/*?*oseid=*
/*preview_script_id*
/*preview_theme_id*
/.well-known/shopify/monorail
/76483002654/checkouts
/76483002654/orders
/a/downloads/-/*
/account
/admin
/apple-app-site-association
/blogs/*%2B*
/blogs/*+*
/cart
/carts
/cdn/wpm/*.js
/checkout
/checkouts/
/collections/*%2B*
/collections/*+*
/collections/*sort_by*
/orders
/policies/
/recommendations/products
/search
```

## Sitemap coverage
- Total URLs discovered: `1106` (`dtfsheet_audit/sitemap.csv`).
- Type breakdown:
  - `home`: 1
  - `collection`: 28
  - `product`: 536
  - `page`: 34
  - `blog_index`: 1
  - `blog_post`: 506

## Core URL patterns
- `/collections/*` (28)
- `/products/*` (536)
- `/pages/*` (34)
- `/blogs/*` (507 total: index + posts)
- `/community/*` (FAQ route observed)

## Key route inventory (high-value templates)
| URL | Page type | Primary CTAs | Key components/sections | Forms/upload widgets | Query params observed |
|---|---|---|---|---|---|
| `https://dtfsheet.com/` | Home | Upload and print now, start order, free sample | Announcement countdown, mega-nav, hero, trust badges, reviews, FAQ block, footer nav | Newsletter subscribe | None on canonical route |
| `https://dtfsheet.com/pages/startorder` | Landing (start order) | Upload by size, upload gang sheet, start building, free sample | 3-path chooser cards, FAQ accordion, trust blocks | Newsletter subscribe | None |
| `https://dtfsheet.com/collections/dtf-custom-prints` | Collection | Open product cards, quick product navigation | Collection hero, filters/sorting, product grid, badges/reviews | Sort/filter controls | `sort_by` |
| `https://dtfsheet.com/products/custom-image-dtfsheet-transfer` | Product (DTF by size) | Add to cart, upload files | Product gallery, size chips, finishing option (roll vs pre-cut), quantity tiers, FAQ/reviews, shipping promise | `/cart/add` form, file upload input, notes field | `variant`, `section_id` |
| `https://dtfsheet.com/products/dtfsheet-custom-gang-sheet-order` | Product (DTF gang sheet upload) | Upload, add to cart | Fixed-width gang sheet lengths, pricing ladder, quality/press info, reviews | `/cart/add` form, file upload | `variant`, `section_id` |
| `https://dtfsheet.com/products/dtfsheet%E2%84%A2-custom-gang-sheet-order-builder` | Product (DTF gang sheet builder) | Create design, upload now | Length selector, quantity stepper, builder launch CTA, trust/payment strip, reviews | Builder launch + cart controls | `variant`, `section_id` |
| `https://dtfsheet.com/products/uv-dtf-easy` | Product (UV DTF by size) | Choose file, add to cart | UV disclaimer block, size selector, roll/pre-cut selector, FAQ | `/cart/add` form, file upload | `variant`, `section_id` |
| `https://dtfsheet.com/products/uv-dtf-transfers-gang-sheets` | Product (UV gang sheet upload) | Upload, add to cart | UV gang sheet dimensions, quantity pricing, trust/FAQ | `/cart/add` form, file upload | `variant`, `section_id` |
| `https://dtfsheet.com/products/uv-dtf-transfers-gang-sheets-auto-builder` | Product (UV gang sheet builder) | Create design, add to cart | Builder-style selector + gang sheet dimensions | Builder controls + cart | `variant`, `section_id` |
| `https://dtfsheet.com/collections/bella-canvas-jersey-tee-3001-collection` | Collection (blanks t-shirts) | Open product detail | Faceted menu, sort, product cards with variant pricing | Sorting/filter widgets | `sort_by` |
| `https://dtfsheet.com/collections/gildan-heavy-blend%E2%84%A2-hoodie-18500` | Collection (blanks hoodies) | Open product detail | Same collection template, badges, product cards | Sorting/filter widgets | `sort_by` |
| `https://dtfsheet.com/collections/gildan-heavy-blend%E2%84%A2-crewneck-sweatshirt-18000` | Collection (blanks sweatshirts) | Open product detail | Same collection template, badges, product cards | Sorting/filter widgets | `sort_by` |
| `https://dtfsheet.com/pages/heat-press-guide-for-dtf-transfers` | Info page | Start order/contact | Long-form guide content, instructional sections, footer links | Newsletter subscribe | None |
| `https://dtfsheet.com/community/faq` | FAQ page | Contact us, order links | FAQ accordion sections, support links | Contact/newsletter in footer | None |
| `https://dtfsheet.com/blogs/blog` | Blog index | Read article | Blog listing cards, category-like archive behavior | Search/sort patterns via platform | `page` (pagination pattern) |
| `https://dtfsheet.com/blogs/blog/how-to-order-dtf-transfers` | Blog post | Related article links, order CTA links | Article template, inline links to products/pages | Newsletter subscribe | None |

## Query parameter patterns seen
- Commerce and render:
  - `variant`
  - `section_id`
  - `sort_by`
- API and UX support:
  - `page`, `perPage`, `sort` (reviews APIs)
  - `timestamp` (cart polling)
  - tracking/analytics query keys on pixel endpoints

## Full route lists
- Complete machine-readable inventory: `dtfsheet_audit/sitemap.csv`
- Snapshot with grouped lists: `dtfsheet_audit/sitemap_inventory.json`
