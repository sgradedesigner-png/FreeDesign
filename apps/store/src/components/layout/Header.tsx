import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon, { type IconName } from '../ui/AppIcon';
import { useCart } from '../../context/CartContext';
import { useTheme } from '../../context/ThemeContext';

export default function Header() {
  const { cartCount, setIsCartOpen } = useCart();
  const { theme, toggleTheme, language, toggleLanguage, t } = useTheme();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  // ✅ ЭНЭ ХЭСЭГ ДУТУУ БАЙСАН БАЙХ: Цэсний орчуулгууд
  const menuLabels = {
    products: { mn: 'Бүтээгдэхүүн', en: 'Products' },
    new: { mn: 'Шинэ бараа', en: 'New Arrivals' },
    collections: { mn: 'Цуглуулга', en: 'Collections' },
    about: { mn: 'Бидний тухай', en: 'About Us' },
    search: { mn: 'Бүтээгдэхүүн хайх...', en: 'Search products...' }
  };

  type Label = { mn: string; en: string };
  type NavItem = { label: Label; href: string; icon: IconName };

  const navItems: NavItem[] = [
    { label: menuLabels.products, href: '/', icon: 'ShoppingBagIcon' },
    { label: menuLabels.new, href: '/?filter=new', icon: 'SparklesIcon' },
    { label: menuLabels.collections, href: '/?filter=collections', icon: 'RectangleStackIcon' },
    { label: menuLabels.about, href: '/about', icon: 'InformationCircleIcon' },
  ];

  const handleSearch = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/?search=${encodeURIComponent(searchQuery)}`);
      setIsSearchOpen(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    navigate('/');
    setIsSearchOpen(false);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border transition-colors duration-300">
      <div className="container mx-auto px-4 h-20 flex items-center justify-between">

       {/* Logo */}
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-bold text-xl group-hover:scale-105 transition-transform shadow-lg shadow-primary/20">
            3D
          </div>
          <span className="font-heading text-2xl font-bold text-foreground tracking-tight flex items-center">
            <span>No</span>
            {/* ✅ "MAD" хэсэгт 'green-fire' классыг нэмэв */}
            <span className="green-fire mx-0.5 text-white font-black">MAD</span>
            <span>esign</span>
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden lg:flex items-center gap-1">
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
        <div className="flex items-center gap-2">

          {/* Animated Search Box */}
          <div className="relative flex items-center justify-end">
             <div
                className={`flex items-center overflow-hidden transition-all duration-500 ease-in-out ${
                   isSearchOpen ? 'w-64 opacity-100 pr-2' : 'w-0 opacity-0'
                }`}
             >
                <form onSubmit={handleSearch} className="relative w-full">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                      // ✅ Энд menuLabels ашиглаж байгаа тул дээр заавал зарласан байх ёстой
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
          <button onClick={toggleTheme} className="p-2 hover:bg-muted rounded-lg text-foreground transition-colors">
            <Icon name={theme === 'dark' ? "SunIcon" : "MoonIcon"} size={20} />
          </button>

          <span className="h-6 w-px bg-border mx-1"></span>

          {/* Language Toggle */}
          <button onClick={toggleLanguage} className="px-3 py-1 text-sm font-bold text-foreground hover:bg-muted rounded-lg transition-colors uppercase">
            {language}
          </button>

          {/* Cart */}
          <button
            onClick={() => setIsCartOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-full transition-colors font-medium text-sm ml-2 shadow-lg shadow-primary/20"
          >
            <Icon name="ShoppingBagIcon" size={18} />
            <span className="hidden sm:inline">{language === 'mn' ? 'Сагс' : 'Cart'}</span>
            {cartCount > 0 && (
               <span className="min-w-[20px] rounded-full px-1.5 py-0.5 text-center text-xs font-bold bg-primary-foreground/20 text-primary-foreground">
   
             {cartCount}
              </span>
            )}
          </button>

        </div>
      </div>
    </header>
  );
}
