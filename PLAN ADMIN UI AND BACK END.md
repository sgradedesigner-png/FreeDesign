# 📋 E-COMMERCE ADMIN PANEL - ХӨГЖҮҮЛЭЛТИЙН ТӨЛӨВЛӨГӨӨ

**Огноо:** 2026-02-01
**Төсөл:** E-commerce Platform - Admin UI & Backend Integration
**Зорилго:** Functional admin panel (Phase 1) → Full dashboard (Phase 2)

---

## 🎯 EXECUTIVE SUMMARY

### Одоогийн Байдал

**Backend:** ✅ **100% бэлэн**
- Products CRUD API ажиллаж байна
- Categories CRUD API ажиллаж байна
- Supabase authentication нэвтэрсэн
- Prisma ORM тохируулагдсан
- Validation, error handling хийгдсэн

**Admin UI:** ❌ **5% бэлэн**
- Зөвхөн login/logout ажиллана
- UI component library байхгүй
- Tailwind CSS байхгүй
- CRUD интерфейс байхгүй

**Store UI:** ✅ **Reference template**
- shadcn/ui + Tailwind бүрэн
- 30+ бэлэн компонентууд
- Гоё, орчин үеийн дизайн

### Стратеги

**Admin UI-г Store UI-н база дээр босгох:**
1. Store-с Tailwind config хуулах
2. Store-с shadcn/ui компонентууд ашиглах
3. Ижил дизайн систем, ижил код стандарт

---

## 📊 ТЕХНИКИЙН ШИНЖИЛГЭЭ

### 1. APPS/ADMIN - Одоогийн Бүтэц

```
apps/admin/src/
├── auth/
│   └── AuthContext.tsx          ✅ Бэлэн (Supabase auth)
├── components/
│   └── ProtectedRoute.tsx       ✅ Бэлэн (Route guard)
├── lib/
│   ├── api.ts                   ✅ Бэлэн (Axios + interceptor)
│   └── supabase.ts              ✅ Бэлэн (Client setup)
├── pages/
│   ├── DashboardPage.tsx        ⚠️ Маш энгийн (зөвхөн ping test)
│   └── LoginPage.tsx            ✅ Бэлэн
├── App.tsx                      ✅ Бэлэн (Routing)
└── main.tsx                     ✅ Бэлэн
```

**Dependencies (одоогийн):**
```json
{
  "react": "^19.2.0",
  "react-router-dom": "^7.13.0",
  "axios": "^1.13.4",
  "@supabase/supabase-js": "^2.93.3"
}
```

**UI Library:** ❌ Байхгүй
**Styling:** ❌ Inline styles only
**Forms:** ❌ Байхгүй
**Tables:** ❌ Байхгүй

---

### 2. APPS/STORE - UI Component Reference

```
apps/store/src/
├── components/
│   ├── ui/                      ✅ shadcn/ui компонентууд
│   │   ├── button.tsx           → Admin-д хэрэгтэй
│   │   ├── card.tsx             → Admin-д хэрэгтэй
│   │   ├── input.tsx            → Admin-д хэрэгтэй
│   │   ├── select.tsx           → Admin-д хэрэгтэй
│   │   ├── checkbox.tsx         → Admin-д хэрэгтэй
│   │   ├── badge.tsx            → Admin-д хэрэгтэй
│   │   ├── sheet.tsx            → Хэрэггүй (sidebar-д өөр компонент)
│   │   └── slider.tsx           → Хэрэггүй
│   ├── layout/
│   │   └── Header.tsx           → Pattern-г ашиглана
│   └── product/
│       └── *.tsx                → Reference болгон харах
├── lib/
│   └── utils.ts                 ✅ cn() utility → Admin-д хуулна
├── index.css                    ✅ Tailwind setup → Admin-д хуулна
├── components.json              ✅ shadcn/ui config → Admin-д хуулна
├── tailwind.config.js           ✅ Config → Admin-д хуулна
└── postcss.config.js            ✅ PostCSS → Admin-д хуулна
```

