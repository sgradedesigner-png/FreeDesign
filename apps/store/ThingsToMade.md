🟢 A. Must-have (MVP-г бодитоор ажиллуулна)
1.	Auth + Admin
•	Admin login (Supabase Auth)
•	Admin role (RLS-р хамгаалах)
•	Admin dashboard: бүтээгдэхүүн нэмэх/засах/устгах
2.	Product management
•	Product CRUD (name, category, price, stock, variants)
•	Image upload (Supabase Storage)
•	Category/Tag manager
3.	Inventory / Stock
•	Stock count (quantity)
•	“Out of stock” UI
•	Size/Color variant дээр тус тусдаа stock (илүү зөв)
4.	Checkout flow (Order)
•	Cart → Checkout form (name, phone, address)
•	Order table (orders + order_items)
•	Order status: pending/paid/shipped/cancelled
•	Confirmation page + order number
5.	Payment (сонголтоор)
•	Stripe (олон улсад)
•	Монголд: QPay / SocialPay / MonPay (байвал)
•	Payment status webhook → order update
________________________________________
🟡 B. UX/Performance (сайжруулалт)
6.	Server-side filter/sort
•	FilterSidebar → Supabase query (category, price, size)
•	Sorting (price low/high, newest)
•	Pagination / “Load more”
7.	Caching
•	React Query (чи аль хэдийн суулгасан)
•	Product list, product detail cache
•	Prefetch (hover дээр product detail cache хийх)
8.	Better Loading
•	Catalog skeleton grid
•	ProductDetails skeleton (чи эхлүүлсэн)
•	Empty state (хоосон үр дүн гарвал)
9.	Search
•	Search bar → server-side ilike / full text search
•	Recent searches
10.	SEO
•	Meta tags (title/description)
•	Product page OG зураг
•	Sitemap (дараа)
________________________________________
🔴 C. Growth / бизнесийн хүчтэй нэмэлтүүд
11.	Reviews систем
•	Product reviews table
•	Star rating + verified purchase
•	Admin moderation
12.	Wishlist / Favorites
•	User-д хадгалах
•	“Heart” button
13.	Coupons / Discounts
•	Coupon code
•	Category-based discount
•	Scheduled sale (start/end хугацаатай)
14.	Shipping rules
•	Free shipping threshold
•	Zone-based shipping fee
•	Delivery estimate
15.	Analytics
•	View product, add-to-cart, checkout start, purchase
•	Google Analytics / PostHog
•	Admin dashboard дээр KPI
________________________________________
🔐 D. Security / Reliability (production)
16.	RLS policies зөв хийх
•	Public: select products only
•	Authenticated: insert orders
•	Admin: product CRUD
17.	Validation
•	Zod schema (client)
•	DB constraints (price >=0, category enum гэх мэт)
18.	Error logging
•	Sentry (front)
•	Supabase logs / edge function logs
________________________________________
✅ Чамд санал болгох “алхамчилсан дараалал” (надад хамгийн зөв санагдаж байна)
1.	Order system (orders + order_items) + Checkout (paymentгүй ч болно)
2.	Admin CRUD (product нэмэх/засах) + Storage upload
3.	Server-side filter/sort + pagination
4.	React Query cache + prefetch
5.	Reviews / Wishlist / Coupons

