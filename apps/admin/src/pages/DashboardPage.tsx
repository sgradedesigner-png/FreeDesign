import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { api } from '../lib/api';
import {
  Package,
  FolderTree,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ArrowRight,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { format, subDays } from 'date-fns';

type Category = {
  id: string;
  name: string;
};

type Product = {
  id: string;
  title: string;
  price: string;
  stock: number;
  category: Category;
  images: string[];
  createdAt: string;
};

type ProductsResponse = {
  items: Product[];
  total: number;
};

// Mock revenue data for the chart (in a real app, this would come from orders)
const generateRevenueData = () => {
  return Array.from({ length: 7 }, (_, i) => ({
    date: format(subDays(new Date(), 6 - i), 'MMM dd'),
    revenue: Math.floor(Math.random() * 5000) + 2000,
  }));
};

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#6366f1'];

export default function DashboardPage() {
  const nav = useNavigate();
  const { user } = useAuth();

  const [stats, setStats] = useState<{
    productsCount: number;
    categoriesCount: number;
    totalRevenue: number;
    recentProducts: Product[];
    categoryDistribution: Array<{ name: string; value: number }>;
  } | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [revenueData] = useState(generateRevenueData());

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setStatsLoading(true);
        const [productsRes, categoriesRes] = await Promise.all([
          api.get<ProductsResponse>('/admin/products', { params: { limit: 5 } }),
          api.get<Category[]>('/admin/categories'),
        ]);

        // Calculate category distribution
        const allProductsRes = await api.get<ProductsResponse>('/admin/products', {
          params: { limit: 1000 },
        });
        const categoryMap = new Map<string, number>();
        allProductsRes.data.items.forEach((product) => {
          const catName = product.category.name;
          categoryMap.set(catName, (categoryMap.get(catName) || 0) + 1);
        });
        const categoryDistribution = Array.from(categoryMap.entries()).map(([name, value]) => ({
          name,
          value,
        }));

        // Calculate total revenue (sum of all product prices * stock)
        const totalRevenue = allProductsRes.data.items.reduce(
          (sum, product) => sum + parseFloat(product.price) * product.stock,
          0
        );

        setStats({
          productsCount: productsRes.data.total,
          categoriesCount: categoriesRes.data.length,
          totalRevenue,
          recentProducts: productsRes.data.items,
          categoryDistribution,
        });
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setStatsLoading(false);
      }
    };

    fetchStats();
  }, []);

  const StatCard = ({
    title,
    value,
    icon: Icon,
    trend,
    trendValue,
  }: {
    title: string;
    value: string | number;
    icon: any;
    trend?: 'up' | 'down';
    trendValue?: string;
  }) => (
    <div className="rounded-xl border bg-card p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="w-6 h-6 text-primary" />
        </div>
        {trend && trendValue && (
          <div
            className={`flex items-center gap-1 text-sm font-medium ${
              trend === 'up' ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {trend === 'up' ? (
              <TrendingUp className="w-4 h-4" />
            ) : (
              <TrendingDown className="w-4 h-4" />
            )}
            {trendValue}
          </div>
        )}
      </div>
      <p className="text-sm text-muted-foreground mb-1">{title}</p>
      <p className="text-3xl font-bold">{statsLoading ? '—' : value}</p>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back, {user?.email?.split('@')[0] || 'Admin'}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-3">
        <StatCard
          title="Total Products"
          value={stats?.productsCount ?? 0}
          icon={Package}
          trend="up"
          trendValue="+12%"
        />
        <StatCard
          title="Categories"
          value={stats?.categoriesCount ?? 0}
          icon={FolderTree}
        />
        <StatCard
          title="Inventory Value"
          value={`$${stats ? stats.totalRevenue.toFixed(0) : '0'}`}
          icon={DollarSign}
          trend="up"
          trendValue="+8%"
        />
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Revenue Chart */}
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="mb-6">
            <h3 className="text-lg font-semibold">Revenue Overview</h3>
            <p className="text-sm text-muted-foreground">Last 7 days revenue trend</p>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={revenueData}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" stroke="#6b7280" fontSize={12} />
              <YAxis stroke="#6b7280" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="url(#colorRevenue)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Category Distribution */}
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="mb-6">
            <h3 className="text-lg font-semibold">Category Distribution</h3>
            <p className="text-sm text-muted-foreground">Products by category</p>
          </div>
          {statsLoading || !stats ? (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              Loading...
            </div>
          ) : stats.categoryDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={stats.categoryDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {stats.categoryDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              No data available
            </div>
          )}
        </div>
      </div>

      {/* Recent Products */}
      {!statsLoading && stats && stats.recentProducts.length > 0 && (
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold">Recent Products</h3>
              <p className="text-sm text-muted-foreground">Latest additions to your catalog</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => nav('/products')}>
              View all
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
          <div className="space-y-3">
            {stats.recentProducts.map((product) => (
              <div
                key={product.id}
                className="flex items-center gap-4 p-4 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group"
                onClick={() => nav(`/products/${product.id}`)}
              >
                {product.images[0] ? (
                  <img
                    src={product.images[0]}
                    alt={product.title}
                    className="w-16 h-16 rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center text-muted-foreground text-xs">
                    No image
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate group-hover:text-primary transition-colors">
                    {product.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className="text-xs">
                      {product.category.name}
                    </Badge>
                    <span className="text-sm text-muted-foreground">Stock: {product.stock}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold">${parseFloat(product.price).toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(product.createdAt), 'MMM dd, yyyy')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
        <div className="grid gap-3 md:grid-cols-3">
          <Button variant="outline" className="justify-start" onClick={() => nav('/products/new')}>
            <Package className="w-4 h-4 mr-2" />
            Add New Product
          </Button>
          <Button variant="outline" className="justify-start" onClick={() => nav('/categories')}>
            <FolderTree className="w-4 h-4 mr-2" />
            Manage Categories
          </Button>
          <Button variant="outline" className="justify-start" onClick={() => nav('/products')}>
            <TrendingUp className="w-4 h-4 mr-2" />
            View All Products
          </Button>
        </div>
      </div>
    </div>
  );
}
