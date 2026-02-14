# Template Anatomy Extraction

## Global shell (repeats across templates)
- Top announcement bar with shipping countdown and urgency message.
- Header with multi-column menu (DTF, UV DTF, Blanks, FAQ, Contact).
- Utility icons: search, cart, account.
- Footer with:
  - product quick links
  - resource links
  - support/policy links
  - newsletter input
  - social links

## Home template
- Major blocks:
  - hero with primary "upload/order" CTA
  - trust badges and production-speed claims
  - high-volume social proof (review aggregates)
  - feature highlight rows
  - FAQ accordion
  - final conversion CTA strip
- Repeated widgets:
  - review carousel module
  - FAQ accordion pattern
  - linked promo cards to DTF/UV/Blanks pathways
- Forms/widgets:
  - newsletter subscribe

## Collection template (`/collections/*`)
- Major blocks:
  - collection title/banner
  - filter/left navigation and sorting controls
  - product card grid
  - review badge and price display in cards
- Repeated widgets:
  - sort selector (`sort_by`)
  - product-card media + price + quick entry
  - category sub-navigation for blanks families
- Forms/widgets:
  - sort/filter controls
  - no file upload on collection listing

## Product template (`/products/*`)
- Common blocks:
  - media gallery
  - product title + trust/social proof row
  - variant/option selectors
  - pricing + quantity + add to cart
  - long description accordions
  - reviews block
- Sub-variants observed:
  - DTF by size:
    - size matrix
    - finishing option (roll vs pre-cut)
    - upload files + notes
    - quantity discount tiers
  - Gang sheet upload:
    - fixed width, multiple length options
    - upload-ready artwork flow
  - Gang sheet builder:
    - "Create Design" launch path
    - alternate "Already have a file? Upload now" link
  - UV DTF by size:
    - explicit non-fabric disclaimer
    - size + finishing option + upload
- Forms/widgets:
  - `/cart/add` form
  - file upload input (cloud upload app script present)
  - review pagination/filter UI

## Page/FAQ template (`/pages/*`, `/community/faq`)
- Major blocks:
  - long-form content sections (guides, policy-like content, support pages)
  - accordion-style Q&A
  - support/contact handoff CTAs
- Repeated widgets:
  - FAQ accordion
  - in-content links to products/start-order pages
- Forms/widgets:
  - mostly newsletter/contact links; low direct commerce actions

## Blog templates (`/blogs/*`)
- Blog index:
  - article cards/list
  - category-like archive structure
  - read-more and internal linking to educational topics
- Blog post:
  - standard article body
  - internal links to product/guide pages
  - related reading behavior
- Forms/widgets:
  - newsletter in footer; no upload widgets

## Microcopy categories (summarized, not verbatim)
- Speed and logistics:
  - same-day/next-day language
  - countdown urgency
  - business-day promises
- Quality assurances:
  - wash durability
  - color vibrancy
  - in-house production and quality-check claims
- Risk reversal:
  - free sample offers
  - support/troubleshooting emphasis
- Onboarding:
  - simple 3-step ordering cues
  - beginner-friendly heat press guidance
- Product-fit disclaimers:
  - UV DTF suitability for hard surfaces vs fabric
