import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { WishlistProvider } from './context/WishlistContext';
import { ThemeProvider } from './context/ThemeContext';
import { Toaster } from 'sonner';
import Header from './components/layout/Header';
import CartSidebar from './components/layout/CartSidebar';

import HomePage from './pages/HomePage';
import Catalog from './pages/Catalog';
import ProductDetails from './pages/ProductDetails';
import CartPage from './pages/CartPage';
import WishlistPage from './pages/WishlistPage';
import CheckoutPage from './pages/CheckoutPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import AuthResetPassword from './pages/AuthResetPassword';
import OrdersPage from './pages/OrdersPage';
import OrderDetailPage from './pages/OrderDetailPage';
import ProfilePage from './pages/ProfilePage';
import ScrollToTop from './components/layout/ScrollToTop';

// Layout компонент: Хуудас бүрийн байршлыг зохицуулна
function Layout() {
  const location = useLocation();

  // Хэрэв бид '/customize' хуудас дээр байгаа бол тусгай горим (Full Screen)
  const isConfigurator = location.pathname === '/customize';

  return (
    <div className={`min-h-screen bg-background text-foreground font-sans transition-colors duration-300 ${isConfigurator ? 'overflow-hidden' : ''}`}>
      <Toaster
        position="top-right"
        richColors
        expand={false}
        toastOptions={{
          style: {
            zIndex: 9999,
            maxWidth: '400px',
            pointerEvents: 'auto',
          },
          duration: 3000,
          className: 'pointer-events-auto',
        }}
        style={{
          right: '1rem',
          top: '5rem',
        }}
      />
      <ScrollToTop />
      {/* Configurator дээр үндсэн Header болон Сагсыг НУУНА */}
      {!isConfigurator && <Header />}
      {!isConfigurator && <CartSidebar />}

      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/products" element={<Catalog />} />
          <Route path="/product/:id" element={<ProductDetails />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/wishlist" element={<WishlistPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/orders/:id" element={<OrderDetailPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/auth/reset" element={<AuthResetPassword />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <WishlistProvider>
          <CartProvider>
            <Router>
              <Layout />
            </Router>
          </CartProvider>
        </WishlistProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;