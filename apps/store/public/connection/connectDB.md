# Supabase holbolt hiih phased tuluvluguu

## Phase 0: Uridchilsan beltgel (ENV + config)
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` ni `src/lib/supabase.ts` dotor ashiglagdaj baigaa eseh
- `.env` file git-d orohgui baigaag shalgah
- Supabase project URL/Key buren zuv eseh

## Phase 1: Schema + Data
- `ecommerce_product` table-iin bagana (sanalt):
  - `id` (text/uuid, primary key)
  - `name`, `category`, `price`, `original_price`
  - `rating`, `reviews`
  - `image`, `description`
  - `sizes`, `colors`, `gallery`, `features` (text[])
  - `is_new` (boolean), `created_at` (timestamp)
- RLS policy: public read-ok (catalog harahad)
- Turshiltiin data oruulj UI-toi niilj buj eseh

## Phase 2: Data access layer
- `src/lib/supabase.ts`-iin client ashiglalt
- `src/data/products.api.ts`-d list + single fetch function
- `src/data/products.ts`-d DB->UI mapper (field-nuudiig taaaruulna)

## Phase 3: UI holbolt
- `Catalog`, `ProductDetails`, `RelatedProducts` dotor data fetch hiij haruulna
- Loading/Error tulvuu haruulah
- CartContext ni `Product` type-oooor urgeljlen ajillah

## Phase 4: Shalgalt
- Dev server asaaj data irj baigaa eseh
- Filter, search, detail, add-to-cart ajillaj baigaa eseh
- Error/empty state haragdaj baigaa eseh

## Phase 5: Saijruulalt (optional)
- Pagination, server-side filter/sort
- Client caching (React Query, SWR)
- Monitoring/logging
