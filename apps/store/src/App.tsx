import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { CartProvider } from './context/CartContext';
import { ThemeProvider } from './context/ThemeContext';
import { Toaster } from 'sonner';
import Header from './components/layout/Header';
import CartSidebar from './components/layout/CartSidebar';

import Catalog from './pages/Catalog';
import ProductDetails from './pages/ProductDetails';
import Configurator from './pages/Configurator'; // ✅ Жинхэнэ Configurator-ийг орууллаа
import ScrollToTop from './components/layout/ScrollToTop';

// Layout компонент: Хуудас бүрийн байршлыг зохицуулна
function Layout() {
  const location = useLocation();
  
  // Хэрэв бид '/customize' хуудас дээр байгаа бол тусгай горим (Full Screen)
  const isConfigurator = location.pathname === '/customize';

  return (
    <div className={`min-h-screen bg-background text-foreground font-sans transition-colors duration-300 ${isConfigurator ? 'overflow-hidden' : ''}`}>
      <Toaster position="bottom-right" richColors />
      <ScrollToTop />
      {/* Configurator дээр үндсэн Header болон Сагсыг НУУНА */}
      {!isConfigurator && <Header />}
      {!isConfigurator && <CartSidebar />}
      
      <main>
        <Routes>
          <Route path="/" element={<Catalog />} />
          <Route path="/product/:id" element={<ProductDetails />} />
          
          {/* ✅ Жинхэнэ 3D Configurator-ийг холбов */}
          <Route path="/customize" element={<Configurator />} />
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