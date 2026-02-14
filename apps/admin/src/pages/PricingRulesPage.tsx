import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

const ruleTypes = ['PRINT_FEE', 'EXTRA_SIDE', 'QUANTITY_DISCOUNT', 'RUSH_FEE', 'ADD_ON'] as const;
type RuleType = (typeof ruleTypes)[number];

type PrintArea = {
  id: string;
  label: string;
};

type PrintSizeTier = {
  id: string;
  label: string;
};

type PricingRule = {
  id: string;
  name: string;
  ruleType: RuleType;
  printSizeTierId: string | null;
  printAreaId: string | null;
  minQuantity: number | null;
  maxQuantity: number | null;
  price: string;
  discountPercent: number | null;
  isActive: boolean;
  createdAt: string;
  printArea: PrintArea | null;
  printSizeTier: PrintSizeTier | null;
};

type PricingRulesResponse = {
  rules: PricingRule[];
  printAreas: PrintArea[];
  printSizeTiers: PrintSizeTier[];
};

type FormState = {
  name: string;
  ruleType: RuleType;
  printSizeTierId: string;
  printAreaId: string;
  minQuantity: string;
  maxQuantity: string;
  price: string;
  discountPercent: string;
  isActive: boolean;
};

const defaultFormState: FormState = {
  name: '',
  ruleType: 'PRINT_FEE',
  printSizeTierId: 'NONE',
  printAreaId: 'NONE',
  minQuantity: '',
  maxQuantity: '',
  price: '0',
  discountPercent: '',
  isActive: true,
};

function parseOptionalNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatRuleType(value: RuleType): string {
  if (value === 'PRINT_FEE') return 'Print Fee';
  if (value === 'EXTRA_SIDE') return 'Extra Side';
  if (value === 'QUANTITY_DISCOUNT') return 'Quantity Discount';
  if (value === 'ADD_ON') return 'Add-on';
  return 'Rush Fee';
}

