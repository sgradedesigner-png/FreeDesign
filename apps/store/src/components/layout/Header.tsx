import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon, { type IconName } from '../ui/AppIcon';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import AuthModal from '../auth/AuthModal';
import { flags } from '@/lib/featureFlags';
import MegaMenu from './MegaMenu';

export default function Header() {
  const { cartCount, setIsCartOpen } = useCart();
  const { wishlistCount } = useWishlist();
  const { theme, toggleTheme, language, toggleLanguage, t } = useTheme();
  const { user, logout } = useAuth();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const navigate = useNavigate();

  const menuLabels = {
    products: { mn: 'Бүтээгдэхүүн', en: 'Products' },
    new: { mn: 'Шинэ бараа', en: 'New Arrivals' },
    collections: { mn: 'Цуглуулга', en: 'Collections' },
    about: { mn: 'Бидний тухай', en: 'About Us' },
    startOrder: { mn: 'Захиалга эхлүүлэх', en: 'Start Order' },
    search: { mn: 'Бүтээгдэхүүн хайх...', en: 'Search products...' }
  };

  type Label = { mn: string; en: string };
  type NavItem = { label: Label; href: string; icon: IconName };

  const navItems: NavItem[] = [
    ...(flags.DTF_NAV_V1
      ? [{ label: menuLabels.startOrder, href: '/start-order', icon: 'SparklesIcon' }]
      : []),
    { label: menuLabels.products, href: '/products', icon: 'ShoppingBagIcon' },
    { label: menuLabels.new, href: '/products?filter=new', icon: 'SparklesIcon' },
    { label: menuLabels.collections, href: '/products?filter=collections', icon: 'RectangleStackIcon' },
    { label: menuLabels.about, href: '/about', icon: 'InformationCircleIcon' },
  ];
  const brandLogoSrc = theme === 'dark' ? '/kg-goods-dark.svg' : '/kg-goods-light.svg';

  const handleSearch = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/products?search=${encodeURIComponent(searchQuery)}`);
      setIsSearchOpen(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    navigate('/products');
    setIsSearchOpen(false);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border transition-colors duration-300">
      <div className="container mx-auto px-3 sm:px-4 h-20 flex items-center justify-between gap-2">

        {/* Logo */}
        <Link to="/" className="group flex min-w-0 items-center gap-3">
          <img
            src={brandLogoSrc}
            alt="KG Goods"
            className="h-16 md:h-[72px] w-auto object-contain"
            loading="eager"
          />
        </Link>


        {/* Desktop Nav */}
        <nav className="hidden lg:flex items-center gap-1">
          {flags.DTF_NAV_V1 && <MegaMenu />}
          {navItems.map((item, idx) => (
            <Link
              key={idx}
              to={item.href}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              <Icon name={item.icon} size={18} />
              {t('label', item.label)}
            </Link>
          ))}
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">

          {/* Animated Search Box */}
          <div className="relative flex items-center justify-end">
             <div
                className={`flex items-center overflow-hidden transition-all duration-500 ease-in-out ${
                   isSearchOpen ? 'w-[min(72vw,18rem)] sm:w-64 opacity-100 pr-2' : 'w-0 opacity-0'
                }`}
             >
                <form onSubmit={handleSearch} className="relative w-full">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                      placeholder={t('search', menuLabels.search)}
                      className="w-full h-10 pl-4 pr-8 rounded-full border border-primary/30 bg-background text-foreground focus:ring-2 focus:ring-primary outline-none text-sm shadow-inner"
                    />
                    {searchQuery && (
                      <button type="button" onClick={clearSearch} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-destructive">
                          <Icon name="XMarkIcon" size={14} />
                      </button>
                    )}
                </form>
             </div>

             <button
                onClick={() => setIsSearchOpen(!isSearchOpen)}
                className={`p-2.5 rounded-full transition-all duration-300 ${
                   isSearchOpen ? 'bg-primary text-white rotate-90 scale-90' : 'hover:bg-muted text-foreground'
                }`}
             >
                <Icon name={isSearchOpen ? "XMarkIcon" : "MagnifyingGlassIcon"} size={20} />
             </button>
          </div>

          {/* Theme Toggle */}
          <button onClick={toggleTheme} className="hidden md:inline-flex p-2 hover:bg-muted rounded-lg text-foreground transition-colors">
            <Icon name={theme === 'dark' ? "SunIcon" : "MoonIcon"} size={20} />
          </button>

          <span className="hidden md:block h-6 w-px bg-border mx-1"></span>

          {/* Language Toggle */}
          <button onClick={toggleLanguage} className="hidden md:inline-flex px-3 py-1 text-sm font-bold text-foreground hover:bg-muted rounded-lg transition-colors uppercase">
            {language}
          </button>

          <span className="hidden md:block h-6 w-px bg-border mx-1"></span>

          {/* Auth Section */}
          {user ? (
            // Logged in - show user dropdown
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="inline-flex p-2 hover:bg-muted rounded-lg text-foreground transition-colors">
                  <Icon name="UserCircleIcon" size={20} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">Account</p>
                    <p className="text-xs leading-none text-muted-foreground truncate">
                      {user.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/orders')}>
                  <Icon name="ShoppingBagIcon" size={16} className="mr-2" />
                  {language === 'mn' ? 'Миний захиалга' : 'My Orders'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/profile')}>
                  <Icon name="UserCircleIcon" size={16} className="mr-2" />
                  {language === 'mn' ? 'Хувийн мэдээлэл' : 'Profile'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-red-600 dark:text-red-400">
                  <Icon name="ArrowRightOnRectangleIcon" size={16} className="mr-2" />
                  {language === 'mn' ? 'Гарах' : 'Logout'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            // Not logged in - show login button
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/login')}
              className="inline-flex text-foreground hover:bg-muted"
            >
              <Icon name="UserCircleIcon" size={18} className="md:mr-2" />
              <span className="hidden md:inline">{language === 'mn' ? 'Нэвтрэх' : 'Login'}</span>
            </Button>
          )}

          {/* Wishlist */}
          <Link
            to="/wishlist"
            className="hidden lg:flex items-center gap-2 px-4 py-2 border-2 border-border text-foreground hover:border-primary hover:text-primary hover:bg-primary/5 rounded-full transition-colors font-medium text-sm ml-2"
          >
            <Icon name="HeartIcon" size={18} />
            <span className="hidden sm:inline">{language === 'mn' ? 'Wishlist' : 'Wishlist'}</span>
            {wishlistCount > 0 && (
              <span className="min-w-[20px] rounded-full px-1.5 py-0.5 text-center text-xs font-bold bg-primary/10 text-primary">
                {wishlistCount}
              </span>
            )}
          </Link>

          {/* Cart */}
          <button
            data-testid="cart-icon"
            onClick={() => setIsCartOpen(true)}
            className="flex items-center gap-2 px-2.5 sm:px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-full transition-colors font-medium text-sm shadow-lg shadow-primary/20"
          >
            <Icon name="ShoppingBagIcon" size={18} />
            <span className="hidden sm:inline">{language === 'mn' ? 'Сагс' : 'Cart'}</span>
            {cartCount > 0 && (
               <span data-testid="cart-badge" className="min-w-[20px] rounded-full px-1.5 py-0.5 text-center text-xs font-bold bg-primary-foreground/20 text-primary-foreground">

             {cartCount}
              </span>
            )}
          </button>

        </div>
      </div>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />
    </header>
  );
}
