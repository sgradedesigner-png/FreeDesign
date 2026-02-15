import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { RefreshCw, FileDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const productionStatuses = [
  'NEW',
  'ART_CHECK',
  'READY_TO_PRINT',
  'PRINTING',
  'QC',
  'PACKED',
  'SHIPPED',
  'DONE',
] as const;

type ProductionStatus = (typeof productionStatuses)[number];

type ProductionOrder = {
  id: string;
  total: string;
  status: string;
  paymentStatus: string;
  productionStatus: ProductionStatus;
  isCustomOrder: boolean;
  createdAt: string;
  customizations: Array<{ id: string }>;
};

type ProductionOrdersResponse = {
  orders: ProductionOrder[];
  statusCounts: Record<ProductionStatus, number>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

type PrintPackAsset = {
  customizationId: string;
  orderItemIndex: number;
  printArea: string;
  printSizeTier: string;
  designUrl: string;
  thumbnailUrl: string | null;
  widthPx: number | null;
  heightPx: number | null;
  placementConfig: unknown;
  printFee: number | string | null;
};

type UploadAsset = {
  orderItemId: string;
  orderItemIndex: number;
  uploadAssetId: string;
  fileName: string;
  cloudinaryUrl: string;
  thumbnailUrl: string | null;
  widthPx: number | null;
  heightPx: number | null;
  validationStatus: string;
  moderationStatus: string;
  uploadFamily: string | null;
  sortOrder: number;
  createdAt: string;
};

type PrintPackResponse = {
  orderId: string;
  productionStatus: ProductionStatus;
  paymentStatus: string;
  isCustomOrder: boolean;
  generatedAt: string;
  totalCustomizations: number;
  totalUploads: number; // Phase 2: Upload count
  orderItemCount: number;
  printPack: PrintPackAsset[];
  uploadAssets: UploadAsset[]; // Phase 2: Upload assets for production
  groupedByItem: Record<string, { snapshot: unknown; assets: PrintPackAsset[] }>;
  productionEvents: Array<{
    id: string;
    fromStatus: ProductionStatus | null;
    toStatus: ProductionStatus;
    changedBy: string;
    notes: string | null;
    createdAt: string;
  }>;
};

type BatchStatusResponse = {
  summary: {
    requested: number;
    unique: number;
    processed: number;
    updated: number;
    unchanged: number;
    failed: number;
  };
  results: Array<{
    orderId: string;
    result: 'UPDATED' | 'UNCHANGED' | 'FAILED';
    fromStatus?: ProductionStatus;
    toStatus?: ProductionStatus;
    error?: string;
    allowedTransitions?: ProductionStatus[];
  }>;
};

type BatchPrintPackResponse = {
  generatedAt: string;
  summary: {
    requested: number;
    unique: number;
    success: number;
    failed: number;
  };
  packs: PrintPackResponse[];
  failures: Array<{
    orderId: string;
    error: string;
  }>;
};

const statusLabels: Record<ProductionStatus, string> = {
  NEW: 'New',
  ART_CHECK: 'Art Check',
  READY_TO_PRINT: 'Ready',
  PRINTING: 'Printing',
  QC: 'QC',
  PACKED: 'Packed',
  SHIPPED: 'Shipped',
  DONE: 'Done',
};

function getStatusBadge(status: ProductionStatus) {
  const classMap: Record<ProductionStatus, string> = {
    NEW: 'bg-slate-100 text-slate-700',
    ART_CHECK: 'bg-indigo-100 text-indigo-700',
    READY_TO_PRINT: 'bg-cyan-100 text-cyan-700',
    PRINTING: 'bg-amber-100 text-amber-700',
    QC: 'bg-violet-100 text-violet-700',
    PACKED: 'bg-sky-100 text-sky-700',
    SHIPPED: 'bg-blue-100 text-blue-700',
    DONE: 'bg-emerald-100 text-emerald-700',
  };

  return (
    <Badge className={classMap[status]}>
      {statusLabels[status]}
    </Badge>
  );
}

export default function ProductionDashboardPage() {
  const queryClient = useQueryClient();
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [customOrderOnly, setCustomOrderOnly] = useState<string>('true');
  const [page, setPage] = useState(1);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());

  const [statusDialog, setStatusDialog] = useState<{
    open: boolean;
    order: ProductionOrder | null;
    nextStatus: ProductionStatus | '';
    notes: string;
  }>({
    open: false,
    order: null,
    nextStatus: '',
    notes: '',
  });

  const [batchStatusDialog, setBatchStatusDialog] = useState<{
    open: boolean;
    nextStatus: ProductionStatus | '';
    notes: string;
  }>({
    open: false,
    nextStatus: '',
    notes: '',
  });

  const [printPackOrderId, setPrintPackOrderId] = useState<string | null>(null);

  const { data, isLoading, isFetching } = useQuery<ProductionOrdersResponse>({
    queryKey: ['production-orders', selectedStatus, customOrderOnly, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        isCustomOrder: customOrderOnly,
      });

      if (selectedStatus !== 'ALL') {
        params.set('productionStatus', selectedStatus);
      }

      const response = await api.get<ProductionOrdersResponse>(`/admin/production/orders?${params.toString()}`);
      return response.data;
    },
  });

  const printPackQuery = useQuery<PrintPackResponse>({
    queryKey: ['print-pack', printPackOrderId],
    enabled: Boolean(printPackOrderId),
    queryFn: async () => {
      const response = await api.get<PrintPackResponse>(`/admin/orders/${printPackOrderId}/print-pack`);
      return response.data;
    },
  });

  const updateProductionStatusMutation = useMutation({
    mutationFn: async (payload: { orderId: string; status: ProductionStatus; notes?: string }) => {
      await api.put(`/admin/orders/${payload.orderId}/production-status`, {
        status: payload.status,
        notes: payload.notes || undefined,
      });
    },
    onSuccess: () => {
      toast.success('Production status updated');
      queryClient.invalidateQueries({ queryKey: ['production-orders'] });
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      setStatusDialog({ open: false, order: null, nextStatus: '', notes: '' });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to update production status');
    },
  });

  const batchUpdateStatusMutation = useMutation({
    mutationFn: async (payload: { orderIds: string[]; status: ProductionStatus; notes?: string }) => {
      const response = await api.post<BatchStatusResponse>('/admin/production/orders/batch-status', payload);
      return response.data;
    },
    onSuccess: (payload) => {
      const { updated, unchanged, failed } = payload.summary;
      if (updated > 0 || unchanged > 0) {
        toast.success(`Batch status update: ${updated} updated, ${unchanged} unchanged`);
      }
      if (failed > 0) {
        const firstError = payload.results.find((item) => item.result === 'FAILED')?.error;
        toast.error(firstError ? `${failed} failed (${firstError})` : `${failed} orders failed`);
      }

      queryClient.invalidateQueries({ queryKey: ['production-orders'] });
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      setBatchStatusDialog({ open: false, nextStatus: '', notes: '' });
      setSelectedOrderIds(new Set());
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to update selected orders');
    },
  });

  const batchPrintPackMutation = useMutation({
    mutationFn: async (orderIds: string[]) => {
      const response = await api.post<BatchPrintPackResponse>('/admin/production/orders/batch-print-pack', {
        orderIds,
      });
      return response.data;
    },
    onSuccess: (payload) => {
      const exportPayload = {
        generatedAt: payload.generatedAt,
        summary: payload.summary,
        packs: payload.packs,
        failures: payload.failures,
      };

      const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
        type: 'application/json;charset=utf-8;',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `print-pack-batch-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      link.click();
      URL.revokeObjectURL(url);

      toast.success(`Batch print pack exported (${payload.summary.success} success)`);
      if (payload.summary.failed > 0) {
        toast.error(`${payload.summary.failed} orders failed to export`);
      }
      setSelectedOrderIds(new Set());
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to export batch print packs');
    },
  });

  const orders = data?.orders ?? [];
  const pagination = data?.pagination;
  const statusCounts = data?.statusCounts;

  useEffect(() => {
    setSelectedOrderIds((prev) => {
      if (prev.size === 0) return prev;

      const visibleOrderIds = new Set((data?.orders ?? []).map((order) => order.id));
      const next = new Set(Array.from(prev).filter((orderId) => visibleOrderIds.has(orderId)));
      return next.size === prev.size ? prev : next;
    });
  }, [data?.orders]);

  const canSubmitStatusUpdate = Boolean(
    statusDialog.order &&
    statusDialog.nextStatus &&
    statusDialog.nextStatus !== statusDialog.order.productionStatus
  );

  const canSubmitBatchStatus = Boolean(
    selectedOrderIds.size > 0 &&
    batchStatusDialog.nextStatus
  );

  const statusCards = useMemo(() => {
    return productionStatuses.map((status) => ({
      status,
      count: statusCounts?.[status] ?? 0,
      label: statusLabels[status],
    }));
  }, [statusCounts]);

  const allVisibleSelected = orders.length > 0 && orders.every((order) => selectedOrderIds.has(order.id));
  const selectedCount = selectedOrderIds.size;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Production Dashboard</h1>
          <p className="text-muted-foreground">Track and move custom orders through the production pipeline</p>
        </div>
        <Button
          variant="outline"
          onClick={() => queryClient.invalidateQueries({ queryKey: ['production-orders'] })}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
        {statusCards.map((item) => (
          <Card key={item.status}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">{item.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{item.count}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Select
          value={selectedStatus}
          onValueChange={(value) => {
            setSelectedStatus(value);
            setPage(1);
            setSelectedOrderIds(new Set());
          }}
        >
          <SelectTrigger className="w-full sm:w-[220px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            {productionStatuses.map((status) => (
              <SelectItem key={status} value={status}>
                {statusLabels[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={customOrderOnly}
          onValueChange={(value) => {
            setCustomOrderOnly(value);
            setPage(1);
            setSelectedOrderIds(new Set());
          }}
        >
          <SelectTrigger className="w-full sm:w-[220px]">
            <SelectValue placeholder="Order type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">Custom orders only</SelectItem>
            <SelectItem value="false">Non-custom orders only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {selectedCount > 0 && (
        <div className="flex flex-col gap-3 rounded-lg bg-muted p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium">
            {selectedCount} {selectedCount === 1 ? 'order' : 'orders'} selected
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setBatchStatusDialog({ open: true, nextStatus: '', notes: '' })}
              disabled={batchUpdateStatusMutation.isPending}
            >
              Move Selected
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => batchPrintPackMutation.mutate(Array.from(selectedOrderIds))}
              disabled={batchPrintPackMutation.isPending}
            >
              {batchPrintPackMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <FileDown className="mr-2 h-4 w-4" />
                  Export Print Packs
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedOrderIds(new Set())}
            >
              Clear Selection
            </Button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <Table className="w-full md:min-w-[1020px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={allVisibleSelected ? true : selectedCount > 0 ? 'indeterminate' : false}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedOrderIds(new Set(orders.map((order) => order.id)));
                        return;
                      }
                      setSelectedOrderIds(new Set());
                    }}
                  />
                </TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Production</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Customizations</TableHead>
                <TableHead>Total</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                    Loading production orders...
                  </TableCell>
                </TableRow>
              ) : orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                    No orders found for current filters
                  </TableCell>
                </TableRow>
              ) : (
                orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedOrderIds.has(order.id)}
                        onCheckedChange={(checked) => {
                          setSelectedOrderIds((prev) => {
                            const next = new Set(prev);
                            if (checked) {
                              next.add(order.id);
                            } else {
                              next.delete(order.id);
                            }
                            return next;
                          });
                        }}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-sm">#{order.id.slice(0, 8).toUpperCase()}</TableCell>
                    <TableCell>
                      {new Date(order.createdAt).toLocaleString('en-US', {
                        month: 'short',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </TableCell>
                    <TableCell>{getStatusBadge(order.productionStatus)}</TableCell>
                    <TableCell>
                      <Badge variant={order.paymentStatus === 'PAID' ? 'default' : 'secondary'}>
                        {order.paymentStatus}
                      </Badge>
                    </TableCell>
                    <TableCell>{order.customizations.length}</TableCell>
                    <TableCell className="font-semibold">${Number(order.total).toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setStatusDialog({
                              open: true,
                              order,
                              nextStatus: order.productionStatus,
                              notes: '',
                            })
                          }
                        >
                          Move
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPrintPackOrderId(order.id)}
                        >
                          <FileDown className="mr-1 h-4 w-4" />
                          Print Pack
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

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => {
                setPage((p) => p - 1);
                setSelectedOrderIds(new Set());
              }}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pagination.totalPages}
              onClick={() => {
                setPage((p) => p + 1);
                setSelectedOrderIds(new Set());
              }}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <Dialog
        open={statusDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            setStatusDialog({ open: false, order: null, nextStatus: '', notes: '' });
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Production Status</DialogTitle>
            <DialogDescription>
              {statusDialog.order ? `Order #${statusDialog.order.id.slice(0, 8).toUpperCase()}` : ''}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <p className="mb-2 text-sm text-muted-foreground">Current status</p>
              {statusDialog.order ? getStatusBadge(statusDialog.order.productionStatus) : null}
            </div>

            <div>
              <p className="mb-2 text-sm text-muted-foreground">Next status</p>
              <Select
                value={statusDialog.nextStatus || undefined}
                onValueChange={(value) =>
                  setStatusDialog((prev) => ({
                    ...prev,
                    nextStatus: value as ProductionStatus,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {productionStatuses.map((status) => (
                    <SelectItem key={status} value={status}>
                      {statusLabels[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <p className="mb-2 text-sm text-muted-foreground">Notes (optional)</p>
              <Input
                value={statusDialog.notes}
                onChange={(e) =>
                  setStatusDialog((prev) => ({
                    ...prev,
                    notes: e.target.value,
                  }))
                }
                placeholder="Reason or handoff note"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setStatusDialog({ open: false, order: null, nextStatus: '', notes: '' })}
            >
              Cancel
            </Button>
            <Button
              disabled={!canSubmitStatusUpdate || updateProductionStatusMutation.isPending}
              onClick={() => {
                if (!statusDialog.order || !statusDialog.nextStatus) return;
                updateProductionStatusMutation.mutate({
                  orderId: statusDialog.order.id,
                  status: statusDialog.nextStatus,
                  notes: statusDialog.notes.trim() || undefined,
                });
              }}
            >
              {updateProductionStatusMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={batchStatusDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            setBatchStatusDialog({ open: false, nextStatus: '', notes: '' });
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move Selected Orders</DialogTitle>
            <DialogDescription>
              {selectedCount} {selectedCount === 1 ? 'order' : 'orders'} selected
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <p className="mb-2 text-sm text-muted-foreground">Next status</p>
              <Select
                value={batchStatusDialog.nextStatus || undefined}
                onValueChange={(value) =>
                  setBatchStatusDialog((prev) => ({
                    ...prev,
                    nextStatus: value as ProductionStatus,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {productionStatuses.map((status) => (
                    <SelectItem key={status} value={status}>
                      {statusLabels[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <p className="mb-2 text-sm text-muted-foreground">Notes (optional)</p>
              <Input
                value={batchStatusDialog.notes}
                onChange={(e) =>
                  setBatchStatusDialog((prev) => ({
                    ...prev,
                    notes: e.target.value,
                  }))
                }
                placeholder="Reason or handoff note"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBatchStatusDialog({ open: false, nextStatus: '', notes: '' })}
            >
              Cancel
            </Button>
            <Button
              disabled={!canSubmitBatchStatus || batchUpdateStatusMutation.isPending}
              onClick={() => {
                if (!batchStatusDialog.nextStatus || selectedOrderIds.size === 0) return;
                batchUpdateStatusMutation.mutate({
                  orderIds: Array.from(selectedOrderIds),
                  status: batchStatusDialog.nextStatus,
                  notes: batchStatusDialog.notes.trim() || undefined,
                });
              }}
            >
              {batchUpdateStatusMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Applying...
                </>
              ) : (
                'Apply'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(printPackOrderId)}
        onOpenChange={(open) => {
          if (!open) setPrintPackOrderId(null);
        }}
      >
        <DialogContent className="max-h-[85vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Print Pack</DialogTitle>
            <DialogDescription>
              {printPackQuery.data ? `Order #${printPackQuery.data.orderId.slice(0, 8).toUpperCase()}` : ''}
            </DialogDescription>
          </DialogHeader>

          {printPackQuery.isLoading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading print pack...
            </div>
          ) : printPackQuery.isError ? (
            <div className="py-6 text-sm text-destructive">Failed to load print pack.</div>
          ) : printPackQuery.data ? (
            <div className="space-y-6">
              <div className="grid gap-3 md:grid-cols-5">
                <Card>
                  <CardHeader className="pb-1">
                    <CardTitle className="text-xs text-muted-foreground">Production</CardTitle>
                  </CardHeader>
                  <CardContent>{getStatusBadge(printPackQuery.data.productionStatus)}</CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-1">
                    <CardTitle className="text-xs text-muted-foreground">Payment</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Badge variant={printPackQuery.data.paymentStatus === 'PAID' ? 'default' : 'secondary'}>
                      {printPackQuery.data.paymentStatus}
                    </Badge>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-1">
                    <CardTitle className="text-xs text-muted-foreground">Customizations</CardTitle>
                  </CardHeader>
                  <CardContent className="text-2xl font-bold">{printPackQuery.data.totalCustomizations}</CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-1">
                    <CardTitle className="text-xs text-muted-foreground">Uploads</CardTitle>
                  </CardHeader>
                  <CardContent className="text-2xl font-bold">{printPackQuery.data.totalUploads ?? 0}</CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-1">
                    <CardTitle className="text-xs text-muted-foreground">Generated</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm">
                    {new Date(printPackQuery.data.generatedAt).toLocaleString('en-US')}
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="mb-3 font-semibold">Print Customizations</h3>
                  <div className="overflow-hidden rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item</TableHead>
                          <TableHead>Area</TableHead>
                          <TableHead>Size</TableHead>
                          <TableHead>Asset</TableHead>
                          <TableHead>Fee</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {printPackQuery.data.printPack.map((row) => (
                          <TableRow key={row.customizationId}>
                            <TableCell>{row.orderItemIndex + 1}</TableCell>
                            <TableCell>{row.printArea}</TableCell>
                            <TableCell>{row.printSizeTier}</TableCell>
                            <TableCell>
                              <a
                                href={row.designUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-primary underline"
                              >
                                Open design
                              </a>
                            </TableCell>
                            <TableCell>${Number(row.printFee ?? 0).toLocaleString()}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Phase 2: Upload Assets Section */}
                {printPackQuery.data.uploadAssets && printPackQuery.data.uploadAssets.length > 0 && (
                  <div>
                    <h3 className="mb-3 font-semibold">Upload Assets ({printPackQuery.data.uploadAssets.length})</h3>
                    <div className="overflow-hidden rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Item</TableHead>
                            <TableHead>File Name</TableHead>
                            <TableHead>Family</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Asset</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {printPackQuery.data.uploadAssets.map((upload, index) => (
                            <TableRow key={upload.uploadAssetId}>
                              <TableCell>{upload.orderItemIndex + 1}</TableCell>
                              <TableCell className="font-mono text-sm">{upload.fileName}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">
                                  {upload.uploadFamily || 'N/A'}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant={upload.validationStatus === 'PASSED' ? 'default' : 'secondary'}>
                                  {upload.validationStatus}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <a
                                  href={upload.cloudinaryUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-primary underline"
                                >
                                  Open file
                                </a>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold">Production Timeline</h3>
                <div className="space-y-2">
                  {printPackQuery.data.productionEvents.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No status events yet.</p>
                  ) : (
                    printPackQuery.data.productionEvents.map((event) => (
                      <div key={event.id} className="rounded-md border p-3 text-sm">
                        <p className="font-medium">
                          {event.fromStatus ?? 'N/A'} to {event.toStatus}
                        </p>
                        <p className="text-muted-foreground">
                          {event.changedBy} at {new Date(event.createdAt).toLocaleString('en-US')}
                        </p>
                        {event.notes ? <p className="mt-1">{event.notes}</p> : null}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPrintPackOrderId(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
