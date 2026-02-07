import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { api } from '../lib/api';
import { Package, FolderTree, TrendingUp, TrendingDown, DollarSign, ArrowRight, } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AreaChart, Area, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend, } from 'recharts';
import { format, subDays } from 'date-fns';
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
    const [revenueData] = useState(generateRevenueData());
    const [isMobile, setIsMobile] = useState(false);
    useEffect(() => {
        const mq = window.matchMedia('(max-width: 640px)');
        const onChange = (event) => setIsMobile(event.matches);
        setIsMobile(mq.matches);
        mq.addEventListener('change', onChange);
        return () => mq.removeEventListener('change', onChange);
    }, []);
    // Fetch stats with React Query (cached, fast)
    const { data: stats, isLoading: statsLoading } = useQuery({
        queryKey: ['dashboard-stats'],
        queryFn: async () => {
            const { data } = await api.get('/admin/stats');
            return data;
        },
        staleTime: 30000, // 30 seconds
        gcTime: 300000, // 5 minutes
    });
    const StatCard = ({ title, value, icon: Icon, trend, trendValue, }) => (_jsxs("div", { className: "rounded-xl border bg-card p-4 sm:p-6 shadow-sm hover:shadow-md transition-shadow", children: [_jsxs("div", { className: "flex items-center justify-between mb-3 sm:mb-4", children: [_jsx("div", { className: "w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-primary/10 flex items-center justify-center", children: _jsx(Icon, { className: "w-5 h-5 sm:w-6 sm:h-6 text-primary" }) }), trend && trendValue && (_jsxs("div", { className: `flex items-center gap-1 text-xs sm:text-sm font-medium ${trend === 'up' ? 'text-green-600' : 'text-red-600'}`, children: [trend === 'up' ? (_jsx(TrendingUp, { className: "w-4 h-4" })) : (_jsx(TrendingDown, { className: "w-4 h-4" })), trendValue] }))] }), _jsx("p", { className: "text-sm text-muted-foreground mb-1", children: title }), _jsx("p", { className: "text-2xl sm:text-3xl font-bold", children: statsLoading ? '—' : value })] }));
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl sm:text-3xl font-bold", children: "Dashboard" }), _jsxs("p", { className: "text-muted-foreground", children: ["Welcome back, ", user?.email?.split('@')[0] || 'Admin'] })] }), _jsxs("div", { className: "grid gap-4 sm:gap-6 sm:grid-cols-2 xl:grid-cols-3", children: [_jsx(StatCard, { title: "Total Products", value: stats?.productsCount ?? 0, icon: Package, trend: "up", trendValue: "+12%" }), _jsx(StatCard, { title: "Categories", value: stats?.categoriesCount ?? 0, icon: FolderTree }), _jsx(StatCard, { title: "Inventory Value", value: `$${stats ? stats.totalRevenue.toFixed(0) : '0'}`, icon: DollarSign, trend: "up", trendValue: "+8%" })] }), _jsxs("div", { className: "grid gap-6 xl:grid-cols-2", children: [_jsxs("div", { className: "rounded-xl border bg-card p-6 shadow-sm", children: [_jsxs("div", { className: "mb-6", children: [_jsx("h3", { className: "text-lg font-semibold", children: "Revenue Overview" }), _jsx("p", { className: "text-sm text-muted-foreground", children: "Last 7 days revenue trend" })] }), _jsx(ResponsiveContainer, { width: "100%", height: isMobile ? 220 : 300, children: _jsxs(AreaChart, { data: revenueData, children: [_jsx("defs", { children: _jsxs("linearGradient", { id: "colorRevenue", x1: "0", y1: "0", x2: "0", y2: "1", children: [_jsx("stop", { offset: "5%", stopColor: "#3b82f6", stopOpacity: 0.3 }), _jsx("stop", { offset: "95%", stopColor: "#3b82f6", stopOpacity: 0 })] }) }), _jsx(CartesianGrid, { strokeDasharray: "3 3", stroke: "#e5e7eb" }), _jsx(XAxis, { dataKey: "date", stroke: "#6b7280", fontSize: isMobile ? 10 : 12 }), _jsx(YAxis, { stroke: "#6b7280", fontSize: isMobile ? 10 : 12 }), _jsx(Tooltip, { contentStyle: {
                                                backgroundColor: 'white',
                                                border: '1px solid #e5e7eb',
                                                borderRadius: '8px',
                                            } }), _jsx(Area, { type: "monotone", dataKey: "revenue", stroke: "#3b82f6", strokeWidth: 2, fill: "url(#colorRevenue)" })] }) })] }), _jsxs("div", { className: "rounded-xl border bg-card p-6 shadow-sm", children: [_jsxs("div", { className: "mb-6", children: [_jsx("h3", { className: "text-lg font-semibold", children: "Category Distribution" }), _jsx("p", { className: "text-sm text-muted-foreground", children: "Products by category" })] }), statsLoading || !stats ? (_jsx("div", { className: "h-[300px] flex items-center justify-center text-muted-foreground", children: "Loading..." })) : stats.categoryDistribution.length > 0 ? (_jsx(ResponsiveContainer, { width: "100%", height: isMobile ? 240 : 300, children: _jsxs(PieChart, { children: [_jsx(Pie, { data: stats.categoryDistribution, cx: "50%", cy: "50%", labelLine: !isMobile, label: isMobile
                                                ? undefined
                                                : ({ name, percent }) => {
                                                    const safePercent = typeof percent === 'number' ? percent : 0;
                                                    return `${name} ${(safePercent * 100).toFixed(0)}%`;
                                                }, outerRadius: isMobile ? 78 : 100, fill: "#8884d8", dataKey: "value", children: stats.categoryDistribution.map((entry, index) => (_jsx(Cell, { fill: COLORS[index % COLORS.length] }, `cell-${index}`))) }), _jsx(Tooltip, {}), isMobile ? _jsx(Legend, { verticalAlign: "bottom", height: 32 }) : null] }) })) : (_jsx("div", { className: "h-[300px] flex items-center justify-center text-muted-foreground", children: "No data available" }))] })] }), !statsLoading && stats && stats.recentProducts.length > 0 && (_jsxs("div", { className: "rounded-xl border bg-card p-6 shadow-sm", children: [_jsxs("div", { className: "mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-lg font-semibold", children: "Recent Products" }), _jsx("p", { className: "text-sm text-muted-foreground", children: "Latest additions to your catalog" })] }), _jsxs(Button, { variant: "ghost", size: "sm", className: "self-start sm:self-auto", onClick: () => nav('/products'), children: ["View all", _jsx(ArrowRight, { className: "w-4 h-4 ml-2" })] })] }), _jsx("div", { className: "space-y-3", children: (isMobile ? stats.recentProducts.slice(0, 4) : stats.recentProducts).map((product) => {
                            const firstVariant = product.variants[0];
                            const totalStock = product.variants.reduce((sum, v) => sum + v.stock, 0);
                            const avgPrice = product.variants.reduce((sum, v) => sum + v.price, 0) / product.variants.length;
                            return (_jsxs("div", { className: "group flex flex-col gap-4 rounded-lg p-4 transition-colors hover:bg-muted/50 cursor-pointer sm:flex-row sm:items-center", onClick: () => nav(`/products/${product.id}`), children: [firstVariant?.imagePath ? (_jsx("img", { src: firstVariant.imagePath, alt: product.title, className: "w-16 h-16 rounded-lg object-cover" })) : (_jsx("div", { className: "w-16 h-16 rounded-lg bg-muted flex items-center justify-center text-muted-foreground text-xs", children: "No image" })), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("p", { className: "font-medium truncate group-hover:text-primary transition-colors", children: product.title }), _jsxs("div", { className: "mt-1 flex flex-wrap items-center gap-2", children: [_jsx(Badge, { variant: "secondary", className: "text-xs", children: product.category.name }), _jsxs("span", { className: "text-sm text-muted-foreground", children: ["Stock: ", totalStock, " (", product.variants.length, " variants)"] })] })] }), _jsxs("div", { className: "text-left sm:text-right", children: [_jsxs("p", { className: "text-lg font-semibold", children: ["$", avgPrice.toFixed(2)] }), _jsx("p", { className: "text-xs text-muted-foreground", children: format(new Date(product.createdAt), 'MMM dd, yyyy') })] })] }, product.id));
                        }) })] })), _jsxs("div", { className: "rounded-xl border bg-card p-6 shadow-sm", children: [_jsx("h3", { className: "text-lg font-semibold mb-4", children: "Quick Actions" }), _jsxs("div", { className: "grid gap-3 sm:grid-cols-2 xl:grid-cols-3", children: [_jsxs(Button, { variant: "outline", className: "justify-start", onClick: () => nav('/products/new'), children: [_jsx(Package, { className: "w-4 h-4 mr-2" }), "Add New Product"] }), _jsxs(Button, { variant: "outline", className: "justify-start", onClick: () => nav('/categories'), children: [_jsx(FolderTree, { className: "w-4 h-4 mr-2" }), "Manage Categories"] }), _jsxs(Button, { variant: "outline", className: "justify-start", onClick: () => nav('/products'), children: [_jsx(TrendingUp, { className: "w-4 h-4 mr-2" }), "View All Products"] })] })] })] }));
}