**Tailwind Theme (Store):**
```javascript
{
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: 'hsl(var(--primary))',
        secondary: 'hsl(var(--secondary))',
        // ... CSS variables
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Montserrat', 'sans-serif'],
      }
    }
  },
  plugins: [require('tailwindcss-animate')]
}
```

---

### 3. BACKEND - API Endpoints

**Бэлэн Endpoints:**

#### Products (`/admin/products`)
```typescript
POST   /               // Create product
GET    /               // List (pagination, search)
GET    /:id            // Get single product
PUT    /:id            // Update product
DELETE /:id            // Delete product
```

**Request Schema (Create):**
```json
{
  "title": "string (required)",
  "slug": "string (required, unique)",
  "description": "string (optional)",
  "price": "number | string (required)",
  "stock": "number (optional, default: 0)",
  "images": "string[] (optional, R2 URLs)",
  "categoryId": "uuid (required)"
}
```

**Response Schema (List):**
```json
{
  "items": [/* products with category relation */],
  "page": 1,
  "limit": 20,
  "total": 45,
  "pages": 3
}
```

#### Categories (`/admin/categories`)
```typescript
POST   /               // Create category
GET    /               // List all
PUT    /:id            // Update category
DELETE /:id            // Delete (blocks if products exist)
```

**Request Schema:**
```json
{
  "name": "string (required)",
  "slug": "string (required, unique)"
}
```

#### Authentication
```typescript
GET /admin/ping       // Auth test
```

**Authorization:**
- Header: `Authorization: Bearer <supabase_jwt>`
- Backend validates JWT → checks `profiles` table → requires `role: ADMIN`

---

## 🚀 PHASE 1: FUNCTIONAL ADMIN PANEL

**Хугацаа:** 2-3 хоног
**Зорилго:** Products болон Categories удирдах боломжтой, functional admin panel

### Step 1: UI Framework Setup (4-6 hours)

#### 1.1 Dependencies суулгах

```bash
cd apps/admin

# Tailwind CSS
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# shadcn/ui dependencies
npm install class-variance-authority clsx tailwind-merge
npm install lucide-react

# Form handling
npm install react-hook-form @hookform/resolvers zod

# Table
npm install @tanstack/react-table

# Notifications
npm install sonner

# Radix UI (shadcn/ui ашиглах үед автоматаар суугдана)
```

#### 1.2 Tailwind тохиргоо

**`tailwind.config.js`** (Store-с хуулах):
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Montserrat', 'sans-serif'],
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
```

#### 1.3 CSS Variables

**`src/index.css`** үүсгэх:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --primary: 210 40% 98%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 212.7 26.8% 83.9%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
    font-feature-settings: "rlig" 1, "calt" 1;
  }
}
```

#### 1.4 Vite Path Aliases

**`vite.config.ts`** шинэчлэх:
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

**`tsconfig.json`** шинэчлэх:
```json
{
  "compilerOptions": {
    // ... existing config
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

#### 1.5 shadcn/ui тохиргоо

**`components.json`** үүсгэх:
```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.js",
    "css": "src/index.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui"
  }
}
```

#### 1.6 Utilities файл

**`src/lib/utils.ts`** үүсгэх:
```typescript
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

---

### Step 2: shadcn/ui Components суулгах (2 hours)

```bash
# Core components
npx shadcn@latest add button
npx shadcn@latest add card
npx shadcn@latest add input
npx shadcn@latest add label
npx shadcn@latest add select
npx shadcn@latest add badge
npx shadcn@latest add separator

# Form components
npx shadcn@latest add form
npx shadcn@latest add textarea
npx shadcn@latest add checkbox

# Layout components
npx shadcn@latest add sheet
npx shadcn@latest add dropdown-menu
npx shadcn@latest add dialog

# Data display
npx shadcn@latest add table
npx shadcn@latest add tabs
npx shadcn@latest add alert

# Feedback
npx shadcn@latest add toast
```

