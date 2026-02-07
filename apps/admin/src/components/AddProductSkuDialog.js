import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
export default function AddProductSkuDialog({ open, onOpenChange }) {
    const navigate = useNavigate();
    const [sku, setSku] = useState('');
    const [error, setError] = useState(null);
    const handleContinue = () => {
        const trimmed = sku.trim().toUpperCase().replace(/\s+/g, '');
        if (!trimmed) {
            setError('SKU is required');
            return;
        }
        setError(null);
        onOpenChange(false);
        navigate(`/products/new?prefill=nike&sku=${encodeURIComponent(trimmed)}`);
    };
    return (_jsx(Dialog, { open: open, onOpenChange: onOpenChange, children: _jsxs(DialogContent, { children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: "Add product by SKU" }), _jsx(DialogDescription, { children: "Enter a Nike SKU to prefill product details." })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "sku", children: "SKU" }), _jsx(Input, { id: "sku", placeholder: "IO9571-400", value: sku, onChange: (e) => setSku(e.target.value) }), error && _jsx("p", { className: "text-sm text-destructive", children: error })] }), _jsxs(DialogFooter, { children: [_jsx(Button, { variant: "outline", onClick: () => onOpenChange(false), children: "Cancel" }), _jsx(Button, { onClick: handleContinue, children: "Continue" })] })] }) }));
}
