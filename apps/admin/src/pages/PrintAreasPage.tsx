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

type PrintArea = {
  id: string;
  name: string;
  label: string;
  labelEn?: string | null;
  maxWidthCm: number;
  maxHeightCm: number;
  sortOrder: number;
  isActive: boolean;
};

type PrintAreasResponse = {
  areas: PrintArea[];
};

type FormState = {
  name: string;
  label: string;
  labelEn: string;
  maxWidthCm: string;
  maxHeightCm: string;
  sortOrder: string;
  isActive: boolean;
};

const defaultForm: FormState = {
  name: '',
  label: '',
  labelEn: '',
  maxWidthCm: '30',
  maxHeightCm: '40',
  sortOrder: '0',
  isActive: true,
};

export default function PrintAreasPage() {
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

  const { data, isLoading, isFetching } = useQuery<PrintAreasResponse>({
    queryKey: ['admin-print-areas', includeInactive],
    queryFn: async () => {
      const res = await api.get<PrintAreasResponse>('/api/admin/print-areas', {
        params: { includeInactive },
      });
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: any) => api.post('/api/admin/print-areas', payload),
    onSuccess: () => {
      toast.success('Print area created');
      queryClient.invalidateQueries({ queryKey: ['admin-print-areas'] });
      setDialogState({ open: false, mode: 'create', id: null, form: defaultForm });
    },
    onError: (error: any) => toast.error(error?.response?.data?.error || 'Failed to create print area'),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: any }) =>
      api.put(`/api/admin/print-areas/${id}`, payload),
    onSuccess: () => {
      toast.success('Print area updated');
      queryClient.invalidateQueries({ queryKey: ['admin-print-areas'] });
      setDialogState({ open: false, mode: 'create', id: null, form: defaultForm });
    },
    onError: (error: any) => toast.error(error?.response?.data?.error || 'Failed to update print area'),
  });

  const deactivateMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/api/admin/print-areas/${id}`),
    onSuccess: () => {
      toast.success('Print area deactivated');
      queryClient.invalidateQueries({ queryKey: ['admin-print-areas'] });
    },
    onError: (error: any) => toast.error(error?.response?.data?.error || 'Failed to deactivate print area'),
  });

  const submitting = createMutation.isPending || updateMutation.isPending;
  const areas = data?.areas ?? [];

  const payload = useMemo(() => ({
    name: dialogState.form.name.trim(),
    label: dialogState.form.label.trim(),
    labelEn: dialogState.form.labelEn.trim() || null,
    maxWidthCm: Number(dialogState.form.maxWidthCm || 0),
    maxHeightCm: Number(dialogState.form.maxHeightCm || 0),
    sortOrder: Number(dialogState.form.sortOrder || 0),
    isActive: dialogState.form.isActive,
  }), [dialogState.form]);

  const canSubmit =
    payload.name.length > 0 &&
    payload.label.length > 0 &&
    Number.isFinite(payload.maxWidthCm) &&
    payload.maxWidthCm > 0 &&
    Number.isFinite(payload.maxHeightCm) &&
    payload.maxHeightCm > 0;

  const openCreate = () => {
    setDialogState({
      open: true,
      mode: 'create',
      id: null,
      form: defaultForm,
    });
  };

  const openEdit = (area: PrintArea) => {
    setDialogState({
      open: true,
      mode: 'edit',
      id: area.id,
      form: {
        name: area.name,
        label: area.label,
        labelEn: area.labelEn ?? '',
        maxWidthCm: String(area.maxWidthCm),
        maxHeightCm: String(area.maxHeightCm),
        sortOrder: String(area.sortOrder),
        isActive: area.isActive,
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

  const toggleStatus = (area: PrintArea) => {
    if (area.isActive) {
      deactivateMutation.mutate(area.id);
      return;
    }
    updateMutation.mutate({ id: area.id, payload: { isActive: true } });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Print Areas</h1>
          <p className="text-muted-foreground">Manage printable placement zones (max width/height in cm)</p>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['admin-print-areas'] })}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button className="w-full sm:w-auto" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            New Print Area
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
          {areas.length} area{areas.length === 1 ? '' : 's'}
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <Table className="w-full md:min-w-[900px]">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Label (MN)</TableHead>
                <TableHead>Label (EN)</TableHead>
                <TableHead>Max Width (cm)</TableHead>
                <TableHead>Max Height (cm)</TableHead>
                <TableHead>Sort</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                    Loading print areas...
                  </TableCell>
                </TableRow>
              ) : areas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                    No print areas found
                  </TableCell>
                </TableRow>
              ) : (
                areas.map((area) => (
                  <TableRow key={area.id}>
                    <TableCell className="font-medium">{area.name}</TableCell>
                    <TableCell>{area.label}</TableCell>
                    <TableCell>{area.labelEn ?? '-'}</TableCell>
                    <TableCell>{area.maxWidthCm}</TableCell>
                    <TableCell>{area.maxHeightCm}</TableCell>
                    <TableCell>{area.sortOrder}</TableCell>
                    <TableCell>
                      <Badge variant={area.isActive ? 'default' : 'secondary'}>
                        {area.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => openEdit(area)}>
                          Edit
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => toggleStatus(area)}>
                          {area.isActive ? 'Deactivate' : 'Activate'}
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
            <DialogTitle>{dialogState.mode === 'create' ? 'New Print Area' : 'Edit Print Area'}</DialogTitle>
            <DialogDescription>
              Define a printable zone and its production max size constraints.
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
              <Label>Sort Order</Label>
              <Input
                type="number"
                value={dialogState.form.sortOrder}
                onChange={(e) =>
                  setDialogState((prev) => ({ ...prev, form: { ...prev.form, sortOrder: e.target.value } }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Label (MN)</Label>
              <Input
                value={dialogState.form.label}
                onChange={(e) =>
                  setDialogState((prev) => ({ ...prev, form: { ...prev.form, label: e.target.value } }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Label (EN)</Label>
              <Input
                value={dialogState.form.labelEn}
                onChange={(e) =>
                  setDialogState((prev) => ({ ...prev, form: { ...prev.form, labelEn: e.target.value } }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Max Width (cm)</Label>
              <Input
                type="number"
                step="0.1"
                value={dialogState.form.maxWidthCm}
                onChange={(e) =>
                  setDialogState((prev) => ({ ...prev, form: { ...prev.form, maxWidthCm: e.target.value } }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Max Height (cm)</Label>
              <Input
                type="number"
                step="0.1"
                value={dialogState.form.maxHeightCm}
                onChange={(e) =>
                  setDialogState((prev) => ({ ...prev, form: { ...prev.form, maxHeightCm: e.target.value } }))
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