export default function PricingRulesPage() {
  const queryClient = useQueryClient();
  const [includeInactive, setIncludeInactive] = useState(true);

  const [dialogState, setDialogState] = useState<{
    open: boolean;
    mode: 'create' | 'edit';
    ruleId: string | null;
    form: FormState;
  }>({
    open: false,
    mode: 'create',
    ruleId: null,
    form: defaultFormState,
  });

  const { data, isLoading, isFetching } = useQuery<PricingRulesResponse>({
    queryKey: ['pricing-rules', includeInactive],
    queryFn: async () => {
      const response = await api.get<PricingRulesResponse>('/admin/pricing/rules', {
        params: { includeInactive },
      });
      return response.data;
    },
  });

  const createRuleMutation = useMutation({
    mutationFn: async (payload: any) => {
      await api.post('/admin/pricing/rules', payload);
    },
    onSuccess: () => {
      toast.success('Pricing rule created');
      queryClient.invalidateQueries({ queryKey: ['pricing-rules'] });
      setDialogState({ open: false, mode: 'create', ruleId: null, form: defaultFormState });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to create pricing rule');
    },
  });

  const updateRuleMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: any }) => {
      await api.put(`/admin/pricing/rules/${id}`, payload);
    },
    onSuccess: () => {
      toast.success('Pricing rule updated');
      queryClient.invalidateQueries({ queryKey: ['pricing-rules'] });
      setDialogState({ open: false, mode: 'create', ruleId: null, form: defaultFormState });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to update pricing rule');
    },
  });

  const deactivateRuleMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/admin/pricing/rules/${id}`);
    },
    onSuccess: () => {
      toast.success('Pricing rule deactivated');
      queryClient.invalidateQueries({ queryKey: ['pricing-rules'] });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to deactivate pricing rule');
    },
  });

  const rules = data?.rules ?? [];
  const printAreas = data?.printAreas ?? [];
  const printSizeTiers = data?.printSizeTiers ?? [];

  const submitting = createRuleMutation.isPending || updateRuleMutation.isPending;

  const payload = useMemo(() => {
    const current = dialogState.form;
    return {
      name: current.name.trim(),
      ruleType: current.ruleType,
      printSizeTierId: current.printSizeTierId === 'NONE' ? null : current.printSizeTierId,
      printAreaId: current.printAreaId === 'NONE' ? null : current.printAreaId,
      minQuantity: parseOptionalNumber(current.minQuantity),
      maxQuantity: parseOptionalNumber(current.maxQuantity),
      price: Number(current.price || 0),
      discountPercent: parseOptionalNumber(current.discountPercent),
      isActive: current.isActive,
    };
  }, [dialogState.form]);

  const canSubmit = payload.name.length > 0 && Number.isFinite(payload.price);

  const openCreateDialog = () => {
    setDialogState({
      open: true,
      mode: 'create',
      ruleId: null,
      form: defaultFormState,
    });
  };

  const openEditDialog = (rule: PricingRule) => {
    setDialogState({
      open: true,
      mode: 'edit',
      ruleId: rule.id,
      form: {
        name: rule.name,
        ruleType: rule.ruleType,
        printSizeTierId: rule.printSizeTierId ?? 'NONE',
        printAreaId: rule.printAreaId ?? 'NONE',
        minQuantity: rule.minQuantity == null ? '' : String(rule.minQuantity),
        maxQuantity: rule.maxQuantity == null ? '' : String(rule.maxQuantity),
        price: String(Number(rule.price)),
        discountPercent: rule.discountPercent == null ? '' : String(rule.discountPercent),
        isActive: rule.isActive,
      },
    });
  };

  const submit = () => {
    if (!canSubmit) return;

    if (dialogState.mode === 'create') {
      createRuleMutation.mutate(payload);
      return;
    }

    if (!dialogState.ruleId) return;
    updateRuleMutation.mutate({
      id: dialogState.ruleId,
      payload,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Pricing Rules</h1>
          <p className="text-muted-foreground">Manage print fees, extra-side fees, add-ons, discounts, and rush fees</p>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['pricing-rules'] })}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button className="w-full sm:w-auto" onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            New Rule
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant={includeInactive ? 'default' : 'outline'}
          size="sm"
          onClick={() => setIncludeInactive((value) => !value)}
        >
          {includeInactive ? 'Including inactive' : 'Active only'}
        </Button>
        <p className="text-sm text-muted-foreground">
          {rules.length} rule{rules.length === 1 ? '' : 's'}
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <Table className="w-full md:min-w-[980px]">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Print Area</TableHead>
                <TableHead>Size Tier</TableHead>
                <TableHead>Qty Range</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Discount %</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                    Loading pricing rules...
                  </TableCell>
                </TableRow>
              ) : rules.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                    No pricing rules found
                  </TableCell>
                </TableRow>
              ) : (
                rules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell className="font-medium">{rule.name}</TableCell>
                    <TableCell>{formatRuleType(rule.ruleType)}</TableCell>
                    <TableCell>{rule.printArea?.label ?? '-'}</TableCell>
                    <TableCell>{rule.printSizeTier?.label ?? '-'}</TableCell>
                    <TableCell>
                      {rule.minQuantity == null && rule.maxQuantity == null
                        ? '-'
                        : `${rule.minQuantity ?? 0} to ${rule.maxQuantity ?? '+'}`}
                    </TableCell>
                    <TableCell>${Number(rule.price).toLocaleString()}</TableCell>
                    <TableCell>{rule.discountPercent ?? '-'}</TableCell>
                    <TableCell>
                      <Badge variant={rule.isActive ? 'default' : 'secondary'}>
                        {rule.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEditDialog(rule)}>
                          Edit
                        </Button>
                        {rule.isActive ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={deactivateRuleMutation.isPending}
                            onClick={() => deactivateRuleMutation.mutate(rule.id)}
                          >
                            Deactivate
                          </Button>
                        ) : null}
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
        onOpenChange={(open) => {
          if (!open) {
            setDialogState({ open: false, mode: 'create', ruleId: null, form: defaultFormState });
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogState.mode === 'create' ? 'Create Pricing Rule' : 'Edit Pricing Rule'}</DialogTitle>
            <DialogDescription>
              Configure pricing behavior for custom print orders
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div>
              <p className="mb-2 text-sm text-muted-foreground">Name</p>
              <Input
                value={dialogState.form.name}
                onChange={(e) =>
                  setDialogState((prev) => ({
                    ...prev,
                    form: { ...prev.form, name: e.target.value },
                  }))
                }
                placeholder="Rule name"
              />
            </div>

            <div>
              <p className="mb-2 text-sm text-muted-foreground">Rule Type</p>
              <Select
                value={dialogState.form.ruleType}
                onValueChange={(value) =>
                  setDialogState((prev) => ({
                    ...prev,
                    form: { ...prev.form, ruleType: value as RuleType },
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select rule type" />
                </SelectTrigger>
                <SelectContent>
                  {ruleTypes.map((ruleType) => (
                    <SelectItem key={ruleType} value={ruleType}>
                      {formatRuleType(ruleType)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-sm text-muted-foreground">Print Area</p>
                <Select
                  value={dialogState.form.printAreaId}
                  onValueChange={(value) =>
                    setDialogState((prev) => ({
                      ...prev,
                      form: { ...prev.form, printAreaId: value },
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Optional print area" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">None</SelectItem>
                    {printAreas.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <p className="mb-2 text-sm text-muted-foreground">Size Tier</p>
                <Select
                  value={dialogState.form.printSizeTierId}
                  onValueChange={(value) =>
                    setDialogState((prev) => ({
                      ...prev,
                      form: { ...prev.form, printSizeTierId: value },
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Optional size tier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">None</SelectItem>
                    {printSizeTiers.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-sm text-muted-foreground">Price</p>
                <Input
                  type="number"
                  value={dialogState.form.price}
                  onChange={(e) =>
                    setDialogState((prev) => ({
                      ...prev,
                      form: { ...prev.form, price: e.target.value },
                    }))
                  }
                  placeholder="0"
                />
              </div>

              <div>
                <p className="mb-2 text-sm text-muted-foreground">Discount Percent</p>
                <Input
                  type="number"
                  value={dialogState.form.discountPercent}
                  onChange={(e) =>
                    setDialogState((prev) => ({
                      ...prev,
                      form: { ...prev.form, discountPercent: e.target.value },
                    }))
                  }
                  placeholder="Optional"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-sm text-muted-foreground">Min Quantity</p>
                <Input
                  type="number"
                  value={dialogState.form.minQuantity}
                  onChange={(e) =>
                    setDialogState((prev) => ({
                      ...prev,
                      form: { ...prev.form, minQuantity: e.target.value },
                    }))
                  }
                  placeholder="Optional"
                />
              </div>

              <div>
                <p className="mb-2 text-sm text-muted-foreground">Max Quantity</p>
                <Input
                  type="number"
                  value={dialogState.form.maxQuantity}
                  onChange={(e) =>
                    setDialogState((prev) => ({
                      ...prev,
                      form: { ...prev.form, maxQuantity: e.target.value },
                    }))
                  }
                  placeholder="Optional"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogState({ open: false, mode: 'create', ruleId: null, form: defaultFormState })}
            >
              Cancel
            </Button>
            <Button disabled={!canSubmit || submitting} onClick={submit}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : dialogState.mode === 'create' ? (
                'Create'
              ) : (
                'Save'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
