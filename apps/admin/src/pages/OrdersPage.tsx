import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { Badge } from '@/components/ui/badge';
import { Eye, Package, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

type Order = {
  id: string;
  userId: string;
  total: string;
  status: 'PENDING' | 'PAID' | 'SHIPPED' | 'COMPLETED' | 'CANCELLED';
  items: any;
  shippingAddress: any;
  createdAt: string;
  updatedAt: string;
};

type OrdersResponse = {
  orders: Order[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export default function OrdersPage() {
  const queryClient = useQueryClient();
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [statusChangeOrder, setStatusChangeOrder] = useState<Order | null>(null);
  const [newStatus, setNewStatus] = useState<string>('');

  // Fetch orders
  const { data, isLoading, error } = useQuery<OrdersResponse>({
    queryKey: ['admin-orders', page, selectedStatus],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });

      if (selectedStatus !== 'all') {
        params.append('status', selectedStatus);
      }

      const response = await api.get(`/admin/orders?${params.toString()}`);
      return response.data;
    },
  });

  // Update order status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      const response = await api.put(`/admin/orders/${orderId}`, { status });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      toast.success('Захиалгын төлөв шинэчлэгдлээ');
      setStatusChangeOrder(null);
      setNewStatus('');
    },
    onError: (error: any) => {
      toast.error(`Алдаа гарлаа: ${error.response?.data?.error || error.message}`);
    },
  });

  const handleStatusChange = () => {
    if (statusChangeOrder && newStatus) {
      updateStatusMutation.mutate({
        orderId: statusChangeOrder.id,
        status: newStatus,
      });
    }
  };

  const viewOrderDetails = async (orderId: string) => {
    try {
      const response = await api.get(`/admin/orders/${orderId}`);
      setSelectedOrder(response.data.order);
      setDetailsOpen(true);
    } catch (error) {
      toast.error('Захиалгын дэлгэрэнгүй мэдээлэл татахад алдаа гарлаа');
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: any; label: string }> = {
      PENDING: { variant: 'secondary', label: 'Хүлээгдэж буй' },
      PAID: { variant: 'default', label: 'Төлсөн' },
      SHIPPED: { variant: 'default', label: 'Илгээсэн' },
      COMPLETED: { variant: 'default', label: 'Дууссан' },
      CANCELLED: { variant: 'destructive', label: 'Цуцалсан' },
    };

    const config = statusConfig[status] || statusConfig.PENDING;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-2">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Уншиж байна...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <p className="text-destructive mb-2">Алдаа гарлаа</p>
          <Button onClick={() => queryClient.invalidateQueries({ queryKey: ['admin-orders'] })}>
            Дахин оролдох
          </Button>
        </div>
      </div>
    );
  }

  const orders = data?.orders || [];
  const pagination = data?.pagination;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Захиалгууд</h1>
          <p className="text-muted-foreground">
            Нийт {pagination?.total || 0} захиалга
          </p>
        </div>

        <div className="flex items-center gap-4">
          {/* Status Filter */}
          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Статусаар шүүх" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Бүгд</SelectItem>
              <SelectItem value="PENDING">Хүлээгдэж буй</SelectItem>
              <SelectItem value="PAID">Төлсөн</SelectItem>
              <SelectItem value="SHIPPED">Илгээсэн</SelectItem>
              <SelectItem value="COMPLETED">Дууссан</SelectItem>
              <SelectItem value="CANCELLED">Цуцалсан</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['admin-orders'] })}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Шинэчлэх
          </Button>
        </div>
      </div>

      {/* Orders Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Захиалгын дугаар</TableHead>
              <TableHead>Огноо ба цаг</TableHead>
              <TableHead>Хэрэглэгчийн нэр</TableHead>
              <TableHead>Утас</TableHead>
              <TableHead>Дүн</TableHead>
              <TableHead>Төлөв</TableHead>
              <TableHead className="text-right">Үйлдэл</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Захиалга олдсонгүй</p>
                </TableCell>
              </TableRow>
            ) : (
              orders.map((order) => {
                // Parse shipping address to get customer info
                let customerName = '-';
                let customerPhone = '-';
                try {
                  const shippingAddr = typeof order.shippingAddress === 'string'
                    ? JSON.parse(order.shippingAddress)
                    : order.shippingAddress;
                  customerName = shippingAddr?.fullName || '-';
                  customerPhone = shippingAddr?.phone || '-';
                } catch (e) {
                  // ignore parsing errors
                }

                return (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono text-sm">
                      #{order.id.substring(0, 8).toUpperCase()}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {new Date(order.createdAt).toLocaleDateString('mn-MN', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(order.createdAt).toLocaleTimeString('mn-MN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{customerName}</TableCell>
                    <TableCell className="text-sm">{customerPhone}</TableCell>
                    <TableCell className="font-semibold">
                      ₮{Number(order.total).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => {
                          setStatusChangeOrder(order);
                          setNewStatus(order.status);
                        }}
                        className="hover:opacity-80 transition"
                      >
                        {getStatusBadge(order.status)}
                      </button>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => viewOrderDetails(order.id)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Дэлгэрэнгүй
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground">
            Хуудас {pagination.page} / {pagination.totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
            >
              Өмнөх
            </Button>
            <Button
              variant="outline"
              onClick={() => setPage(page + 1)}
              disabled={page === pagination.totalPages}
            >
              Дараах
            </Button>
          </div>
        </div>
      )}

      {/* Order Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Захиалгын дэлгэрэнгүй</DialogTitle>
            <DialogDescription>
              Захиалгын дугаар: #{selectedOrder?.id.substring(0, 8).toUpperCase()}
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-4">
              {/* Order Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Огноо</p>
                  <p className="font-medium">
                    {new Date(selectedOrder.createdAt).toLocaleString('mn-MN')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Төлөв</p>
                  <div className="mt-1">{getStatusBadge(selectedOrder.status)}</div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Хэрэглэгч ID</p>
                  <p className="font-mono text-sm">{selectedOrder.userId}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Нийт дүн</p>
                  <p className="text-xl font-bold text-primary">
                    ₮{Number(selectedOrder.total).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Shipping Address */}
              {selectedOrder.shippingAddress && (
                <div>
                  <p className="text-sm font-semibold mb-2">Хүргэлтийн хаяг</p>
                  <div className="p-3 bg-muted rounded-lg text-sm space-y-1">
                    {(() => {
                      const addr = typeof selectedOrder.shippingAddress === 'string'
                        ? JSON.parse(selectedOrder.shippingAddress)
                        : selectedOrder.shippingAddress;
                      return (
                        <>
                          <p className="font-medium">{addr.fullName}</p>
                          <p>{addr.phone}</p>
                          <p>{addr.address}</p>
                          <p>{addr.city} {addr.zipCode}</p>
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* Order Items */}
              {selectedOrder.items && (
                <div>
                  <p className="text-sm font-semibold mb-2">Захиалсан бараа</p>
                  <div className="space-y-2">
                    {(() => {
                      const items = typeof selectedOrder.items === 'string'
                        ? JSON.parse(selectedOrder.items)
                        : selectedOrder.items;
                      return Array.isArray(items) ? items.map((item: any, index: number) => (
                        <div key={index} className="flex items-center gap-3 p-2 bg-muted rounded">
                          {item.imagePath && (
                            <img
                              src={item.imagePath}
                              alt={item.productName}
                              className="w-12 h-12 object-cover rounded"
                            />
                          )}
                          <div className="flex-1">
                            <p className="font-medium text-sm">{item.productName}</p>
                            <p className="text-xs text-muted-foreground">{item.variantName}</p>
                            <p className="text-xs">Тоо: {item.quantity}</p>
                          </div>
                          <p className="font-semibold">
                            ₮{(item.variantPrice * item.quantity).toLocaleString()}
                          </p>
                        </div>
                      )) : null;
                    })()}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailsOpen(false)}>
              Хаах
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Status Dialog */}
      <Dialog
        open={statusChangeOrder !== null}
        onOpenChange={(open) => {
          if (!open) {
            setStatusChangeOrder(null);
            setNewStatus('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Захиалгын төлөв өөрчлөх</DialogTitle>
            <DialogDescription>
              Захиалгын дугаар: #{statusChangeOrder?.id.substring(0, 8).toUpperCase()}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <p className="text-sm mb-2">Одоогийн төлөв:</p>
              {statusChangeOrder && getStatusBadge(statusChangeOrder.status)}
            </div>

            <div>
              <p className="text-sm mb-2">Шинэ төлөв:</p>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Төлөв сонгох" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PENDING">Хүлээгдэж буй</SelectItem>
                  <SelectItem value="PAID">Төлсөн</SelectItem>
                  <SelectItem value="SHIPPED">Илгээсэн</SelectItem>
                  <SelectItem value="COMPLETED">Дууссан</SelectItem>
                  <SelectItem value="CANCELLED">Цуцалсан</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setStatusChangeOrder(null);
                setNewStatus('');
              }}
            >
              Цуцлах
            </Button>
            <Button
              onClick={handleStatusChange}
              disabled={!newStatus || updateStatusMutation.isPending}
            >
              {updateStatusMutation.isPending ? 'Хадгалж байна...' : 'Хадгалах'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
