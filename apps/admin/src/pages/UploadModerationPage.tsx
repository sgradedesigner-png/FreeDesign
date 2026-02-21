import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { RefreshCw, CheckCircle, XCircle, Flag, Eye, FileImage, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

type ModerationStatus = 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'FLAGGED';
type ValidationStatus = 'PENDING' | 'PROCESSING' | 'PASSED' | 'FAILED' | 'DEAD_LETTER';

type UploadAsset = {
  id: string;
  ownerId: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  cloudinaryUrl: string;
  thumbnailUrl: string | null;
  widthPx: number | null;
  heightPx: number | null;
  validationStatus: ValidationStatus;
  moderationStatus: ModerationStatus;
  uploadFamily: string | null;
  createdAt: string;
  moderationActions: Array<{
    id: string;
    action: string;
    actorId: string;
    reason: string | null;
    createdAt: string;
  }>;
  validationJobs: Array<{
    id: string;
    status: ValidationStatus;
    lastError: string | null;
    events: Array<{
      eventType: string;
      message: string | null;
      errorCode: string | null;
    }>;
  }>;
  orderItemUploads: Array<{
    orderItem: {
      orderId: string;
    };
  }>;
};

type UploadsQueueResponse = {
  uploads: UploadAsset[];
  statusCounts: Record<string, number>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

type StatsResponse = {
  statusCounts: {
    pending: number;
    approved: number;
    rejected: number;
    flagged: number;
  };
  validationFailed: number;
  recentActions24h: number;
};

const statusBadgeConfig: Record<ModerationStatus, { color: string; icon: any }> = {
  PENDING_REVIEW: { color: 'bg-yellow-100 text-yellow-700', icon: Eye },
  APPROVED: { color: 'bg-green-100 text-green-700', icon: CheckCircle },
  REJECTED: { color: 'bg-red-100 text-red-700', icon: XCircle },
  FLAGGED: { color: 'bg-orange-100 text-orange-700', icon: Flag },
};

const validationBadgeConfig: Record<ValidationStatus, string> = {
  PENDING: 'bg-gray-100 text-gray-700',
  PROCESSING: 'bg-blue-100 text-blue-700',
  PASSED: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-700',
  DEAD_LETTER: 'bg-purple-100 text-purple-700',
};

export default function UploadModerationPage() {
  const queryClient = useQueryClient();
  const [selectedStatus, setSelectedStatus] = useState<string>('PENDING_REVIEW');
  const [selectedFamily, setSelectedFamily] = useState<string>('ALL');
  const [page, setPage] = useState(1);

  const [detailDialog, setDetailDialog] = useState<{
    open: boolean;
    upload: UploadAsset | null;
  }>({
    open: false,
    upload: null,
  });

  const [moderationDialog, setModerationDialog] = useState<{
    open: boolean;
    upload: UploadAsset | null;
    action: 'approve' | 'reject' | 'flag' | '';
    reason: string;
  }>({
    open: false,
    upload: null,
    action: '',
    reason: '',
  });

  // Fetch stats
  const { data: stats } = useQuery<StatsResponse>({
    queryKey: ['upload-moderation-stats'],
    queryFn: async () => {
      const response = await api.get<StatsResponse>('/api/admin/uploads/stats/overview');
      return response.data;
    },
  });

  // Fetch uploads queue
  const { data, isLoading, isFetching } = useQuery<UploadsQueueResponse>({
    queryKey: ['upload-moderation-queue', selectedStatus, selectedFamily, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });

      if (selectedStatus !== 'ALL') {
        params.set('status', selectedStatus);
      }

      if (selectedFamily !== 'ALL') {
        params.set('uploadFamily', selectedFamily);
      }

      const response = await api.get<UploadsQueueResponse>(`/api/admin/uploads/queue?${params.toString()}`);
      return response.data;
    },
  });

  // Moderation mutation
  const moderateMutation = useMutation({
    mutationFn: async (payload: { uploadId: string; action: string; reason?: string }) => {
      await api.post(`/api/admin/uploads/${payload.uploadId}/moderate`, {
        action: payload.action,
        reason: payload.reason || undefined,
      });
    },
    onSuccess: () => {
      toast.success('Moderation action applied');
      queryClient.invalidateQueries({ queryKey: ['upload-moderation-queue'] });
      queryClient.invalidateQueries({ queryKey: ['upload-moderation-stats'] });
      setModerationDialog({ open: false, upload: null, action: '', reason: '' });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to apply moderation action');
    },
  });

  const uploads = data?.uploads ?? [];
  const pagination = data?.pagination;

  const canSubmitModeration = Boolean(
    moderationDialog.upload && moderationDialog.action && moderationDialog.reason.trim().length >= 3
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Upload Moderation Queue</h1>
          <p className="text-muted-foreground">Review and moderate uploaded files</p>
        </div>
        <Button
          variant="outline"
          onClick={() => queryClient.invalidateQueries({ queryKey: ['upload-moderation-queue', 'upload-moderation-stats'] })}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-3 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Pending Review</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats.statusCounts.pending}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Approved</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">{stats.statusCounts.approved}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Rejected</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-red-600">{stats.statusCounts.rejected}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Validation Failed</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-orange-600">{stats.validationFailed}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Select
          value={selectedStatus}
          onValueChange={(value) => {
            setSelectedStatus(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full sm:w-[220px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            <SelectItem value="PENDING_REVIEW">Pending Review</SelectItem>
            <SelectItem value="APPROVED">Approved</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
            <SelectItem value="FLAGGED">Flagged</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={selectedFamily}
          onValueChange={(value) => {
            setSelectedFamily(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full sm:w-[220px]">
            <SelectValue placeholder="Filter by family" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Families</SelectItem>
            <SelectItem value="GANG_UPLOAD">Gang Upload</SelectItem>
            <SelectItem value="UV_GANG_UPLOAD">UV Gang Upload</SelectItem>
            <SelectItem value="BY_SIZE">By Size</SelectItem>
            <SelectItem value="UV_BY_SIZE">UV By Size</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Uploads Table */}
      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <Table className="w-full md:min-w-[1020px]">
            <TableHeader>
              <TableRow>
                <TableHead>Thumbnail</TableHead>
                <TableHead>File Name</TableHead>
                <TableHead>Family</TableHead>
                <TableHead>Validation</TableHead>
                <TableHead>Moderation</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    Loading uploads...
                  </TableCell>
                </TableRow>
              ) : uploads.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    No uploads found for current filters
                  </TableCell>
                </TableRow>
              ) : (
                uploads.map((upload) => {
                  const StatusIcon = statusBadgeConfig[upload.moderationStatus].icon;

                  return (
                    <TableRow key={upload.id}>
                      <TableCell>
                        {upload.thumbnailUrl ? (
                          <img
                            src={upload.thumbnailUrl}
                            alt={upload.fileName}
                            className="h-12 w-12 rounded object-cover"
                          />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded bg-muted">
                            <FileImage className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-sm max-w-[200px] truncate">
                        {upload.fileName}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {upload.uploadFamily || 'N/A'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={validationBadgeConfig[upload.validationStatus]}>
                          {upload.validationStatus}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={statusBadgeConfig[upload.moderationStatus].color}>
                          <StatusIcon className="mr-1 h-3 w-3" />
                          {upload.moderationStatus.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {new Date(upload.createdAt).toLocaleString('en-US', {
                          month: 'short',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDetailDialog({ open: true, upload })}
                          >
                            <Eye className="mr-1 h-4 w-4" />
                            View
                          </Button>
                          {upload.moderationStatus === 'PENDING_REVIEW' && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  setModerationDialog({
                                    open: true,
                                    upload,
                                    action: 'approve',
                                    reason: '',
                                  })
                                }
                              >
                                <CheckCircle className="mr-1 h-4 w-4 text-green-600" />
                                Approve
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  setModerationDialog({
                                    open: true,
                                    upload,
                                    action: 'reject',
                                    reason: '',
                                  })
                                }
                              >
                                <XCircle className="mr-1 h-4 w-4 text-red-600" />
                                Reject
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
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
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog
        open={detailDialog.open}
        onOpenChange={(open) => {
          if (!open) setDetailDialog({ open: false, upload: null });
        }}
      >
        <DialogContent className="max-h-[85vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Upload Details</DialogTitle>
            <DialogDescription>
              {detailDialog.upload ? detailDialog.upload.fileName : ''}
            </DialogDescription>
          </DialogHeader>

          {detailDialog.upload && (
            <div className="space-y-4">
              {/* Preview Image */}
              {detailDialog.upload.thumbnailUrl && (
                <div className="flex justify-center">
                  <img
                    src={detailDialog.upload.cloudinaryUrl}
                    alt={detailDialog.upload.fileName}
                    className="max-h-96 rounded-lg border"
                  />
                </div>
              )}

              {/* File Info */}
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label className="text-xs text-muted-foreground">File Name</Label>
                  <p className="font-mono text-sm">{detailDialog.upload.fileName}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">MIME Type</Label>
                  <p className="text-sm">{detailDialog.upload.mimeType}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Size</Label>
                  <p className="text-sm">{(detailDialog.upload.fileSizeBytes / 1024 / 1024).toFixed(2)} MB</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Dimensions</Label>
                  <p className="text-sm">
                    {detailDialog.upload.widthPx && detailDialog.upload.heightPx
                      ? `${detailDialog.upload.widthPx} × ${detailDialog.upload.heightPx}px`
                      : 'N/A'}
                  </p>
                </div>
              </div>

              {/* Validation Error */}
              {detailDialog.upload.validationJobs?.[0]?.lastError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                  <Label className="text-xs font-semibold text-red-700">Validation Error</Label>
                  <p className="text-sm text-red-600">{detailDialog.upload.validationJobs[0].lastError}</p>
                </div>
              )}

              {/* Moderation History */}
              {detailDialog.upload.moderationActions.length > 0 && (
                <div>
                  <Label className="text-xs font-semibold">Moderation History</Label>
                  <div className="mt-2 space-y-2">
                    {detailDialog.upload.moderationActions.map((action) => (
                      <div key={action.id} className="rounded-md border p-3 text-sm">
                        <p className="font-medium">{action.action.toUpperCase()}</p>
                        {action.reason && <p className="text-muted-foreground">{action.reason}</p>}
                        <p className="text-xs text-muted-foreground">
                          {new Date(action.createdAt).toLocaleString('en-US')}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Linked Orders */}
              {detailDialog.upload.orderItemUploads.length > 0 && (
                <div>
                  <Label className="text-xs font-semibold">Linked Orders</Label>
                  <div className="mt-2 space-y-1">
                    {detailDialog.upload.orderItemUploads.map((link, index) => (
                      <p key={index} className="font-mono text-sm">
                        Order: {link.orderItem.orderId.substring(0, 8).toUpperCase()}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailDialog({ open: false, upload: null })}>
              Close
            </Button>
            {detailDialog.upload && (
              <Button
                onClick={() => window.open(detailDialog.upload!.cloudinaryUrl, '_blank')}
              >
                Open in Cloudinary
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Moderation Action Dialog */}
      <Dialog
        open={moderationDialog.open}
        onOpenChange={(open) => {
          if (!open) setModerationDialog({ open: false, upload: null, action: '', reason: '' });
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {moderationDialog.action === 'approve' && 'Approve Upload'}
              {moderationDialog.action === 'reject' && 'Reject Upload'}
              {moderationDialog.action === 'flag' && 'Flag Upload'}
            </DialogTitle>
            <DialogDescription>
              {moderationDialog.upload ? moderationDialog.upload.fileName : ''}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="reason">Reason (required)</Label>
              <Textarea
                id="reason"
                value={moderationDialog.reason}
                onChange={(e) =>
                  setModerationDialog((prev) => ({ ...prev, reason: e.target.value }))
                }
                placeholder="Explain why you're taking this action..."
                rows={4}
                className="mt-2"
              />
              <p className="mt-1 text-xs text-muted-foreground">Minimum 3 characters</p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setModerationDialog({ open: false, upload: null, action: '', reason: '' })}
            >
              Cancel
            </Button>
            <Button
              disabled={!canSubmitModeration || moderateMutation.isPending}
              onClick={() => {
                if (!moderationDialog.upload || !moderationDialog.action) return;
                moderateMutation.mutate({
                  uploadId: moderationDialog.upload.id,
                  action: moderationDialog.action,
                  reason: moderationDialog.reason.trim(),
                });
              }}
            >
              {moderateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Applying...
                </>
              ) : (
                'Confirm'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
