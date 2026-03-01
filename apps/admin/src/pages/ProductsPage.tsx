import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { logger } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Edit, Plus, Search, Trash2, Download, ArrowUpDown } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';

type Category = {
  id: string;
  name: string;
  slug: string;
};

type ProductVariant = {
  id: string;
  productId: string;
  name: string;
  sku: string;
  price: string;
  originalPrice: string | null;
  sizes: string[];
  imagePath: string;
  galleryPaths: string[];
  stock: number;
  isAvailable: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

type Product = {
  id: string;
  title: string;
  slug: string;
  is_published?: boolean;
  isPublished?: boolean;
  description: string | null;
  basePrice: string;
  categoryId: string;
  category: Category;
  variants: ProductVariant[];
  rating: number;
  reviews: number;
  features: string[];
  createdAt: string;
  updatedAt: string;
};

type ProductsResponse = {
  items: Product[];
  page: number;
  limit: number;
  total: number;
  pages: number;
};

type SortableProductKey = keyof Product | 'category' | 'price' | 'stock';

type SortConfig = {
  key: SortableProductKey;
  direction: 'asc' | 'desc';
} | null;

export default function ProductsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<string>('all');
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; product: Product | null }>({
    open: false,
    product: null,
  });
  const [bulkDeleteDialog, setBulkDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [updatingStatusIds, setUpdatingStatusIds] = useState<Set<string>>(new Set());

  const debouncedSearch = useDebounce(search, 500);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const { data } = await api.get<Category[]>('/admin/categories');
      setCategories(data);
    } catch (error) {
      logger.error('Failed to fetch categories:', error);
    }
  };

  // React Query for products with caching and prefetching
  const {
    data: productsData,
    isLoading: loading,
    isFetching,
  } = useQuery({
    queryKey: ['products', page, debouncedSearch, selectedCategory, stockFilter, sortConfig],
    queryFn: async () => {
      const params: Record<string, string | number> = {
        page,
        limit: 20,
      };
      if (debouncedSearch) params.q = debouncedSearch;
      if (selectedCategory !== 'all') params.categoryId = selectedCategory;
      if (stockFilter !== 'all') params.stock = stockFilter;
      if (sortConfig) {
        params.sortBy = sortConfig.key === 'category' ? 'category' : sortConfig.key;
        params.sortOrder = sortConfig.direction;
      }

      const { data } = await api.get<ProductsResponse>('/admin/products', { params });
      return data;
    },
    placeholderData: (prev) => prev, // Keep previous data while fetching
  });

  const products = productsData?.items ?? [];
  const totalPages = productsData?.pages ?? 1;
  const total = productsData?.total ?? 0;

  const resolvePublished = (product: Product) =>
    Boolean(product.is_published ?? product.isPublished ?? false);

  const handleStatusChange = async (product: Product, nextPublished: boolean) => {
    const currentPublished = resolvePublished(product);
    if (currentPublished === nextPublished) return;

    setUpdatingStatusIds((prev) => new Set(prev).add(product.id));
    try {
      await api.put(`/admin/products/${product.id}`, { is_published: nextPublished });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    } catch (error) {
      logger.error('Failed to update product status:', error);
    } finally {
      setUpdatingStatusIds((prev) => {
        const next = new Set(prev);
        next.delete(product.id);
        return next;
      });
    }
  };

  // Prefetch next page
  useEffect(() => {
    if (page < totalPages) {
      const nextParams: Record<string, string | number> = {
        page: page + 1,
        limit: 20,
      };
      if (debouncedSearch) nextParams.q = debouncedSearch;
      if (selectedCategory !== 'all') nextParams.categoryId = selectedCategory;
      if (stockFilter !== 'all') nextParams.stock = stockFilter;
      if (sortConfig) {
        nextParams.sortBy = sortConfig.key === 'category' ? 'category' : sortConfig.key;
        nextParams.sortOrder = sortConfig.direction;
      }

      queryClient.prefetchQuery({
        queryKey: ['products', page + 1, debouncedSearch, selectedCategory, stockFilter, sortConfig],
        queryFn: () => api.get<ProductsResponse>('/admin/products', { params: nextParams }).then(r => r.data),
      });
    }
  }, [page, totalPages, debouncedSearch, selectedCategory, stockFilter, sortConfig, queryClient]);

  const handleSort = (key: SortableProductKey) => {
    setSortConfig(current => {
      if (!current || current.key !== key) {
        return { key, direction: 'asc' };
      }
      if (current.direction === 'asc') {
        return { key, direction: 'desc' };
      }
      return null;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === products.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(products.map(p => p.id)));
    }
  };

  const toggleSelectProduct = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleDelete = async () => {
    if (!deleteDialog.product) return;

    try {
      setDeleting(true);
      await api.delete(`/admin/products/${deleteDialog.product.id}`);
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setDeleteDialog({ open: false, product: null });
    } catch (error) {
      logger.error('Failed to delete product:', error);
    } finally {
      setDeleting(false);
    }
  };

  const handleBulkDelete = async () => {
    try {
      setDeleting(true);
      await Promise.all(
        Array.from(selectedIds).map(id => api.delete(`/admin/products/${id}`))
      );
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setSelectedIds(new Set());
      setBulkDeleteDialog(false);
    } catch (error) {
      logger.error('Failed to delete products:', error);
    } finally {
      setDeleting(false);
    }
  };

  const exportToCSV = () => {
    const headers = ['Title', 'Slug', 'Category', 'Price', 'Stock', 'Created'];
    const rows = products.map(p => {
      const stock = p.variants[0]?.stock ?? 0;
      const price = p.variants[0]?.price ?? 0;
      return [
        p.title,
        p.slug,
        p.category.name,
        price.toString(),
        stock.toString(),
        new Date(p.createdAt).toLocaleDateString(),
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `products-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const SortableHeader = ({
    label,
    sortKey,
    className,
  }: {
    label: string;
    sortKey: SortableProductKey;
    className?: string;
  }) => (
    <TableHead className={className}>
      <button
        onClick={() => handleSort(sortKey)}
        className="flex items-center gap-1 hover:text-foreground transition-colors"
      >
        {label}
        <ArrowUpDown className="w-4 h-4" />
      </button>
    </TableHead>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Products</h1>
          <p className="text-muted-foreground">Manage your product catalog</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
          <Button variant="outline" onClick={exportToCSV} disabled={products.length === 0} className="w-full sm:w-auto">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Button onClick={() => navigate('/products/new')} className="w-full sm:w-auto">
            <Plus className="w-4 h-4 mr-2" />
            Add Product
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative w-full sm:max-w-sm sm:flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>

        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map(cat => (
              <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={stockFilter} onValueChange={setStockFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Stock Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stock</SelectItem>
            <SelectItem value="in-stock">In Stock</SelectItem>
            <SelectItem value="low-stock">Low Stock (&lt;10)</SelectItem>
            <SelectItem value="out-of-stock">Out of Stock</SelectItem>
          </SelectContent>
        </Select>

        <p className="text-sm text-muted-foreground sm:ml-auto">
          {isFetching && <span className="animate-spin mr-1">⟳</span>}
          {total} {total === 1 ? 'product' : 'products'}
        </p>
      </div>

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <div className="flex flex-col gap-3 rounded-lg bg-muted p-4 sm:flex-row sm:items-center">
          <p className="text-sm font-medium">
            {selectedIds.size} {selectedIds.size === 1 ? 'product' : 'products'} selected
          </p>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setBulkDeleteDialog(true)}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Selected
          </Button>
          <Button variant="outline" size="sm" onClick={() => setSelectedIds(new Set())}>
            Clear Selection
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <Table className="w-full md:min-w-[920px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedIds.size === products.length && products.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <SortableHeader label="Product" sortKey="title" />
              <SortableHeader label="Category" sortKey="category" className="hidden md:table-cell" />
              <TableHead className="hidden md:table-cell">Status</TableHead>
              <SortableHeader label="Price" sortKey="price" className="hidden md:table-cell" />
              <SortableHeader label="Stock" sortKey="stock" className="hidden md:table-cell" />
              <TableHead className="w-[88px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && !productsData ? (
              // Skeleton rows
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><div className="h-4 w-4 bg-muted animate-pulse rounded" /></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 bg-muted animate-pulse rounded" />
                      <div className="space-y-2">
                        <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                        <div className="h-3 w-24 bg-muted animate-pulse rounded" />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell"><div className="h-6 w-20 bg-muted animate-pulse rounded" /></TableCell>
                  <TableCell className="hidden md:table-cell"><div className="h-6 w-16 bg-muted animate-pulse rounded" /></TableCell>
                  <TableCell className="hidden md:table-cell"><div className="h-6 w-16 bg-muted animate-pulse rounded" /></TableCell>
                  <TableCell className="hidden md:table-cell"><div className="h-6 w-12 bg-muted animate-pulse rounded" /></TableCell>
                  <TableCell className="text-right">
                    <div className="h-8 w-20 bg-muted animate-pulse rounded ml-auto" />
                  </TableCell>
                </TableRow>
              ))
            ) : products.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  {search ? 'No products found' : 'No products yet. Create your first one!'}
                </TableCell>
              </TableRow>
            ) : (
              products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(product.id)}
                      onCheckedChange={() => toggleSelectProduct(product.id)}
                    />
                  </TableCell>
                  <TableCell className="max-w-0">
                    <div className="flex min-w-0 items-start gap-3 md:items-center">
                      {product.variants[0]?.imagePath ? (
                        <img
                          src={product.variants[0].imagePath}
                          alt={product.title}
                          className="h-12 w-12 rounded object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded bg-muted flex items-center justify-center text-muted-foreground text-xs">
                          No image
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-medium leading-tight md:hidden" title={product.title}>
                          {product.title}
                        </p>
                        <p className="hidden font-medium break-words leading-tight md:block">{product.title}</p>
                        <p className="truncate text-xs text-muted-foreground md:hidden" title={product.slug}>
                          {product.slug}
                        </p>
                        <p className="hidden text-sm text-muted-foreground break-all md:block">{product.slug}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 md:hidden">
                          <Badge variant="secondary">{product.category.name}</Badge>
                          <Badge variant={resolvePublished(product) ? 'default' : 'secondary'}>
                            {resolvePublished(product) ? 'Published' : 'Draft'}
                          </Badge>
                          <Badge variant="outline">
                            ${parseFloat(String(product.variants[0]?.price ?? 0)).toFixed(2)}
                          </Badge>
                          <Badge variant={(product.variants[0]?.stock ?? 0) > 0 ? 'default' : 'destructive'}>
                            Stock {product.variants[0]?.stock ?? 0}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Badge variant="secondary">{product.category.name}</Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Select
                      value={resolvePublished(product) ? 'published' : 'draft'}
                      onValueChange={(value) => handleStatusChange(product, value === 'published')}
                      disabled={updatingStatusIds.has(product.id)}
                    >
                      <SelectTrigger className="h-8 w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="published">Published</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="hidden md:table-cell font-medium">
                    ${parseFloat(String(product.variants[0]?.price ?? 0)).toFixed(2)}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Badge variant={(product.variants[0]?.stock ?? 0) > 0 ? 'default' : 'destructive'}>
                      {product.variants[0]?.stock ?? 0}
                    </Badge>
                  </TableCell>
                  <TableCell className="align-top pt-4 text-right md:align-middle md:pt-2">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => navigate(`/product-wizard/${product.id}`)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setDeleteDialog({ open: true, product })}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </Button>

            {/* Page numbers */}
            <div className="flex gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (page <= 3) {
                  pageNum = i + 1;
                } else if (page >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = page - 2 + i;
                }

                return (
                  <Button
                    key={pageNum}
                    variant={page === pageNum ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPage(pageNum)}
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>

            <Button
              variant="outline"
              size="sm"
              disabled={page === totalPages}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog.open} onOpenChange={(open) => !deleting && setDeleteDialog({ open, product: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Product</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deleteDialog.product?.title}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialog({ open: false, product: null })}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Dialog */}
      <Dialog open={bulkDeleteDialog} onOpenChange={(open) => !deleting && setBulkDeleteDialog(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Multiple Products</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedIds.size} products? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBulkDeleteDialog(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleBulkDelete} disabled={deleting}>
              {deleting ? 'Deleting...' : `Delete ${selectedIds.size} Products`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