**Үүссэн компонентууд:**
```
src/components/ui/
├── button.tsx
├── card.tsx
├── input.tsx
├── label.tsx
├── select.tsx
├── badge.tsx
├── separator.tsx
├── form.tsx
├── textarea.tsx
├── checkbox.tsx
├── sheet.tsx
├── dropdown-menu.tsx
├── dialog.tsx
├── table.tsx
├── tabs.tsx
├── alert.tsx
└── toast.tsx
```

---

### Step 3: Layout Components (4-6 hours)

#### 3.1 Admin Layout

**`src/components/layout/AdminLayout.tsx`**:
```typescript
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

export function AdminLayout() {
  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
```

#### 3.2 Sidebar Navigation

**`src/components/layout/Sidebar.tsx`**:
```typescript
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Package,
  FolderTree,
  ShoppingCart,
  Settings,
} from 'lucide-react';

const menuItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/products', icon: Package, label: 'Products' },
  { path: '/categories', icon: FolderTree, label: 'Categories' },
  { path: '/orders', icon: ShoppingCart, label: 'Orders' },
  { path: '/settings', icon: Settings, label: 'Settings' },
];

export function Sidebar() {
  const location = useLocation();

  return (
    <div className="w-64 bg-card border-r border-border">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-border">
        <h1 className="text-xl font-bold">Admin Panel</h1>
      </div>

      {/* Navigation */}
      <nav className="p-4 space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
```

#### 3.3 Top Bar

**`src/components/layout/TopBar.tsx`**:
```typescript
import { useAuth } from '@/auth/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { LogOut, User } from 'lucide-react';

export function TopBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="h-16 border-b border-border bg-card px-6 flex items-center justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">
            <User className="w-4 h-4 mr-2" />
            {user?.email || 'Admin'}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>My Account</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
```

---

### Step 4: Products Management (8-10 hours)

#### 4.1 Products List Page

**`src/pages/ProductsPage.tsx`**:
```typescript
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Edit, Trash } from 'lucide-react';
import { ProductDeleteDialog } from '@/components/products/ProductDeleteDialog';

type Product = {
  id: string;
  title: string;
  slug: string;
  price: number;
  stock: number;
  category: { name: string };
};

export function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/products', {
        params: { q: search, page, limit: 20 },
      });
      setProducts(data.items);
      setTotal(data.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [search, page]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Products</h1>
          <p className="text-muted-foreground">
            Manage your products ({total} total)
          </p>
        </div>
        <Button asChild>
          <Link to="/products/new">
            <Plus className="w-4 h-4 mr-2" />
            Add Product
          </Link>
        </Button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  Loading...
                </TableCell>
              </TableRow>
            ) : products.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  No products found
                </TableCell>
              </TableRow>
            ) : (
              products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">
                    {product.title}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {product.slug}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {product.category.name}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    ${product.price}
                  </TableCell>
                  <TableCell className="text-right">
                    {product.stock}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                      >
                        <Link to={`/products/${product.id}/edit`}>
                          <Edit className="w-4 h-4" />
                        </Link>
                      </Button>
                      <ProductDeleteDialog
                        product={product}
                        onDeleted={fetchProducts}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex justify-center gap-2">
        <Button
          variant="outline"
          disabled={page === 1}
          onClick={() => setPage(p => p - 1)}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          disabled={page * 20 >= total}
          onClick={() => setPage(p => p + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
```

#### 4.2 Product Form (Create/Edit)

