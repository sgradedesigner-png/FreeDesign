import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/context/LanguageContext';
import {
  LayoutDashboard,
  Package,
  FolderTree,
  ShoppingCart,
  Settings,
  X,
} from 'lucide-react';

const menuItems = [
  { path: '/', icon: LayoutDashboard, labelKey: 'nav.dashboard' },
  { path: '/products', icon: Package, labelKey: 'nav.products' },
  { path: '/categories', icon: FolderTree, labelKey: 'nav.categories' },
  { path: '/orders', icon: ShoppingCart, labelKey: 'nav.orders' },
  { path: '/settings', icon: Settings, labelKey: 'nav.settings' },
];

type SidebarProps = {
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
};

export function Sidebar({ isMobileOpen = false, onMobileClose }: SidebarProps) {
  const location = useLocation();
  const { t } = useLanguage();

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden w-64 shrink-0 border-r border-border bg-card lg:flex lg:flex-col">
        {/* Logo */}
        <div className="h-16 border-b border-border px-6 flex items-center">
          <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Admin Panel
          </h1>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-accent hover:text-accent-foreground text-muted-foreground'
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{t(item.labelKey)}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-border">
          <p className="text-xs text-muted-foreground text-center">
            E-commerce Admin v1.0
          </p>
        </div>
      </div>

      {/* Mobile Sidebar Drawer */}
      <div
        className={cn(
          'fixed inset-0 z-50 lg:hidden',
          isMobileOpen ? 'block' : 'hidden'
        )}
        aria-hidden={!isMobileOpen}
      >
        <button
          type="button"
          className="absolute inset-0 bg-black/40"
          onClick={onMobileClose}
          aria-label="Close menu overlay"
        />

        <div className="relative flex h-full w-72 max-w-[85vw] flex-col border-r border-border bg-card shadow-xl">
          <div className="h-16 border-b border-border px-4 flex items-center justify-between">
            <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Admin Panel
            </h1>
            <button
              type="button"
              onClick={onMobileClose}
              className="p-2 rounded-md hover:bg-accent"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="flex-1 p-4 space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={onMobileClose}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-accent hover:text-accent-foreground text-muted-foreground'
                  )}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{t(item.labelKey)}</span>
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-border">
            <p className="text-xs text-muted-foreground text-center">
              E-commerce Admin v1.0
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
