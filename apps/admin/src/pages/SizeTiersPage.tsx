import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, Plus, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

type SizeTier = {
  id: string;
  name: string;
  label: string;
  widthCm: number;
  heightCm: number;
  sortOrder: number;
  isActive: boolean;
};

type SizeTiersResponse = {
  tiers: SizeTier[];
};

type FormState = {
  name: string;
  label: string;
  widthCm: string;
  heightCm: string;
  sortOrder: string;
  isActive: boolean;
};

const defaultForm: FormState = {
  name: '',
  label: '',
  widthCm: '10',
  heightCm: '10',
  sortOrder: '0',
  isActive: true,
};

export default function SizeTiersPage() {
  const queryClient = useQueryClient();
  const [includeInactive, setIncludeInactive] = useState(true);
  const [dialogState, setDialogState] = useState<{
    open: boolean;
    mode: 'create' | 'edit';
    id: string | null;
    form: FormState;
  }>({
    open: false,
    mode: 'create',
    id: null,
    form: defaultForm,
  });

  const { data, isLoading, isFetching } = useQuery<SizeTiersResponse>({
    queryKey: ['admin-size-tiers', includeInactive],
    queryFn: async () => {
      const res = await api.get<SizeTiersResponse>('/api/admin/size-tiers', {
        params: { includeInactive },
      });
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: any) => api.post('/api/admin/size-tiers', payload),
    onSuccess: () => {
      toast.success('Size tier created');
      queryClient.invalidateQueries({ queryKey: ['admin-size-tiers'] });
      setDialogState({ open: false, mode: 'create', id: null, form: defaultForm });
    },
    onError: (error: any) => toast.error(error?.response?.data?.error || 'Failed to create size tier'),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: any }) =>
      api.put(`/api/admin/size-tiers/${id}`, payload),
    onSuccess: () => {
      toast.success('Size tier updated');
      queryClient.invalidateQueries({ queryKey: ['admin-size-tiers'] });
      setDialogState({ open: false, mode: 'create', id: null, form: defaultForm });
    },
    onError: (error: any) => toast.error(error?.response?.data?.error || 'Failed to update size tier'),
  });

  const deactivateMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/api/admin/size-tiers/${id}`),
    onSuccess: () => {
      toast.success('Size tier deactivated');
      queryClient.invalidateQueries({ queryKey: ['admin-size-tiers'] });
    },
    onError: (error: any) => toast.error(error?.response?.data?.error || 'Failed to deactivate size tier'),
  });

  const submitting = createMutation.isPending || updateMutation.isPending;
  const tiers = data?.tiers ?? [];

  const payload = useMemo(() => ({
    name: dialogState.form.name.trim(),
    label: dialogState.form.label.trim(),
    widthCm: Number(dialogState.form.widthCm || 0),
    heightCm: Number(dialogState.form.heightCm || 0),
    sortOrder: Number(dialogState.form.sortOrder || 0),
    isActive: dialogState.form.isActive,
  }), [dialogState.form]);

  const canSubmit =
    payload.name.length > 0 &&
    payload.label.length > 0 &&
    Number.isFinite(payload.widthCm) &&
    payload.widthCm > 0 &&
    Number.isFinite(payload.heightCm) &&
    payload.heightCm > 0;

  const openCreate = () => {
    setDialogState({
      open: true,
      mode: 'create',
      id: null,
      form: defaultForm,
    });
  };

  const openEdit = (tier: SizeTier) => {
    setDialogState({
      open: true,
      mode: 'edit',
      id: tier.id,
      form: {
        name: tier.name,
        label: tier.label,
        widthCm: String(tier.widthCm),
        heightCm: String(tier.heightCm),
        sortOrder: String(tier.sortOrder),
        isActive: tier.isActive,
      },
    });
  };

  const submit = () => {
    if (!canSubmit) return;
    if (dialogState.mode === 'create') {
      createMutation.mutate(payload);
      return;
    }
    if (!dialogState.id) return;
    updateMutation.mutate({ id: dialogState.id, payload });
  };

  const toggleStatus = (tier: SizeTier) => {
    if (tier.isActive) {
      deactivateMutation.mutate(tier.id);
      return;
    }
    updateMutation.mutate({ id: tier.id, payload: { isActive: true } });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Size Tiers</h1>
          <p className="text-muted-foreground">Manage standard print size options used in pricing and production</p>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['admin-size-tiers'] })}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button className="w-full sm:w-auto" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            New Size Tier
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant={includeInactive ? 'default' : 'outline'}
          size="sm"
          onClick={() => setIncludeInactive((prev) => !prev)}
        >
          {includeInactive ? 'Including inactive' : 'Active only'}
        </Button>
        <p className="text-sm text-muted-foreground">
          {tiers.length} tier{tiers.length === 1 ? '' : 's'}
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <Table className="w-full md:min-w-[840px]">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Label</TableHead>
                <TableHead>Width (cm)</TableHead>
                <TableHead>Height (cm)</TableHead>
                <TableHead>Sort</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    Loading size tiers...
                  </TableCell>
                </TableRow>
              ) : tiers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    No size tiers found
                  </TableCell>
                </TableRow>
              ) : (
                tiers.map((tier) => (
                  <TableRow key={tier.id}>
                    <TableCell className="font-medium">{tier.name}</TableCell>
                    <TableCell>{tier.label}</TableCell>
                    <TableCell>{tier.widthCm}</TableCell>
                    <TableCell>{tier.heightCm}</TableCell>
                    <TableCell>{tier.sortOrder}</TableCell>
                    <TableCell>
                      <Badge variant={tier.isActive ? 'default' : 'secondary'}>
                        {tier.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => openEdit(tier)}>
                          Edit
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => toggleStatus(tier)}>
                          {tier.isActive ? 'Deactivate' : 'Activate'}
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

      <Dialog
        open={dialogState.open}
        onOpenChange={(open) => setDialogState((prev) => ({ ...prev, open }))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogState.mode === 'create' ? 'New Size Tier' : 'Edit Size Tier'}</DialogTitle>
            <DialogDescription>
              Define a print size tier used for pricing and production options.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Name (unique key)</Label>
              <Input
                value={dialogState.form.name}
                onChange={(e) =>
                  setDialogState((prev) => ({ ...prev, form: { ...prev.form, name: e.target.value } }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Label</Label>
              <Input
                value={dialogState.form.label}
                onChange={(e) =>
                  setDialogState((prev) => ({ ...prev, form: { ...prev.form, label: e.target.value } }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Width (cm)</Label>
              <Input
                type="number"
                step="0.1"
                value={dialogState.form.widthCm}
                onChange={(e) =>
                  setDialogState((prev) => ({ ...prev, form: { ...prev.form, widthCm: e.target.value } }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Height (cm)</Label>
              <Input
                type="number"
                step="0.1"
                value={dialogState.form.heightCm}
                onChange={(e) =>
                  setDialogState((prev) => ({ ...prev, form: { ...prev.form, heightCm: e.target.value } }))
                }
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Sort Order</Label>
              <Input
                type="number"
                value={dialogState.form.sortOrder}
                onChange={(e) =>
                  setDialogState((prev) => ({ ...prev, form: { ...prev.form, sortOrder: e.target.value } }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogState((prev) => ({ ...prev, open: false }))}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={!canSubmit || submitting}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {dialogState.mode === 'create' ? 'Create' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