**`src/pages/ProductFormPage.tsx`**:
```typescript
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

const productSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  slug: z.string().min(1, 'Slug is required'),
  description: z.string().optional(),
  price: z.coerce.number().min(0, 'Price must be positive'),
  stock: z.coerce.number().int().min(0, 'Stock must be non-negative'),
  categoryId: z.string().uuid('Please select a category'),
  images: z.string().optional(),
});

type ProductFormData = z.infer<typeof productSchema>;

export function ProductFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      title: '',
      slug: '',
      description: '',
      price: 0,
      stock: 0,
      categoryId: '',
      images: '',
    },
  });

  // Load categories
  useEffect(() => {
    api.get('/admin/categories').then((res) => {
      setCategories(res.data);
    });
  }, []);

  // Load product if editing
  useEffect(() => {
    if (id) {
      api.get(`/admin/products/${id}`).then((res) => {
        const product = res.data;
        form.reset({
          title: product.title,
          slug: product.slug,
          description: product.description || '',
          price: Number(product.price),
          stock: product.stock,
          categoryId: product.categoryId,
          images: product.images.join(', '),
        });
      });
    }
  }, [id]);

  const onSubmit = async (data: ProductFormData) => {
    setLoading(true);
    try {
      const payload = {
        ...data,
        images: data.images ? data.images.split(',').map(s => s.trim()) : [],
      };

      if (id) {
        await api.put(`/admin/products/${id}`, payload);
        toast.success('Product updated successfully');
      } else {
        await api.post('/admin/products', payload);
        toast.success('Product created successfully');
      }

      navigate('/products');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save product');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">
          {id ? 'Edit Product' : 'Create Product'}
        </h1>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Title</FormLabel>
                <FormControl>
                  <Input placeholder="Premium Cotton T-Shirt" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="slug"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Slug</FormLabel>
                <FormControl>
                  <Input placeholder="premium-cotton-tshirt" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Product description..."
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Price</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="stock"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Stock</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="categoryId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {categories.map((cat: any) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="images"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Images (comma-separated URLs)</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="https://example.com/image1.jpg, https://example.com/image2.jpg"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex gap-4">
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : id ? 'Update Product' : 'Create Product'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/products')}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
```

#### 4.3 Delete Dialog

