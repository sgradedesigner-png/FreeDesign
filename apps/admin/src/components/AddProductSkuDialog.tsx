import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type AddProductSkuDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function AddProductSkuDialog({ open, onOpenChange }: AddProductSkuDialogProps) {
  const navigate = useNavigate();
  const [sku, setSku] = useState('');
  const [error, setError] = useState<string | null>(null);

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add product by SKU</DialogTitle>
          <DialogDescription>
            Enter a Nike SKU to prefill product details.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="sku">SKU</Label>
          <Input
            id="sku"
            placeholder="IO9571-400"
            value={sku}
            onChange={(e) => setSku(e.target.value)}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleContinue}>Continue</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
