import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { RefreshCw, Loader2, Plus, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

const REPRINT_STATUSES = [
  'REQUESTED',
  'APPROVED',
  'IN_QUEUE',
  'PRINTING',
  'DONE',
  'REJECTED',
  'CANCELLED',
] as const;

type ReprintStatus = (typeof REPRINT_STATUSES)[number];

const NEXT_STATUSES: Record<ReprintStatus, ReprintStatus[]> = {
  REQUESTED:  ['APPROVED', 'REJECTED', 'CANCELLED'],
  APPROVED:   ['IN_QUEUE', 'CANCELLED'],
  IN_QUEUE:   ['PRINTING', 'CANCELLED'],
  PRINTING:   ['DONE', 'CANCELLED'],
  DONE:       [],
  REJECTED:   [],
  CANCELLED:  [],
};

const STATUS_COLORS: Record<ReprintStatus, string> = {
  REQUESTED: 'bg-yellow-100 text-yellow-800',
  APPROVED:  'bg-blue-100 text-blue-800',
  IN_QUEUE:  'bg-indigo-100 text-indigo-800',
  PRINTING:  'bg-purple-100 text-purple-800',
  DONE:      'bg-green-100 text-green-800',
  REJECTED:  'bg-red-100 text-red-800',
  CANCELLED: 'bg-gray-100 text-gray-600',
};

type ReprintRequest = {
  id: string;
  orderId: string;
  status: ReprintStatus;
  reason: string;
  notes: string | null;
  requestedBy: string;
  approvedBy: string | null;
  createdAt: string;
  updatedAt: string;
  order: {
    id: string;
    status: string;
    productionStatus: string;
    createdAt: string;
  };
};

type ReprintListResponse = {
  reprints: ReprintRequest[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString();
}

export default function ReprintQueuePage() {
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<ReprintStatus | 'ALL'>('ALL');
  const [orderIdFilter, setOrderIdFilter] = useState('');
  const [page, setPage] = useState(1);

  // Create dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [createOrderId, setCreateOrderId] = useState('');
  const [createReason, setCreateReason] = useState('');
  const [createNotes, setCreateNotes] = useState('');

  // Status transition dialog state
  const [transitionOpen, setTransitionOpen] = useState(false);
  const [selectedReprint, setSelectedReprint] = useState<ReprintRequest | null>(null);
  const [nextStatus, setNextStatus] = useState<ReprintStatus | ''>('');
  const [transitionNotes, setTransitionNotes] = useState('');

  const params = new URLSearchParams({
    page: String(page),
    limit: '20',
    ...(statusFilter !== 'ALL' ? { status: statusFilter } : {}),
    ...(orderIdFilter.trim() ? { orderId: orderIdFilter.trim() } : {}),
  });

  const { data, isLoading, isFetching, refetch } = useQuery<ReprintListResponse>({
    queryKey: ['admin-reprints', statusFilter, orderIdFilter, page],
    queryFn: () => api.get(`/admin/reprints?${params}`),
    staleTime: 30_000,
  });

  const createMutation = useMutation({
    mutationFn: (body: { orderId: string; reason: string; notes?: string }) =>
      api.post('/admin/reprints', body),
    onSuccess: () => {
      toast.success('Reprint request created');
      queryClient.invalidateQueries({ queryKey: ['admin-reprints'] });
      setCreateOpen(false);
      setCreateOrderId('');
      setCreateReason('');
      setCreateNotes('');
    },
    onError: () => toast.error('Failed to create reprint request'),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status, notes }: { id: string; status: ReprintStatus; notes?: string }) =>
      api.put(`/admin/reprints/${id}/status`, { status, notes }),
    onSuccess: () => {
      toast.success('Reprint status updated');
      queryClient.invalidateQueries({ queryKey: ['admin-reprints'] });
      setTransitionOpen(false);
      setSelectedReprint(null);
      setNextStatus('');
      setTransitionNotes('');
    },
    onError: () => toast.error('Failed to update reprint status'),
  });

  function openTransition(reprint: ReprintRequest) {
    setSelectedReprint(reprint);
    const available = NEXT_STATUSES[reprint.status];
    setNextStatus(available.length > 0 ? available[0] : '');
    setTransitionNotes('');
    setTransitionOpen(true);
  }

  const reprints = data?.reprints ?? [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Reprint Queue</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            {isFetching ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-1" />
            )}
            Refresh
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-1" />
            New Request
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3">
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v as ReprintStatus | 'ALL');
                setPage(1);
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                {REPRINT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              placeholder="Filter by Order ID..."
              className="w-64"
              value={orderIdFilter}
              onChange={(e) => {
                setOrderIdFilter(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            Reprint Requests
            {pagination && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({pagination.total} total)
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : reprints.length === 0 ? (
            <p className="text-center py-12 text-muted-foreground">No reprint requests found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Request ID</TableHead>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Production</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reprints.map((r) => {
                  const canTransition = NEXT_STATUSES[r.status].length > 0;
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.id.slice(0, 8)}…</TableCell>
                      <TableCell className="font-mono text-xs">{r.orderId.slice(0, 8)}…</TableCell>
                      <TableCell>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[r.status]}`}>
                          {r.status}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {r.order.productionStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-sm">{r.reason}</TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(r.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!canTransition}
                          onClick={() => openTransition(r)}
                        >
                          <ChevronRight className="w-4 h-4" />
                          Advance
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <span className="flex items-center text-sm text-muted-foreground px-2">
                Page {page} / {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Reprint Request</DialogTitle>
            <DialogDescription>
              Create a reprint request for an existing order.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Order ID</label>
              <Input
                placeholder="UUID of the order"
                value={createOrderId}
                onChange={(e) => setCreateOrderId(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Reason *</label>
              <Input
                placeholder="Reason for reprint"
                value={createReason}
                onChange={(e) => setCreateReason(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Notes (optional)</label>
              <Input
                placeholder="Additional notes"
                value={createNotes}
                onChange={(e) => setCreateNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!createOrderId.trim() || !createReason.trim() || createMutation.isPending}
              onClick={() =>
                createMutation.mutate({
                  orderId: createOrderId.trim(),
                  reason: createReason.trim(),
                  ...(createNotes.trim() ? { notes: createNotes.trim() } : {}),
                })
              }
            >
              {createMutation.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              Create Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transition Dialog */}
      <Dialog open={transitionOpen} onOpenChange={setTransitionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Reprint Status</DialogTitle>
            <DialogDescription>
              {selectedReprint && (
                <>
                  Moving from <strong>{selectedReprint.status}</strong> to a new state.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {selectedReprint && (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">New Status</label>
                <Select
                  value={nextStatus}
                  onValueChange={(v) => setNextStatus(v as ReprintStatus)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select next status" />
                  </SelectTrigger>
                  <SelectContent>
                    {NEXT_STATUSES[selectedReprint.status].map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Notes (optional)</label>
                <Input
                  placeholder="Notes for this transition"
                  value={transitionNotes}
                  onChange={(e) => setTransitionNotes(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransitionOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!nextStatus || updateStatusMutation.isPending}
              onClick={() => {
                if (selectedReprint && nextStatus) {
                  updateStatusMutation.mutate({
                    id: selectedReprint.id,
                    status: nextStatus as ReprintStatus,
                    ...(transitionNotes.trim() ? { notes: transitionNotes.trim() } : {}),
                  });
                }
              }}
            >
              {updateStatusMutation.isPending && (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              )}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
