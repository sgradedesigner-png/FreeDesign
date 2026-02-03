import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { CartProvider } from './context/CartContext';
import { ThemeProvider } from './context/ThemeContext';
import { Toaster } from 'sonner';
import Header from './components/layout/Header';
import CartSidebar from './components/layout/CartSidebar';

import Catalog from './pages/Catalog';
import ProductDetails from './pages/ProductDetails';
import ScrollToTop from './components/layout/ScrollToTop';

// Layout компонент: Хуудас бүрийн байршлыг зохицуулна
function Layout() {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans transition-colors duration-300">
      <Toaster position="bottom-right" richColors />
      <ScrollToTop />
      <Header />
      <CartSidebar />
      
      <main>
        <Routes>
          <Route path="/" element={<Catalog />} />
          <Route path="/product/:id" element={<ProductDetails />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <CartProvider>
        <Router>
          <Layout />
        </Router>
      </CartProvider>
    </ThemeProvider>
  );
}

export default App;