**`src/components/products/ProductDeleteDialog.tsx`**:
```typescript
import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Trash } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

type Props = {
  product: { id: string; title: string };
  onDeleted: () => void;
};

export function ProductDeleteDialog({ product, onDeleted }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    try {
      await api.delete(`/admin/products/${product.id}`);
      toast.success('Product deleted');
      setOpen(false);
      onDeleted();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Trash className="w-4 h-4 text-destructive" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Product</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete "{product.title}"?
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? 'Deleting...' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

---

### Step 5: Categories Management (4-6 hours)

**`src/pages/CategoriesPage.tsx`** - Ижил pattern ашиглан:
- Categories list table
- Create/edit dialog (modal)
- Delete confirmation
- API integration

---

### Step 6: Dashboard Improvements (4-6 hours)

**`src/pages/DashboardPage.tsx`** шинэчлэх:
- Statistics cards (total products, categories, low stock)
- Recent products table
- Quick actions

---

### Step 7: Routing Update

**`src/App.tsx`** шинэчлэх:
```typescript
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AdminLayout } from './components/layout/AdminLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import { ProductsPage } from './pages/ProductsPage';
import { ProductFormPage } from './pages/ProductFormPage';
import { CategoriesPage } from './pages/CategoriesPage';
import { Toaster } from 'sonner';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<DashboardPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/products/new" element={<ProductFormPage />} />
          <Route path="/products/:id/edit" element={<ProductFormPage />} />
          <Route path="/categories" element={<CategoriesPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster position="top-right" />
    </AuthProvider>
  );
}
```

---

## 🎨 PHASE 2: ENHANCED DASHBOARD

**Хугацаа:** 3-5 хоног
**Зорилго:** Зураг дээрх дизайнтай ойртуулах - charts, analytics, гоё UI

### Step 1: Charts Library (1-2 hours)

```bash
npm install recharts
npm install date-fns  # Date formatting
```

### Step 2: Dashboard Statistics (6-8 hours)

**Компонентууд:**
- Statistics cards with trend indicators
- Sales chart (line/area chart)
- Category distribution (pie chart)
- Top selling products carousel
- Recent orders table

### Step 3: Order Management (8-10 hours)

**Backend:**
- Order API endpoints үүсгэх

**Frontend:**
- Orders list with filters (status, date range)
- Order detail modal
- Status update workflow

### Step 4: Advanced Features (8-10 hours)

- Bulk operations (select multiple, bulk delete)
- Export to CSV/Excel
- Advanced filters (multi-select, date range)
- Search with debounce
- Sorting

### Step 5: Image Upload System (6-8 hours)

**Backend:**
- Cloudflare R2 upload endpoint
- Image validation

**Frontend:**
- Drag & drop upload component
- Image preview & crop
- Progress bar
- Gallery management

---

## 📁 FINAL STRUCTURE

```
apps/admin/
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AdminLayout.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── TopBar.tsx
│   │   ├── products/
│   │   │   ├── ProductDeleteDialog.tsx
│   │   │   └── ProductCard.tsx
│   │   ├── categories/
│   │   │   └── CategoryDialog.tsx
│   │   ├── dashboard/
│   │   │   ├── StatCard.tsx
│   │   │   ├── SalesChart.tsx
│   │   │   └── RecentProducts.tsx
│   │   └── ui/
│   │       └── (shadcn/ui components)
│   ├── pages/
│   │   ├── DashboardPage.tsx
│   │   ├── ProductsPage.tsx
│   │   ├── ProductFormPage.tsx
│   │   ├── CategoriesPage.tsx
│   │   ├── OrdersPage.tsx
│   │   └── LoginPage.tsx
│   ├── lib/
│   │   ├── api.ts
│   │   ├── supabase.ts
│   │   └── utils.ts
│   ├── auth/
│   │   └── AuthContext.tsx
│   └── App.tsx
├── components.json
├── tailwind.config.js
├── postcss.config.js
└── package.json
```

---

## ✅ SUCCESS CRITERIA

### Phase 1 Complete When:
- ✅ Products list харагдаж байна (table format)
- ✅ Product create/edit form ажиллаж байна
- ✅ Product delete ажиллаж байна
- ✅ Categories CRUD бүрэн ажиллаж байна
- ✅ UI store app-тай ижил харагдаж байна
- ✅ Responsive дизайн ажиллаж байна
- ✅ Loading states, error handling байна
- ✅ Toast notifications ажиллаж байна

### Phase 2 Complete When:
- ✅ Dashboard-д statistics харагдаж байна
- ✅ Charts гоё харагдаж байна
- ✅ Order management ажиллаж байна
- ✅ Image upload систем ажиллаж байна
- ✅ Bulk operations ажиллаж байна
- ✅ Зураг дээрх дизайнтай ойролцоо харагдаж байна

---

## 🚀 NEXT ACTIONS

1. **Dependencies суулгах** (15 mins)
2. **Tailwind + shadcn/ui тохируулах** (1 hour)
3. **Layout компонентууд үүсгэх** (2 hours)
4. **Products list хуудас** (4 hours)
5. **Product form** (4 hours)
6. **Categories management** (3 hours)
7. **Dashboard шинэчлэх** (3 hours)

**Нийт Phase 1:** ~18-24 hours = 2-3 хоног

---

## 📝 NOTES

- Store app-н UI pattern-г бүрэн дагах
- Backend API бэлэн байгаа, зөвхөн frontend хэрэгтэй
- shadcn/ui ашиглах = мэргэжлийн харагдах
- Type-safe (TypeScript + Zod)
- Responsive дизайн (Tailwind)
- Dark mode бэлэн (CSS variables)

---

**Бүтээсэн:** Claude Code
**Огноо:** 2026-02-01
**Хувилбар:** 1.0
