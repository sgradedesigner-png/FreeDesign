import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from '@/components/ui/dialog';
import { Edit, Plus, Trash2 } from 'lucide-react';
const categorySchema = z.object({
    name: z.string().min(1, 'Name is required'),
    slug: z.string().min(1, 'Slug is required').regex(/^[a-z0-9-]+$/, 'Slug must be lowercase with hyphens'),
});
export default function CategoriesPage() {
    const queryClient = useQueryClient();
    const [formDialog, setFormDialog] = useState({
        open: false,
        category: null,
    });
    const [deleteDialog, setDeleteDialog] = useState({
        open: false,
        category: null,
    });
    const [submitting, setSubmitting] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const { register, handleSubmit, formState: { errors }, setValue, reset, } = useForm({
        resolver: zodResolver(categorySchema),
        defaultValues: {
            name: '',
            slug: '',
        },
    });
    // Fetch categories with React Query (cached)
    const { data: categories = [], isLoading: loading } = useQuery({
        queryKey: ['categories'],
        queryFn: async () => {
            const { data } = await api.get('/admin/categories');
            return data;
        },
        staleTime: 60000, // 1 min
        gcTime: 300000, // 5 min
    });
    const openCreateDialog = () => {
        reset({ name: '', slug: '' });
        setFormDialog({ open: true, category: null });
    };
    const openEditDialog = (category) => {
        setValue('name', category.name);
        setValue('slug', category.slug);
        setFormDialog({ open: true, category });
    };
    const closeFormDialog = () => {
        if (!submitting) {
            setFormDialog({ open: false, category: null });
            reset();
        }
    };
    const onSubmit = async (data) => {
        try {
            setSubmitting(true);
            if (formDialog.category) {
                // Update existing category
                await api.put(`/admin/categories/${formDialog.category.id}`, data);
            }
            else {
                // Create new category
                await api.post('/admin/categories', data);
            }
            queryClient.invalidateQueries({ queryKey: ['categories'] });
            closeFormDialog();
        }
        catch (error) {
            console.error('Failed to save category:', error);
            alert(error?.response?.data?.message || 'Failed to save category');
        }
        finally {
            setSubmitting(false);
        }
    };
    const handleDelete = async () => {
        if (!deleteDialog.category)
            return;
        try {
            setDeleting(true);
            await api.delete(`/admin/categories/${deleteDialog.category.id}`);
            queryClient.invalidateQueries({ queryKey: ['categories'] });
            setDeleteDialog({ open: false, category: null });
        }
        catch (error) {
            console.error('Failed to delete category:', error);
            alert(error?.response?.data?.message || 'Failed to delete category');
        }
        finally {
            setDeleting(false);
        }
    };
    const generateSlug = () => {
        const name = document.getElementById('name');
        if (name?.value) {
            const slug = name.value
                .toLowerCase()
                .replace(/[^a-z0-9\s-]/g, '')
                .replace(/\s+/g, '-')
                .replace(/-+/g, '-');
            setValue('slug', slug);
        }
    };
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl sm:text-3xl font-bold", children: "Categories" }), _jsx("p", { className: "text-muted-foreground", children: "Manage product categories" })] }), _jsxs(Button, { onClick: openCreateDialog, className: "w-full sm:w-auto", children: [_jsx(Plus, { className: "w-4 h-4 mr-2" }), "Add Category"] })] }), _jsx("div", { className: "overflow-hidden rounded-lg border bg-card", children: _jsx("div", { className: "overflow-x-auto", children: _jsxs(Table, { className: "min-w-[640px]", children: [_jsx(TableHeader, { children: _jsxs(TableRow, { children: [_jsx(TableHead, { children: "Name" }), _jsx(TableHead, { children: "Slug" }), _jsx(TableHead, { className: "text-right", children: "Actions" })] }) }), _jsx(TableBody, { children: loading ? (
                                // Skeleton rows
                                Array.from({ length: 3 }).map((_, i) => (_jsxs(TableRow, { children: [_jsx(TableCell, { children: _jsx("div", { className: "h-5 w-32 bg-muted animate-pulse rounded" }) }), _jsx(TableCell, { children: _jsx("div", { className: "h-5 w-40 bg-muted animate-pulse rounded" }) }), _jsx(TableCell, { className: "text-right", children: _jsx("div", { className: "h-8 w-20 bg-muted animate-pulse rounded ml-auto" }) })] }, i)))) : categories.length === 0 ? (_jsx(TableRow, { children: _jsx(TableCell, { colSpan: 3, className: "text-center py-8 text-muted-foreground", children: "No categories yet. Create your first one!" }) })) : (categories.map((category) => (_jsxs(TableRow, { children: [_jsx(TableCell, { className: "font-medium", children: category.name }), _jsx(TableCell, { className: "text-muted-foreground", children: category.slug }), _jsx(TableCell, { className: "text-right", children: _jsxs("div", { className: "flex items-center justify-end gap-2", children: [_jsx(Button, { variant: "ghost", size: "sm", onClick: () => openEditDialog(category), children: _jsx(Edit, { className: "w-4 h-4" }) }), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => setDeleteDialog({ open: true, category }), children: _jsx(Trash2, { className: "w-4 h-4 text-destructive" }) })] }) })] }, category.id)))) })] }) }) }), _jsx(Dialog, { open: formDialog.open, onOpenChange: (open) => !submitting && (open ? null : closeFormDialog()), children: _jsxs(DialogContent, { className: "max-w-[95vw] sm:max-w-lg", children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: formDialog.category ? 'Edit Category' : 'Create Category' }), _jsx(DialogDescription, { children: formDialog.category
                                        ? 'Update category information'
                                        : 'Add a new category to organize your products' })] }), _jsxs("form", { onSubmit: handleSubmit(onSubmit), className: "space-y-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "name", children: "Name *" }), _jsx(Input, { id: "name", ...register('name'), placeholder: "Enter category name" }), errors.name && _jsx("p", { className: "text-sm text-destructive", children: errors.name.message })] }), _jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx(Label, { htmlFor: "slug", children: "Slug *" }), _jsx(Button, { type: "button", variant: "link", size: "sm", onClick: generateSlug, children: "Generate from name" })] }), _jsx(Input, { id: "slug", ...register('slug'), placeholder: "category-slug" }), errors.slug && _jsx("p", { className: "text-sm text-destructive", children: errors.slug.message })] }), _jsxs(DialogFooter, { className: "flex-col gap-2 sm:flex-row sm:justify-end", children: [_jsx(Button, { type: "button", variant: "outline", onClick: closeFormDialog, disabled: submitting, children: "Cancel" }), _jsx(Button, { type: "submit", disabled: submitting, children: submitting ? 'Saving...' : formDialog.category ? 'Update' : 'Create' })] })] })] }) }), _jsx(Dialog, { open: deleteDialog.open, onOpenChange: (open) => !deleting && setDeleteDialog({ open, category: null }), children: _jsxs(DialogContent, { className: "max-w-[95vw] sm:max-w-lg", children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: "Delete Category" }), _jsxs(DialogDescription, { children: ["Are you sure you want to delete \"", deleteDialog.category?.name, "\"? This action cannot be undone. Categories with products cannot be deleted."] })] }), _jsxs(DialogFooter, { className: "flex-col gap-2 sm:flex-row sm:justify-end", children: [_jsx(Button, { variant: "outline", onClick: () => setDeleteDialog({ open: false, category: null }), disabled: deleting, children: "Cancel" }), _jsx(Button, { variant: "destructive", onClick: handleDelete, disabled: deleting, children: deleting ? 'Deleting...' : 'Delete' })] })] }) })] }));
}
