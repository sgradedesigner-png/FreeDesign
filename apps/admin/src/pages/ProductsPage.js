import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Edit, Plus, Search, Trash2, Download, ArrowUpDown } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import AddProductSkuDialog from '@/components/AddProductSkuDialog';
export default function ProductsPage() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [categories, setCategories] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [stockFilter, setStockFilter] = useState('all');
    const [sortConfig, setSortConfig] = useState(null);
    const [deleteDialog, setDeleteDialog] = useState({
        open: false,
        product: null,
    });
    const [bulkDeleteDialog, setBulkDeleteDialog] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [skuDialogOpen, setSkuDialogOpen] = useState(false);
    const debouncedSearch = useDebounce(search, 500);
    useEffect(() => {
        fetchCategories();
    }, []);
    const fetchCategories = async () => {
        try {
            const { data } = await api.get('/admin/categories');
            setCategories(data);
        }
        catch (error) {
            console.error('Failed to fetch categories:', error);
        }
    };
    // React Query for products with caching and prefetching
    const { data: productsData, isLoading: loading, isFetching, } = useQuery({
        queryKey: ['products', page, debouncedSearch, selectedCategory, stockFilter, sortConfig],
        queryFn: async () => {
            const params = {
                page,
                limit: 20,
            };
            if (debouncedSearch)
                params.q = debouncedSearch;
            if (selectedCategory !== 'all')
                params.categoryId = selectedCategory;
            if (stockFilter !== 'all')
                params.stock = stockFilter;
            if (sortConfig) {
                params.sortBy = sortConfig.key === 'category' ? 'category' : sortConfig.key;
                params.sortOrder = sortConfig.direction;
            }
            const { data } = await api.get('/admin/products', { params });
            return data;
        },
        placeholderData: (prev) => prev, // Keep previous data while fetching
    });
    const products = productsData?.items ?? [];
    const totalPages = productsData?.pages ?? 1;
    const total = productsData?.total ?? 0;
    const resolvePublished = (product) => Boolean(product.is_published ?? product.isPublished ?? false);
    // Prefetch next page
    useEffect(() => {
        if (page < totalPages) {
            const nextParams = {
                page: page + 1,
                limit: 20,
            };
            if (debouncedSearch)
                nextParams.q = debouncedSearch;
            if (selectedCategory !== 'all')
                nextParams.categoryId = selectedCategory;
            if (stockFilter !== 'all')
                nextParams.stock = stockFilter;
            if (sortConfig) {
                nextParams.sortBy = sortConfig.key === 'category' ? 'category' : sortConfig.key;
                nextParams.sortOrder = sortConfig.direction;
            }
            queryClient.prefetchQuery({
                queryKey: ['products', page + 1, debouncedSearch, selectedCategory, stockFilter, sortConfig],
                queryFn: () => api.get('/admin/products', { params: nextParams }).then(r => r.data),
            });
        }
    }, [page, totalPages, debouncedSearch, selectedCategory, stockFilter, sortConfig, queryClient]);
    const handleSort = (key) => {
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
        }
        else {
            setSelectedIds(new Set(products.map(p => p.id)));
        }
    };
    const toggleSelectProduct = (id) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        }
        else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };
    const handleDelete = async () => {
        if (!deleteDialog.product)
            return;
        try {
            setDeleting(true);
            await api.delete(`/admin/products/${deleteDialog.product.id}`);
            queryClient.invalidateQueries({ queryKey: ['products'] });
            setDeleteDialog({ open: false, product: null });
        }
        catch (error) {
            console.error('Failed to delete product:', error);
        }
        finally {
            setDeleting(false);
        }
    };
    const handleBulkDelete = async () => {
        try {
            setDeleting(true);
            await Promise.all(Array.from(selectedIds).map(id => api.delete(`/admin/products/${id}`)));
            queryClient.invalidateQueries({ queryKey: ['products'] });
            setSelectedIds(new Set());
            setBulkDeleteDialog(false);
        }
        catch (error) {
            console.error('Failed to delete products:', error);
        }
        finally {
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
    const SortableHeader = ({ label, sortKey, className, }) => (_jsx(TableHead, { className: className, children: _jsxs("button", { onClick: () => handleSort(sortKey), className: "flex items-center gap-1 hover:text-foreground transition-colors", children: [label, _jsx(ArrowUpDown, { className: "w-4 h-4" })] }) }));
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl sm:text-3xl font-bold", children: "Products" }), _jsx("p", { className: "text-muted-foreground", children: "Manage your product catalog" })] }), _jsxs("div", { className: "flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap", children: [_jsxs(Button, { variant: "outline", onClick: exportToCSV, disabled: products.length === 0, className: "w-full sm:w-auto", children: [_jsx(Download, { className: "w-4 h-4 mr-2" }), "Export CSV"] }), _jsxs(Button, { variant: "outline", onClick: () => setSkuDialogOpen(true), className: "w-full sm:w-auto", children: [_jsx(Plus, { className: "w-4 h-4 mr-2" }), "Add Product SKU"] }), _jsxs(Button, { onClick: () => navigate('/products/new'), className: "w-full sm:w-auto", children: [_jsx(Plus, { className: "w-4 h-4 mr-2" }), "Add Product"] })] })] }), _jsxs("div", { className: "flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center", children: [_jsxs("div", { className: "relative w-full sm:max-w-sm sm:flex-1", children: [_jsx(Search, { className: "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" }), _jsx(Input, { placeholder: "Search products...", value: search, onChange: (e) => {
                                    setSearch(e.target.value);
                                    setPage(1);
                                }, className: "pl-9" })] }), _jsxs(Select, { value: selectedCategory, onValueChange: setSelectedCategory, children: [_jsx(SelectTrigger, { className: "w-full sm:w-[180px]", children: _jsx(SelectValue, { placeholder: "All Categories" }) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "all", children: "All Categories" }), categories.map(cat => (_jsx(SelectItem, { value: cat.id, children: cat.name }, cat.id)))] })] }), _jsxs(Select, { value: stockFilter, onValueChange: setStockFilter, children: [_jsx(SelectTrigger, { className: "w-full sm:w-[180px]", children: _jsx(SelectValue, { placeholder: "Stock Status" }) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "all", children: "All Stock" }), _jsx(SelectItem, { value: "in-stock", children: "In Stock" }), _jsx(SelectItem, { value: "low-stock", children: "Low Stock (<10)" }), _jsx(SelectItem, { value: "out-of-stock", children: "Out of Stock" })] })] }), _jsxs("p", { className: "text-sm text-muted-foreground sm:ml-auto", children: [isFetching && _jsx("span", { className: "animate-spin mr-1", children: "\u27F3" }), total, " ", total === 1 ? 'product' : 'products'] })] }), selectedIds.size > 0 && (_jsxs("div", { className: "flex flex-col gap-3 rounded-lg bg-muted p-4 sm:flex-row sm:items-center", children: [_jsxs("p", { className: "text-sm font-medium", children: [selectedIds.size, " ", selectedIds.size === 1 ? 'product' : 'products', " selected"] }), _jsxs(Button, { variant: "destructive", size: "sm", onClick: () => setBulkDeleteDialog(true), children: [_jsx(Trash2, { className: "w-4 h-4 mr-2" }), "Delete Selected"] }), _jsx(Button, { variant: "outline", size: "sm", onClick: () => setSelectedIds(new Set()), children: "Clear Selection" })] })), _jsx("div", { className: "overflow-hidden rounded-lg border bg-card", children: _jsx("div", { className: "overflow-x-auto", children: _jsxs(Table, { className: "w-full md:min-w-[920px]", children: [_jsx(TableHeader, { children: _jsxs(TableRow, { children: [_jsx(TableHead, { className: "w-12", children: _jsx(Checkbox, { checked: selectedIds.size === products.length && products.length > 0, onCheckedChange: toggleSelectAll }) }), _jsx(SortableHeader, { label: "Product", sortKey: "title" }), _jsx(SortableHeader, { label: "Category", sortKey: "category", className: "hidden md:table-cell" }), _jsx(TableHead, { className: "hidden md:table-cell", children: "Status" }), _jsx(SortableHeader, { label: "Price", sortKey: "price", className: "hidden md:table-cell" }), _jsx(SortableHeader, { label: "Stock", sortKey: "stock", className: "hidden md:table-cell" }), _jsx(TableHead, { className: "w-[88px] text-right", children: "Actions" })] }) }), _jsx(TableBody, { children: loading && !productsData ? (
                                // Skeleton rows
                                Array.from({ length: 5 }).map((_, i) => (_jsxs(TableRow, { children: [_jsx(TableCell, { children: _jsx("div", { className: "h-4 w-4 bg-muted animate-pulse rounded" }) }), _jsx(TableCell, { children: _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "h-12 w-12 bg-muted animate-pulse rounded" }), _jsxs("div", { className: "space-y-2", children: [_jsx("div", { className: "h-4 w-32 bg-muted animate-pulse rounded" }), _jsx("div", { className: "h-3 w-24 bg-muted animate-pulse rounded" })] })] }) }), _jsx(TableCell, { className: "hidden md:table-cell", children: _jsx("div", { className: "h-6 w-20 bg-muted animate-pulse rounded" }) }), _jsx(TableCell, { className: "hidden md:table-cell", children: _jsx("div", { className: "h-6 w-16 bg-muted animate-pulse rounded" }) }), _jsx(TableCell, { className: "hidden md:table-cell", children: _jsx("div", { className: "h-6 w-16 bg-muted animate-pulse rounded" }) }), _jsx(TableCell, { className: "hidden md:table-cell", children: _jsx("div", { className: "h-6 w-12 bg-muted animate-pulse rounded" }) }), _jsx(TableCell, { className: "text-right", children: _jsx("div", { className: "h-8 w-20 bg-muted animate-pulse rounded ml-auto" }) })] }, i)))) : products.length === 0 ? (_jsx(TableRow, { children: _jsx(TableCell, { colSpan: 7, className: "text-center py-8 text-muted-foreground", children: search ? 'No products found' : 'No products yet. Create your first one!' }) })) : (products.map((product) => (_jsxs(TableRow, { children: [_jsx(TableCell, { children: _jsx(Checkbox, { checked: selectedIds.has(product.id), onCheckedChange: () => toggleSelectProduct(product.id) }) }), _jsx(TableCell, { className: "max-w-0", children: _jsxs("div", { className: "flex min-w-0 items-start gap-3 md:items-center", children: [product.variants[0]?.imagePath ? (_jsx("img", { src: product.variants[0].imagePath, alt: product.title, className: "h-12 w-12 rounded object-cover", loading: "lazy" })) : (_jsx("div", { className: "w-12 h-12 rounded bg-muted flex items-center justify-center text-muted-foreground text-xs", children: "No image" })), _jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "font-medium leading-tight md:hidden", style: {
                                                                    display: '-webkit-box',
                                                                    WebkitLineClamp: 2,
                                                                    WebkitBoxOrient: 'vertical',
                                                                    overflow: 'hidden',
                                                                }, title: product.title, children: product.title }), _jsx("p", { className: "hidden font-medium break-words leading-tight md:block", children: product.title }), _jsx("p", { className: "truncate text-xs text-muted-foreground md:hidden", title: product.slug, children: product.slug }), _jsx("p", { className: "hidden text-sm text-muted-foreground break-all md:block", children: product.slug }), _jsxs("div", { className: "mt-2 flex flex-wrap items-center gap-2 md:hidden", children: [_jsx(Badge, { variant: "secondary", children: product.category.name }), _jsx(Badge, { variant: resolvePublished(product) ? 'default' : 'secondary', children: resolvePublished(product) ? 'Published' : 'Draft' }), _jsxs(Badge, { variant: "outline", children: ["$", parseFloat(String(product.variants[0]?.price ?? 0)).toFixed(2)] }), _jsxs(Badge, { variant: (product.variants[0]?.stock ?? 0) > 0 ? 'default' : 'destructive', children: ["Stock ", product.variants[0]?.stock ?? 0] })] })] })] }) }), _jsx(TableCell, { className: "hidden md:table-cell", children: _jsx(Badge, { variant: "secondary", children: product.category.name }) }), _jsx(TableCell, { className: "hidden md:table-cell", children: _jsx(Badge, { variant: resolvePublished(product) ? 'default' : 'secondary', children: resolvePublished(product) ? 'Published' : 'Draft' }) }), _jsxs(TableCell, { className: "hidden md:table-cell font-medium", children: ["$", parseFloat(String(product.variants[0]?.price ?? 0)).toFixed(2)] }), _jsx(TableCell, { className: "hidden md:table-cell", children: _jsx(Badge, { variant: (product.variants[0]?.stock ?? 0) > 0 ? 'default' : 'destructive', children: product.variants[0]?.stock ?? 0 }) }), _jsx(TableCell, { className: "align-top pt-4 text-right md:align-middle md:pt-2", children: _jsxs("div", { className: "flex items-center justify-end gap-2", children: [_jsx(Button, { variant: "ghost", size: "icon", className: "h-8 w-8", onClick: () => navigate(`/products/${product.id}`), children: _jsx(Edit, { className: "w-4 h-4" }) }), _jsx(Button, { variant: "ghost", size: "icon", className: "h-8 w-8", onClick: () => setDeleteDialog({ open: true, product }), children: _jsx(Trash2, { className: "w-4 h-4 text-destructive" }) })] }) })] }, product.id)))) })] }) }) }), totalPages > 1 && (_jsxs("div", { className: "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", children: [_jsxs("p", { className: "text-sm text-muted-foreground", children: ["Page ", page, " of ", totalPages] }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsx(Button, { variant: "outline", size: "sm", disabled: page === 1, onClick: () => setPage(page - 1), children: "Previous" }), _jsx("div", { className: "flex gap-1", children: Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                    let pageNum;
                                    if (totalPages <= 5) {
                                        pageNum = i + 1;
                                    }
                                    else if (page <= 3) {
                                        pageNum = i + 1;
                                    }
                                    else if (page >= totalPages - 2) {
                                        pageNum = totalPages - 4 + i;
                                    }
                                    else {
                                        pageNum = page - 2 + i;
                                    }
                                    return (_jsx(Button, { variant: page === pageNum ? 'default' : 'outline', size: "sm", onClick: () => setPage(pageNum), children: pageNum }, pageNum));
                                }) }), _jsx(Button, { variant: "outline", size: "sm", disabled: page === totalPages, onClick: () => setPage(page + 1), children: "Next" })] })] })), _jsx(Dialog, { open: deleteDialog.open, onOpenChange: (open) => !deleting && setDeleteDialog({ open, product: null }), children: _jsxs(DialogContent, { children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: "Delete Product" }), _jsxs(DialogDescription, { children: ["Are you sure you want to delete \"", deleteDialog.product?.title, "\"? This action cannot be undone."] })] }), _jsxs(DialogFooter, { children: [_jsx(Button, { variant: "outline", onClick: () => setDeleteDialog({ open: false, product: null }), disabled: deleting, children: "Cancel" }), _jsx(Button, { variant: "destructive", onClick: handleDelete, disabled: deleting, children: deleting ? 'Deleting...' : 'Delete' })] })] }) }), _jsx(Dialog, { open: bulkDeleteDialog, onOpenChange: (open) => !deleting && setBulkDeleteDialog(open), children: _jsxs(DialogContent, { children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: "Delete Multiple Products" }), _jsxs(DialogDescription, { children: ["Are you sure you want to delete ", selectedIds.size, " products? This action cannot be undone."] })] }), _jsxs(DialogFooter, { children: [_jsx(Button, { variant: "outline", onClick: () => setBulkDeleteDialog(false), disabled: deleting, children: "Cancel" }), _jsx(Button, { variant: "destructive", onClick: handleBulkDelete, disabled: deleting, children: deleting ? 'Deleting...' : `Delete ${selectedIds.size} Products` })] })] }) }), _jsx(AddProductSkuDialog, { open: skuDialogOpen, onOpenChange: setSkuDialogOpen })] }));
}
