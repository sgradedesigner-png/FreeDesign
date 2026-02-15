import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Language = 'en' | 'mn';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const translations: Record<Language, Record<string, string>> = {
  en: {
    // Navigation
    'nav.dashboard': 'Dashboard',
    'nav.products': 'Products',
    'nav.categories': 'Categories',
    'nav.collections': 'Collections',
    'nav.orders': 'Orders',
    'nav.production': 'Production',
    'nav.pricing': 'Pricing Rules',
    'nav.emailTest': 'Email Test',
    'nav.settings': 'Settings',
    'nav.logout': 'Logout',

    // Dashboard
    'dashboard.title': 'Dashboard',
    'dashboard.welcome': 'Welcome back',
    'dashboard.totalProducts': 'Total Products',
    'dashboard.categories': 'Categories',
    'dashboard.inventoryValue': 'Inventory Value',

    // Products
    'products.title': 'Products',
    'products.addNew': 'Add New Product',
    'products.search': 'Search products...',
    'products.name': 'Name',
    'products.category': 'Category',
    'products.price': 'Price',
    'products.stock': 'Stock',
    'products.status': 'Status',
    'products.actions': 'Actions',
    'products.edit': 'Edit',
    'products.delete': 'Delete',

    // Orders
    'orders.title': 'Orders',
    'orders.orderNumber': 'Order Number',
    'orders.dateTime': 'Date & Time',
    'orders.customerName': 'Customer Name',
    'orders.phone': 'Phone',
    'orders.amount': 'Amount',
    'orders.status': 'Status',
    'orders.actions': 'Actions',
    'orders.viewDetails': 'View Details',
    'orders.total': 'Total',
    'orders.refresh': 'Refresh',

    // Status
    'status.pending': 'Pending',
    'status.paid': 'Paid',
    'status.shipped': 'Shipped',
    'status.completed': 'Completed',
    'status.cancelled': 'Cancelled',

    // Common
    'common.loading': 'Loading...',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.search': 'Search',
    'common.filter': 'Filter',
    'common.export': 'Export',
    'common.import': 'Import',
  },
  mn: {
    // Navigation
    'nav.dashboard': 'Хянах самбар',
    'nav.products': 'Бүтээгдэхүүн',
    'nav.categories': 'Ангилал',
    'nav.collections': 'Цуглуулга',
    'nav.orders': 'Захиалга',
    'nav.production': 'Үйлдвэрлэл',
    'nav.pricing': 'Үнийн дүрэм',
    'nav.emailTest': 'Email тест',
    'nav.settings': 'Тохиргоо',
    'nav.logout': 'Гарах',

    // Dashboard
    'dashboard.title': 'Хянах самбар',
    'dashboard.welcome': 'Тавтай морилно уу',
    'dashboard.totalProducts': 'Нийт бүтээгдэхүүн',
    'dashboard.categories': 'Ангилал',
    'dashboard.inventoryValue': 'Нийт үнэ',

    // Products
    'products.title': 'Бүтээгдэхүүн',
    'products.addNew': 'Шинэ нэмэх',
    'products.search': 'Бүтээгдэхүүн хайх...',
    'products.name': 'Нэр',
    'products.category': 'Ангилал',
    'products.price': 'Үнэ',
    'products.stock': 'Нөөц',
    'products.status': 'Төлөв',
    'products.actions': 'Үйлдэл',
    'products.edit': 'Засах',
    'products.delete': 'Устгах',

    // Orders
    'orders.title': 'Захиалгууд',
    'orders.orderNumber': 'Захиалгын дугаар',
    'orders.dateTime': 'Огноо ба цаг',
    'orders.customerName': 'Хэрэглэгчийн нэр',
    'orders.phone': 'Утас',
    'orders.amount': 'Дүн',
    'orders.status': 'Төлөв',
    'orders.actions': 'Үйлдэл',
    'orders.viewDetails': 'Дэлгэрэнгүй',
    'orders.total': 'Нийт',
    'orders.refresh': 'Шинэчлэх',

    // Status
    'status.pending': 'Хүлээгдэж буй',
    'status.paid': 'Төлөгдсөн',
    'status.shipped': 'Илгээсэн',
    'status.completed': 'Дууссан',
    'status.cancelled': 'Цуцлагдсан',

    // Common
    'common.loading': 'Уншиж байна...',
    'common.save': 'Хадгалах',
    'common.cancel': 'Цуцлах',
    'common.delete': 'Устгах',
    'common.edit': 'Засах',
    'common.search': 'Хайх',
    'common.filter': 'Шүүх',
    'common.export': 'Татах',
    'common.import': 'Оруулах',
  },
};

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('admin-language');
    return (saved === 'mn' || saved === 'en') ? saved : 'en';
  });

  useEffect(() => {
    localStorage.setItem('admin-language', language);
  }, [language]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
  };

  const toggleLanguage = () => {
    setLanguageState(prev => prev === 'en' ? 'mn' : 'en');
  };

  const t = (key: string): string => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
}
