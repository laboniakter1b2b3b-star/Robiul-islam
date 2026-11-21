import { useState, useEffect, FormEvent } from 'react';
import {
  Search,
  ShoppingBag,
  Sun,
  Moon,
  X,
  ArrowRight,
  MapPin,
  Phone,
  Mail,
  SlidersHorizontal,
  Check,
  Menu,
  Heart,
  GitCompareArrows,
  Lock,
  Plus,
  Package,
  HelpCircle,
  ExternalLink,
} from 'lucide-react';
import {
  CartItem,
  Category,
  ContactMessage,
  Coupon,
  Language,
  Order,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  PolicyKey,
  Product,
  ProductReview,
  StockHistoryEntry,
  StoreSettings,
} from './types';
import {
  CATEGORY_LABELS_BN,
  COPY,
  INITIAL_CATEGORIES,
  INITIAL_COUPONS,
  INITIAL_PRODUCTS,
  INITIAL_REVIEWS,
  INITIAL_SETTINGS,
  INITIAL_STOCK_HISTORY,
  formatBDT,
  getDiscountPercent,
  getEffectivePrice,
  isSafeExternalUrl,
} from './data/storeData';
import { ProductImage } from './components/ProductImage';
import { ProductDetailModal } from './components/ProductDetailModal';
import { CartDrawer } from './components/CartDrawer';
import { OrderTrackerModal } from './components/OrderTrackerModal';
import { ContactPolicyModal } from './components/ContactPolicyModal';
import { CompareModal, WishlistModal } from './components/CompareWishlistModal';
import { AdminConsole } from './components/AdminConsole';
import { AdminLoginModal } from './components/AdminLoginModal';

const CART_STORAGE_KEY = 'shopnexa_guest_cart_v1';
const WISHLIST_STORAGE_KEY = 'shopnexa_guest_wishlist_v1';

function loadGuestCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // Ignore storage read errors
  }
  return [];
}

function loadGuestWishlist(): number[] {
  try {
    const raw = localStorage.getItem(WISHLIST_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter((id) => typeof id === 'number');
    }
  } catch {
    // Ignore storage read errors
  }
  return [];
}

export default function App() {
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [categories, setCategories] = useState<Category[]>(INITIAL_CATEGORIES);
  const [coupons, setCoupons] = useState<Coupon[]>(INITIAL_COUPONS);
  const [settings, setSettings] = useState<StoreSettings>(INITIAL_SETTINGS);
  const [reviews, setReviews] = useState<ProductReview[]>(INITIAL_REVIEWS);
  const [recentGuestOrders, setRecentGuestOrders] = useState<Order[]>([]);
  const [cart, setCart] = useState<CartItem[]>(loadGuestCart);
  const [wishlistIds, setWishlistIds] = useState<number[]>(loadGuestWishlist);
  const [compareIds, setCompareIds] = useState<number[]>([]);

  // Admin state kept strictly behind server-verified Bearer token in React memory
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [adminUsername, setAdminUsername] = useState<string>('');
  const [adminProducts, setAdminProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [adminCoupons, setAdminCoupons] = useState<Coupon[]>(INITIAL_COUPONS);
  const [adminOrders, setAdminOrders] = useState<Order[]>([]);
  const [adminMessages, setAdminMessages] = useState<ContactMessage[]>([]);
  const [adminStockHistory, setAdminStockHistory] =
    useState<StockHistoryEntry[]>(INITIAL_STOCK_HISTORY);
  const [openAddProductOnAdmin, setOpenAddProductOnAdmin] = useState<
    false | 'standard' | 'affiliate'
  >(false);

  const [lang, setLang] = useState<Language>('bn');
  const [langMode, setLangMode] = useState<'auto' | 'bn' | 'en'>('bn');
  const [darkMode, setDarkMode] = useState(true);
  const [viewMode, setViewMode] = useState<'storefront' | 'admin'>(() =>
    window.location.pathname.startsWith('/admin') || window.location.hash === '#admin'
      ? 'admin'
      : 'storefront'
  );
  const [showPromoBanner, setShowPromoBanner] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'default' | 'price-asc' | 'price-desc' | 'discount'>('default');
  const [offersOnly, setOffersOnly] = useState(false);
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isTrackerOpen, setIsTrackerOpen] = useState(false);
  const [isWishlistOpen, setIsWishlistOpen] = useState(false);
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [activePolicy, setActivePolicy] = useState<PolicyKey | null>(null);
  const [justAddedId, setJustAddedId] = useState<number | null>(null);

  const [newsletterInput, setNewsletterInput] = useState('');
  const [newsletterSaved, setNewsletterSaved] = useState(false);

  const fetchPublicStore = async () => {
    try {
      const res = await fetch('/api/store');
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.products)) setProducts(data.products);
      if (Array.isArray(data.categories)) setCategories(data.categories);
      if (Array.isArray(data.coupons)) setCoupons(data.coupons);
      if (Array.isArray(data.reviews)) setReviews(data.reviews);
      if (data.settings) setSettings(data.settings);
    } catch {
      // Retain initial seed values if offline
    }
  };

  const fetchAdminDashboard = async (token: string) => {
    const res = await fetch('/api/admin/dashboard', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) {
      setAdminToken(null);
      setAdminUsername('');
      return;
    }
    if (!res.ok) return;
    const data = await res.json();
    if (Array.isArray(data.products)) setAdminProducts(data.products);
    if (Array.isArray(data.coupons)) setAdminCoupons(data.coupons);
    if (Array.isArray(data.orders)) setAdminOrders(data.orders);
    if (Array.isArray(data.messages)) setAdminMessages(data.messages);
    if (Array.isArray(data.stockHistory)) setAdminStockHistory(data.stockHistory);
    if (data.settings) setSettings(data.settings);
    if (data.adminUsername) setAdminUsername(data.adminUsername);
  };

  useEffect(() => {
    fetchPublicStore();
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [darkMode]);

  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // Ignore storage quota errors
    }
  }, [cart]);

  useEffect(() => {
    try {
      localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(wishlistIds));
    } catch {
      // Ignore storage quota errors
    }
  }, [wishlistIds]);

  useEffect(() => {
    const onHashChange = () => {
      if (window.location.hash === '#admin') {
        setViewMode('admin');
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const handleToggleWishlist = (productId: number) => {
    setWishlistIds((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]
    );
  };

  const handleToggleCompare = (productId: number) => {
    setCompareIds((prev) => {
      if (prev.includes(productId)) return prev.filter((id) => id !== productId);
      if (prev.length >= 3) return [...prev.slice(1), productId];
      return [...prev, productId];
    });
  };

  const handleSelectLanguageMode = (mode: 'auto' | 'bn' | 'en') => {
    setLangMode(mode);
    if (mode === 'auto') {
      const navLang = navigator.language?.toLowerCase() || 'bn';
      setLang(navLang.startsWith('en') ? 'en' : 'bn');
    } else {
      setLang(mode);
    }
  };

  const t = COPY[lang];
  const bagCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const activeProducts = products.filter((p) => p.status === 'Active');
  const filteredProducts = activeProducts
    .filter((product) => {
      const matchesCategory =
        selectedCategory === 'All' || product.category === selectedCategory;
      const matchesOffer =
        !offersOnly ||
        (product.discountPrice !== null && product.discountPrice < product.regularPrice);
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        product.name.toLowerCase().includes(q) ||
        product.category.toLowerCase().includes(q) ||
        product.subcategory.toLowerCase().includes(q) ||
        product.brand.toLowerCase().includes(q) ||
        product.sku.toLowerCase().includes(q);
      return matchesCategory && matchesOffer && matchesSearch;
    })
    .sort((a, b) => {
      if (sortBy === 'price-asc') return getEffectivePrice(a) - getEffectivePrice(b);
      if (sortBy === 'price-desc') return getEffectivePrice(b) - getEffectivePrice(a);
      if (sortBy === 'discount') {
        return (getDiscountPercent(b) || 0) - (getDiscountPercent(a) || 0);
      }
      return 0;
    });

  const handleAddToCart = (
    product: Product,
    variant: string,
    quantity: number,
    openDrawer = false
  ) => {
    if (product.productType === 'affiliate') return;
    setCart((prev) => {
      const existing = prev.find(
        (item) => item.productId === product.id && item.variant === variant
      );
      if (existing) {
        return prev.map((item) =>
          item.productId === product.id && item.variant === variant
            ? { ...item, quantity: Math.min(product.stock, item.quantity + quantity) }
            : item
        );
      }
      return [...prev, { productId: product.id, variant, quantity }];
    });
    setJustAddedId(product.id);
    setTimeout(() => setJustAddedId(null), 1400);
    if (openDrawer) {
      setIsCartOpen(true);
    }
  };

  const handleUpdateCartQty = (productId: number, variant: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.productId === productId && item.variant === variant
            ? { ...item, quantity: item.quantity + delta }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const handleRemoveCartItem = (productId: number, variant: string) => {
    setCart((prev) =>
      prev.filter((item) => !(item.productId === productId && item.variant === variant))
    );
  };

  const handlePlaceOrder = async (orderData: {
    customerName: string;
    phone: string;
    email: string;
    district: string;
    area: string;
    fullAddress: string;
    deliveryZone: 'dhaka' | 'outside';
    paymentMethod: PaymentMethod;
    trxId: string;
    couponCode: string;
    discountAmount: number;
    deliveryFee: number;
    subtotal: number;
    total: number;
  }): Promise<Order> => {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...orderData,
        items: cart,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Unable to place order.');
    }

    const createdOrder = data.order as Order;
    setRecentGuestOrders((prev) => [createdOrder, ...prev]);
    setCart([]);
    await fetchPublicStore();
    return createdOrder;
  };

  const handleAddReview = async (
    productId: number,
    author: string,
    rating: number,
    comment: string
  ) => {
    const res = await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, author, rating, comment }),
    });
    if (res.ok) {
      const data = await res.json();
      setReviews((prev) => [data.review, ...prev]);
    }
  };

  const handleNewsletterSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!newsletterInput.trim()) return;
    const res = await fetch('/api/newsletter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: newsletterInput.trim() }),
    });
    if (res.ok) {
      setNewsletterInput('');
      setNewsletterSaved(true);
      setTimeout(() => setNewsletterSaved(false), 2500);
    }
  };

  const handleAdminAuthSuccess = async (token: string, username: string) => {
    setAdminToken(token);
    setAdminUsername(username);
    await fetchAdminDashboard(token);
  };

  const handleAdminLogout = async () => {
    if (adminToken) {
      await fetch('/api/admin/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
      }).catch(() => undefined);
    }
    setAdminToken(null);
    setAdminUsername('');
    setViewMode('storefront');
    if (window.location.hash === '#admin') {
      window.history.replaceState(null, '', '/');
    }
  };

  const handleUpdateProduct = async (updated: Product, reason = 'Manual update') => {
    if (!adminToken) return;
    const res = await fetch(`/api/admin/products/${updated.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ ...updated, reason }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to update product.');
    }
    await Promise.all([fetchAdminDashboard(adminToken), fetchPublicStore()]);
  };

  const handleAddProduct = async (newProd: Omit<Product, 'id' | 'createdAt'>) => {
    if (!adminToken) return;
    const res = await fetch('/api/admin/products', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify(newProd),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to publish product.');
    }
    await Promise.all([fetchAdminDashboard(adminToken), fetchPublicStore()]);
  };

  const handleUpdateOrderStatus = async (
    orderId: string,
    orderStatus: OrderStatus,
    _paymentStatus: PaymentStatus
  ) => {
    if (!adminToken) return;
    const res = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ orderStatus }),
    });
    if (res.ok) {
      await fetchAdminDashboard(adminToken);
    }
  };

  const handleUpdateSettings = async (nextSettings: StoreSettings) => {
    if (!adminToken) return;
    const res = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify(nextSettings),
    });
    if (res.ok) {
      await Promise.all([fetchAdminDashboard(adminToken), fetchPublicStore()]);
    }
  };

  const handleMarkMessageReplied = async (id: number) => {
    if (!adminToken) return;
    const res = await fetch(`/api/admin/messages/${id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (res.ok) {
      await fetchAdminDashboard(adminToken);
    }
  };

  const handleDeleteProduct = async (productId: number) => {
    if (!adminToken) return;
    const res = await fetch(`/api/admin/products/${productId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (res.ok) {
      await Promise.all([fetchAdminDashboard(adminToken), fetchPublicStore()]);
    }
  };

  const handleUploadImage = async (dataUrl: string): Promise<string> => {
    if (!adminToken) throw new Error('অ্যাডমিন অনুমোদন প্রয়োজন।');
    const res = await fetch('/api/admin/upload-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ dataUrl }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'ছবি আপলোড করা যায়নি।');
    }
    return data.url as string;
  };

  const handleSaveCoupon = async (coupon: {
    code: string;
    discountPercent: number;
    minOrder: number;
    description: string;
  }) => {
    if (!adminToken) return;
    const res = await fetch('/api/admin/coupons', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify(coupon),
    });
    if (res.ok) {
      await Promise.all([fetchAdminDashboard(adminToken), fetchPublicStore()]);
    }
  };

  const handleToggleCoupon = async (code: string) => {
    if (!adminToken) return;
    const res = await fetch(`/api/admin/coupons/${encodeURIComponent(code)}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (res.ok) {
      await Promise.all([fetchAdminDashboard(adminToken), fetchPublicStore()]);
    }
  };

  if (viewMode === 'admin') {
    if (!adminToken) {
      return (
        <AdminLoginModal
          onSuccess={handleAdminAuthSuccess}
          onBackToStore={() => {
            setOpenAddProductOnAdmin(false);
            setViewMode('storefront');
            if (window.location.hash === '#admin' || window.location.pathname.startsWith('/admin')) {
              window.history.replaceState(null, '', '/');
            }
          }}
        />
      );
    }

    return (
      <AdminConsole
        adminUsername={adminUsername}
        products={adminProducts}
        categories={categories}
        coupons={adminCoupons}
        orders={adminOrders}
        messages={adminMessages}
        stockHistory={adminStockHistory}
        settings={settings}
        initialOpenAddProduct={openAddProductOnAdmin}
        onConsumeInitialAddProduct={() => setOpenAddProductOnAdmin(false)}
        onExitAdmin={() => {
          setViewMode('storefront');
          if (window.location.hash === '#admin' || window.location.pathname.startsWith('/admin')) {
            window.history.replaceState(null, '', '/');
          }
        }}
        onLogout={handleAdminLogout}
        onUpdateProduct={handleUpdateProduct}
        onAddProduct={handleAddProduct}
        onDeleteProduct={handleDeleteProduct}
        onUploadImage={handleUploadImage}
        onUpdateOrderStatus={handleUpdateOrderStatus}
        onUpdateSettings={handleUpdateSettings}
        onMarkMessageReplied={handleMarkMessageReplied}
        onSaveCoupon={handleSaveCoupon}
        onToggleCoupon={handleToggleCoupon}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F9F8F6] text-[#141413] dark:bg-[#080A0E] dark:text-[#FFFFFF]">
      {showPromoBanner && settings.promo_banner_text && (
        <div className="bg-[#0F6E56] text-white text-xs py-2 px-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <p className="truncate font-medium mx-auto">{settings.promo_banner_text}</p>
            <button
              type="button"
              onClick={() => setShowPromoBanner(false)}
              className="p-0.5 opacity-80 hover:opacity-100 shrink-0"
              aria-label="Dismiss announcement"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-40 border-b border-[#E5E2DC] dark:border-[#222630] bg-[#F9F8F6]/95 dark:bg-[#080A0E]/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setIsMenuOpen(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg border border-[#E5E2DC] dark:border-[#2E323B] bg-[#FFFFFF] dark:bg-[#16181D] text-xs font-semibold hover:border-[#0F6E56] shrink-0"
              aria-label={t.menuLabel}
            >
              <Menu className="w-4 h-4" />
              <span className="hidden sm:inline">{t.menuLabel}</span>
            </button>

            <a
              href="#top"
              className="text-base sm:text-lg font-bold tracking-tight font-display text-[#141413] dark:text-[#F3F2EF] whitespace-nowrap shrink-0"
            >
              {settings.site_name}
            </a>
          </div>

          <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-[#4A4945] dark:text-[#C8C6C0]">
            <a
              href="#shop"
              className="hover:text-[#141413] dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              {t.navShop}
            </a>
            <a
              href="#collections"
              className="hover:text-[#141413] dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              {t.navCollections}
            </a>
            <button
              type="button"
              onClick={() => setIsTrackerOpen(true)}
              className="hover:text-[#141413] dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              {t.navTrack}
            </button>
            <a
              href="#contact"
              className="hover:text-[#141413] dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              {t.navContact}
            </a>
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsWishlistOpen(true)}
              className="hidden sm:inline-flex items-center gap-1 px-2.5 py-2 rounded-lg border border-[#E5E2DC] dark:border-[#2E323B] bg-[#FFFFFF] dark:bg-[#16181D] text-xs font-medium hover:border-[#0F6E56]"
              aria-label={t.wishlistLink}
            >
              <Heart className="w-3.5 h-3.5" />
              <span className="font-mono tabular-nums">{wishlistIds.length}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#141413] dark:bg-[#F3F2EF] text-white dark:text-[#141413] text-xs font-semibold hover:opacity-90 transition-opacity whitespace-nowrap shrink-0"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>{t.bagLabel}</span>
              <span className="font-mono tabular-nums">({bagCount})</span>
            </button>
          </div>
        </div>
      </header>

      {/* Top-Left 3-Line Menu Slide-Over Drawer */}
      {isMenuOpen && (
        <div
          className="fixed inset-0 z-50 flex bg-black/55 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-label="Main Menu"
        >
          <div className="w-full max-w-xs sm:max-w-sm bg-[#FFFFFF] dark:bg-[#16181D] h-full shadow-2xl border-r border-[#E5E2DC] dark:border-[#262930] flex flex-col justify-between overflow-y-auto">
            <div className="p-5 space-y-6">
              <div className="flex items-center justify-between border-b border-[#E5E2DC] dark:border-[#262930] pb-4">
                <div>
                  <p className="text-base font-bold font-display">{settings.site_name}</p>
                  <p className="text-[11px] font-medium tracking-wider uppercase text-[#0F6E56] dark:text-[#34D399]">
                    {settings.site_tagline}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMenuOpen(false)}
                  className="p-2 rounded-lg text-[#6B6964] hover:text-[#141413] dark:text-[#9CA0A6] dark:hover:text-white"
                  aria-label="Close menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Admin Panel & Add Product Quick Controls */}
              <div className="p-3.5 rounded-xl bg-[#0F6E56]/8 dark:bg-[#0F6E56]/15 border border-[#0F6E56]/25 space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#0F6E56] dark:text-[#34D399]">
                  {lang === 'bn' ? 'অ্যাডমিন ও পণ্য নিয়ন্ত্রণ' : 'Admin & Product Control'}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    setOpenAddProductOnAdmin(false);
                    setViewMode('admin');
                  }}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg bg-[#0F6E56] hover:bg-[#0C5945] text-white text-xs font-semibold"
                >
                  <span className="inline-flex items-center gap-2">
                    <Lock className="w-3.5 h-3.5" />
                    {t.adminPanel}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    setOpenAddProductOnAdmin('standard');
                    setViewMode('admin');
                  }}
                  className="w-full flex items-center justify-between px-3.5 py-2 rounded-lg border border-[#0F6E56]/40 bg-[#FFFFFF] dark:bg-[#1D2026] text-xs font-semibold text-[#0F6E56] dark:text-[#34D399] hover:border-[#0F6E56]"
                >
                  <span className="inline-flex items-center gap-2">
                    <Plus className="w-3.5 h-3.5" />
                    {t.addProductShortcut}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    setOpenAddProductOnAdmin('affiliate');
                    setViewMode('admin');
                  }}
                  className="w-full flex items-center justify-between px-3.5 py-2 rounded-lg border border-[#D97706]/40 bg-[#FFFFFF] dark:bg-[#1D2026] text-xs font-semibold text-[#B45309] dark:text-[#FBBF24] hover:border-[#D97706]"
                >
                  <span className="inline-flex items-center gap-2">
                    <ExternalLink className="w-3.5 h-3.5" />
                    {t.addAffiliateProductShortcut}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Storefront Categories */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-[#6B6964] dark:text-[#9CA0A6]">
                  {t.categoriesLink}
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {['All', ...categories.map((c) => c.name)].map((catName) => (
                    <button
                      key={catName}
                      type="button"
                      onClick={() => {
                        setSelectedCategory(catName);
                        setIsMenuOpen(false);
                        document.getElementById('shop')?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className={`px-3 py-2 rounded-lg text-left text-xs font-medium border ${
                        selectedCategory === catName
                          ? 'border-[#0F6E56] bg-[#0F6E56]/10 text-[#0F6E56] dark:text-[#34D399]'
                          : 'border-[#E5E2DC] dark:border-[#2E323B] hover:border-[#0F6E56]'
                      }`}
                    >
                      {lang === 'bn'
                        ? CATEGORY_LABELS_BN[catName] || catName
                        : catName === 'All'
                        ? t.allCategories
                        : catName}
                    </button>
                  ))}
                </div>
              </div>

              {/* All Store Features */}
              <div className="space-y-1">
                <p className="text-xs font-semibold text-[#6B6964] dark:text-[#9CA0A6] mb-1.5">
                  {lang === 'bn' ? 'সকল ফিউচার ও সেবা' : 'All Store Features'}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    setIsCartOpen(true);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[#F9F8F6] dark:hover:bg-[#1D2026] text-xs font-medium"
                >
                  <span className="inline-flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-[#0F6E56]" />
                    {lang === 'bn' ? 'শপিং ব্যাগ ও গেস্ট চেকআউট' : 'Shopping Bag & Guest Checkout'}
                  </span>
                  <span className="font-mono text-[11px]">{bagCount}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    setIsWishlistOpen(true);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[#F9F8F6] dark:hover:bg-[#1D2026] text-xs font-medium"
                >
                  <span className="inline-flex items-center gap-2">
                    <Heart className="w-4 h-4 text-[#0F6E56]" />
                    {t.wishlistLink}
                  </span>
                  <span className="font-mono text-[11px]">{wishlistIds.length}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    setIsCompareOpen(true);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[#F9F8F6] dark:hover:bg-[#1D2026] text-xs font-medium"
                >
                  <span className="inline-flex items-center gap-2">
                    <GitCompareArrows className="w-4 h-4 text-[#0F6E56]" />
                    {t.compareProductsLink}
                  </span>
                  <span className="font-mono text-[11px]">{compareIds.length}/3</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    setIsTrackerOpen(true);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[#F9F8F6] dark:hover:bg-[#1D2026] text-xs font-medium"
                >
                  <span className="inline-flex items-center gap-2">
                    <Package className="w-4 h-4 text-[#0F6E56]" />
                    {t.navTrack}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    setActivePolicy('faq');
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[#F9F8F6] dark:hover:bg-[#1D2026] text-xs font-medium"
                >
                  <span className="inline-flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-[#0F6E56]" />
                    {t.faqLink}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[#F9F8F6] dark:hover:bg-[#1D2026] text-xs font-medium"
                >
                  <span className="inline-flex items-center gap-2">
                    <Phone className="w-4 h-4 text-[#0F6E56]" />
                    {t.customerSupportLink}
                  </span>
                </button>
              </div>
            </div>

            <div className="p-5 border-t border-[#E5E2DC] dark:border-[#262930] space-y-3 bg-[#F9F8F6] dark:bg-[#111318]">
              <div className="flex items-center justify-between gap-2">
                <div className="inline-flex rounded-lg border border-[#E5E2DC] dark:border-[#2E323B] bg-[#FFFFFF] dark:bg-[#16181D] p-0.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => handleSelectLanguageMode('bn')}
                    className={`px-2.5 py-1 rounded-md font-medium ${
                      langMode === 'bn' ? 'bg-[#0F6E56] text-white' : ''
                    }`}
                  >
                    বাংলা
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectLanguageMode('en')}
                    className={`px-2.5 py-1 rounded-md font-medium ${
                      langMode === 'en' ? 'bg-[#0F6E56] text-white' : ''
                    }`}
                  >
                    EN
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setDarkMode((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E5E2DC] dark:border-[#2E323B] bg-[#FFFFFF] dark:bg-[#16181D] text-xs font-medium"
                >
                  {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                  {darkMode ? (lang === 'bn' ? 'লাইট' : 'Light') : (lang === 'bn' ? 'ডার্ক' : 'Dark')}
                </button>
              </div>
            </div>
          </div>
          <div className="flex-1" onClick={() => setIsMenuOpen(false)} />
        </div>
      )}

      <main id="top" className="flex-1">
        {/* Section 1: Flagship Hero Split */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-12 lg:py-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
            <div className="lg:col-span-5 flex flex-col justify-between py-2 lg:py-4 space-y-6">
              <div className="space-y-4">
                <p className="text-xs font-medium tracking-wider uppercase text-[#0F6E56] dark:text-[#34D399]">
                  {settings.site_tagline}
                </p>
                <h1 className="text-[clamp(2.25rem,4vw,3.4rem)] font-bold leading-[1.08] tracking-tight text-[#141413] dark:text-[#F3F2EF] text-balance">
                  {settings.hero_title}
                </h1>
                <p className="text-base leading-relaxed text-[#4A4945] dark:text-[#C8C6C0] max-w-md">
                  {settings.hero_subtitle}
                </p>
              </div>

              <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-3">
                  <a
                    href="#shop"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#0F6E56] hover:bg-[#0C5945] text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0"
                  >
                    {lang === 'bn' ? t.shopCollection : settings.hero_cta_text}
                    <ArrowRight className="w-4 h-4" />
                  </a>
                  <button
                    type="button"
                    onClick={() => setIsTrackerOpen(true)}
                    className="px-5 py-3 rounded-lg border border-[#E5E2DC] dark:border-[#2E323B] text-sm font-medium hover:border-[#0F6E56] transition-colors whitespace-nowrap shrink-0"
                  >
                    {t.navTrack}
                  </button>
                </div>

                <div className="pt-4 border-t border-[#E5E2DC] dark:border-[#262930] flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#6B6964] dark:text-[#9CA0A6]">
                  <span>{t.bKashBadge}</span>
                  <span aria-hidden="true">·</span>
                  <span>{t.codBadge}</span>
                  <span aria-hidden="true">·</span>
                  <span>{t.guestCheckoutBadge}</span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7">
              <div className="aspect-[16/10] lg:aspect-auto lg:h-full min-h-[300px] rounded-xl overflow-hidden border border-[#E5E2DC] dark:border-[#262930] bg-[#EFECE6] dark:bg-[#1A1D23]">
                <ProductImage
                  src={settings.hero_banner}
                  alt="SHOPNEXA flagship collection showcase"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Curated Collection & Category Filter Grid */}
        <section
          id="shop"
          className="max-w-7xl mx-auto px-4 sm:px-6 py-10 lg:py-14 border-t border-[#E5E2DC] dark:border-[#262930]"
        >
          <div id="collections" className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#141413] dark:text-[#F3F2EF]">
                {t.featuredHeading}
              </h2>
              <p className="mt-1.5 text-sm text-[#6B6964] dark:text-[#9CA0A6] max-w-xl">
                {t.featuredSub}
              </p>
            </div>

              <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 sm:flex-initial min-w-[200px]">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#6B6964]" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t.searchPlaceholder}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-[#E5E2DC] dark:border-[#2E323B] bg-[#FFFFFF] dark:bg-[#16181D] focus:outline-none focus:border-[#0F6E56]"
                />
              </div>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="px-2.5 py-2 rounded-lg border border-[#E5E2DC] dark:border-[#2E323B] bg-[#FFFFFF] dark:bg-[#16181D] text-xs font-medium focus:outline-none focus:border-[#0F6E56]"
              >
                <option value="default">{t.sortDefault}</option>
                <option value="price-asc">{t.sortPriceAsc}</option>
                <option value="price-desc">{t.sortPriceDesc}</option>
                <option value="discount">{t.sortDiscount}</option>
              </select>

              <button
                type="button"
                onClick={() => setOffersOnly((prev) => !prev)}
                className={`px-3 py-2 rounded-lg border text-xs font-medium whitespace-nowrap shrink-0 ${
                  offersOnly
                    ? 'border-[#0F6E56] bg-[#0F6E56]/10 text-[#0F6E56] dark:text-[#34D399]'
                    : 'border-[#E5E2DC] dark:border-[#2E323B] bg-[#FFFFFF] dark:bg-[#16181D]'
                }`}
              >
                {t.discountOnly}
              </button>

              {compareIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsCompareOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#0F6E56] bg-[#0F6E56]/10 text-[#0F6E56] dark:text-[#34D399] text-xs font-semibold whitespace-nowrap shrink-0"
                >
                  <GitCompareArrows className="w-3.5 h-3.5" />
                  {t.compareBtn} ({compareIds.length})
                </button>
              )}

              <button
                type="button"
                onClick={() => setDarkMode((prev) => !prev)}
                className="p-2 rounded-lg border border-[#E5E2DC] dark:border-[#2E323B] bg-[#FFFFFF] dark:bg-[#16181D] hover:border-[#0F6E56]"
                aria-label="Toggle color theme"
              >
                {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>

              <button
                type="button"
                onClick={() => setViewMode('admin')}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#E5E2DC] dark:border-[#2E323B] bg-[#FFFFFF] dark:bg-[#16181D] text-xs font-medium hover:border-[#0F6E56] whitespace-nowrap shrink-0"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                {t.adminPanel}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 p-1 mb-8 rounded-lg bg-[#EFECE6] dark:bg-[#16181D] border border-[#E5E2DC] dark:border-[#262930] w-fit max-w-full overflow-x-auto">
            {['All', ...categories.map((c) => c.name)].map((catName) => {
              const active = selectedCategory === catName;
              const displayLabel =
                lang === 'bn' ? CATEGORY_LABELS_BN[catName] || catName : catName === 'All' ? t.allCategories : catName;
              return (
                <button
                  key={catName}
                  type="button"
                  onClick={() => setSelectedCategory(catName)}
                  className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-[#FFFFFF] dark:bg-[#242830] text-[#141413] dark:text-[#F3F2EF] shadow-xs'
                      : 'text-[#6B6964] dark:text-[#9CA0A6] hover:text-[#141413] dark:hover:text-white'
                  }`}
                >
                  {displayLabel}
                </button>
              );
            })}
          </div>

          {filteredProducts.length === 0 ? (
            <div className="py-16 text-center rounded-xl border border-dashed border-[#E5E2DC] dark:border-[#2E323B]">
              <p className="text-sm font-medium">{t.noMatch}</p>
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('All');
                  setSearchQuery('');
                  setOffersOnly(false);
                }}
                className="mt-3 px-4 py-2 rounded-lg bg-[#0F6E56] text-white text-xs font-semibold"
              >
                {t.resetFilters}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
              {filteredProducts.map((product) => {
                const effective = getEffectivePrice(product);
                const discountPct = getDiscountPercent(product);
                const isJustAdded = justAddedId === product.id;
                const isSaved = wishlistIds.includes(product.id);
                const isCompared = compareIds.includes(product.id);
                const safeAffiliateUrl =
                  product.productType === 'affiliate'
                    ? isSafeExternalUrl(product.affiliateUrl)
                    : null;

                return (
                  <article
                    key={product.id}
                    className="group flex flex-col rounded-xl bg-[#FFFFFF] dark:bg-[#16181D] border border-[#E5E2DC] dark:border-[#262930] overflow-hidden transition-transform duration-200 hover:-translate-y-0.5"
                  >
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setActiveProduct(product)}
                        className="block w-full aspect-[4/3] overflow-hidden bg-[#F2F0EC] dark:bg-[#1D2026] text-left"
                      >
                        <ProductImage
                          src={product.image}
                          alt={product.name}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                        />
                      </button>

                      <div className="absolute top-3 right-3 flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleToggleWishlist(product.id)}
                          className={`p-2 rounded-lg border backdrop-blur-sm transition-colors ${
                            isSaved
                              ? 'bg-[#0F6E56] border-[#0F6E56] text-white'
                              : 'bg-[#FFFFFF]/90 dark:bg-[#16181D]/90 border-[#E5E2DC] dark:border-[#2E323B] text-[#4A4945] dark:text-[#C8C6C0]'
                          }`}
                          aria-label={t.wishlistLink}
                        >
                          <Heart className="w-3.5 h-3.5" fill={isSaved ? 'currentColor' : 'none'} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleCompare(product.id)}
                          className={`px-2 py-1.5 rounded-lg border text-[11px] font-medium backdrop-blur-sm transition-colors inline-flex items-center gap-1 ${
                            isCompared
                              ? 'bg-[#0F6E56] border-[#0F6E56] text-white'
                              : 'bg-[#FFFFFF]/90 dark:bg-[#16181D]/90 border-[#E5E2DC] dark:border-[#2E323B] text-[#4A4945] dark:text-[#C8C6C0]'
                          }`}
                        >
                          <GitCompareArrows className="w-3 h-3" />
                          {isCompared ? t.comparingBtn : t.compareBtn}
                        </button>
                      </div>
                    </div>

                    <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                      <div>
                        <div className="flex items-center justify-between gap-2 text-xs text-[#6B6964] dark:text-[#9CA0A6]">
                          <span className="truncate">
                            {product.brand} · {product.subcategory}
                          </span>
                          <span className="font-mono tabular-nums shrink-0">
                            {safeAffiliateUrl
                              ? t.partnerStoreLabel
                              : product.stock > 0
                              ? `${product.stock} ${t.inStock}`
                              : t.outOfStock}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => setActiveProduct(product)}
                          className="mt-1.5 text-left block w-full"
                        >
                          <h3 className="text-base font-semibold text-[#141413] dark:text-[#F3F2EF] group-hover:text-[#0F6E56] dark:group-hover:text-[#34D399] transition-colors">
                            {product.name}
                          </h3>
                        </button>
                      </div>

                      <div className="flex items-center justify-between gap-3 pt-2 border-t border-[#E5E2DC] dark:border-[#262930]">
                        <div className="flex items-baseline gap-2">
                          <span className="text-base font-semibold font-mono tabular-nums text-[#141413] dark:text-[#F3F2EF]">
                            {formatBDT(effective)}
                          </span>
                          {discountPct !== null && (
                            <span className="text-xs font-mono tabular-nums line-through text-[#6B6964] dark:text-[#9CA0A6]">
                              {formatBDT(product.regularPrice)}
                            </span>
                          )}
                        </div>

                        {safeAffiliateUrl ? (
                          <a
                            href={safeAffiliateUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-2 rounded-lg bg-[#0F6E56] hover:bg-[#0C5945] text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1.5"
                          >
                            <span>{t.affiliateBuyNow}</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        ) : (
                          <button
                            type="button"
                            disabled={product.stock <= 0}
                            onClick={() =>
                              handleAddToCart(product, product.variants[0] || 'Standard', 1, false)
                            }
                            className="px-3.5 py-2 rounded-lg bg-[#0F6E56] hover:bg-[#0C5945] text-white text-xs font-semibold transition-colors disabled:opacity-40 whitespace-nowrap shrink-0 inline-flex items-center gap-1.5"
                          >
                            {isJustAdded ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                {t.addedLabel}
                              </>
                            ) : (
                              t.addToBag
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* Section 4: Footer (High-Contrast Black in Dark Mode + White Support in Light Mode) */}
      <footer className="border-t border-[#E5E2DC] dark:border-[#222630] bg-[#FFFFFF] text-[#141413] dark:bg-[#07090D] dark:text-[#FFFFFF]">
        {/* Top Newsletter Bar */}
        <div className="border-b border-[#E5E2DC] dark:border-[#1E222B]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-0.5">
              <p className="text-base font-bold font-display tracking-tight text-[#141413] dark:text-[#FFFFFF]">
                {settings.site_name}
              </p>
              <p className="text-[11px] font-medium tracking-wider uppercase text-[#0F6E56] dark:text-[#34D399]">
                {settings.site_tagline} · {settings.footer_text}
              </p>
            </div>
            <form onSubmit={handleNewsletterSubmit} className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full md:w-auto">
              <input
                type="email"
                required
                value={newsletterInput}
                onChange={(e) => setNewsletterInput(e.target.value)}
                placeholder={t.newsletterPlaceholder}
                className="flex-1 sm:w-72 px-3.5 py-2.5 text-xs rounded-lg border border-[#E5E2DC] dark:border-[#2E3440] bg-[#F9F8F6] dark:bg-[#12161F] text-[#141413] dark:text-[#FFFFFF] placeholder-[#6B6964] dark:placeholder-[#9CA3AF] focus:outline-none focus:border-[#0F6E56] dark:focus:border-[#34D399]"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#0F6E56] hover:bg-[#0C5945] text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
              >
                {newsletterSaved ? t.subscribedBtn : t.joinBtn}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>

        {/* 4-Column Footer Grid */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 grid grid-cols-2 lg:grid-cols-4 gap-8 text-xs">
          {/* Column 1: Storefront */}
          <div className="space-y-3">
            <p className="font-semibold text-sm text-[#141413] dark:text-[#FFFFFF]">{t.storefrontHeading}</p>
            <div className="flex flex-col items-start gap-2.5 text-[#4A4945] dark:text-[#D1D5DB]">
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('All');
                  document.getElementById('shop')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="hover:text-[#0F6E56] dark:hover:text-white transition-colors text-left"
              >
                {t.allProductsLink}
              </button>
              <a href="#collections" className="hover:text-[#0F6E56] dark:hover:text-white transition-colors">
                {t.categoriesLink}
              </a>
              <button
                type="button"
                onClick={() => setIsCompareOpen(true)}
                className="hover:text-[#0F6E56] dark:hover:text-white transition-colors text-left"
              >
                {t.compareProductsLink} {compareIds.length > 0 ? `(${compareIds.length})` : ''}
              </button>
              <button
                type="button"
                onClick={() => setIsTrackerOpen(true)}
                className="hover:text-[#0F6E56] dark:hover:text-white transition-colors text-left"
              >
                {t.navTrack}
              </button>
            </div>
          </div>

          {/* Column 2: Customer Care */}
          <div className="space-y-3">
            <p className="font-semibold text-sm text-[#141413] dark:text-[#FFFFFF]">{t.customerCareHeading}</p>
            <div className="flex flex-col items-start gap-2.5 text-[#4A4945] dark:text-[#D1D5DB]">
              <button
                type="button"
                onClick={() => setIsTrackerOpen(true)}
                className="hover:text-[#0F6E56] dark:hover:text-white transition-colors text-left"
              >
                {t.orderStatusLink}
              </button>
              <button
                type="button"
                onClick={() => setIsWishlistOpen(true)}
                className="hover:text-[#0F6E56] dark:hover:text-white transition-colors text-left"
              >
                {t.wishlistLink} {wishlistIds.length > 0 ? `(${wishlistIds.length})` : ''}
              </button>
              <a href="#contact" className="hover:text-[#0F6E56] dark:hover:text-white transition-colors">
                {t.customerSupportLink}
              </a>
              <button
                type="button"
                onClick={() => setActivePolicy('faq')}
                className="hover:text-[#0F6E56] dark:hover:text-white transition-colors text-left"
              >
                {t.faqLink}
              </button>
            </div>
          </div>

          {/* Column 3: Policies */}
          <div className="space-y-3">
            <p className="font-semibold text-sm text-[#141413] dark:text-[#FFFFFF]">{t.policiesHeading}</p>
            <div className="flex flex-col items-start gap-2.5 text-[#4A4945] dark:text-[#D1D5DB]">
              <button
                type="button"
                onClick={() => setActivePolicy('about')}
                className="hover:text-[#0F6E56] dark:hover:text-white transition-colors text-left"
              >
                {t.aboutUs}
              </button>
              <button
                type="button"
                onClick={() => setActivePolicy('shipping')}
                className="hover:text-[#0F6E56] dark:hover:text-white transition-colors text-left"
              >
                {t.shippingDelivery}
              </button>
              <button
                type="button"
                onClick={() => setActivePolicy('return')}
                className="hover:text-[#0F6E56] dark:hover:text-white transition-colors text-left"
              >
                {t.returnPolicy}
              </button>
              <button
                type="button"
                onClick={() => setActivePolicy('privacy')}
                className="hover:text-[#0F6E56] dark:hover:text-white transition-colors text-left"
              >
                {t.privacyPolicy}
              </button>
              <button
                type="button"
                onClick={() => setActivePolicy('terms')}
                className="hover:text-[#0F6E56] dark:hover:text-white transition-colors text-left"
              >
                {t.termsConditions}
              </button>
            </div>
          </div>

          {/* Column 4: Contact & Crisp Admin Portal Button */}
          <div id="contact" className="space-y-3 col-span-2 sm:col-span-1">
            <p className="font-semibold text-sm text-[#141413] dark:text-[#FFFFFF]">{t.contactHeading}</p>
            <div className="space-y-2 text-[#4A4945] dark:text-[#E5E7EB]">
              <p className="flex items-start gap-2 leading-relaxed">
                <MapPin className="w-3.5 h-3.5 text-[#0F6E56] dark:text-[#34D399] shrink-0 mt-0.5" />
                <span>Bangladesh Rangpur</span>
              </p>
              <a
                href="tel:01759926460"
                className="flex items-center gap-2 font-mono hover:text-[#141413] dark:hover:text-white transition-colors"
              >
                <Phone className="w-3.5 h-3.5 text-[#0F6E56] dark:text-[#34D399] shrink-0" />
                <span>01759926460</span>
              </a>
              <a
                href="https://t.me/ShoponexaMarketplaseSuport"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 text-[#0284C7] hover:text-[#0369A1] dark:text-[#38BDF8] dark:hover:text-[#7DD3FC] transition-colors break-all font-medium"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="w-3.5 h-3.5 shrink-0"
                  aria-hidden="true"
                >
                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161-1.97 9.281c-.146.658-.537.818-1.084.508l-3-2.211-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.121l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.833.942z" />
                </svg>
                <span>@ShoponexaMarketplaseSuport</span>
              </a>
              <a
                href="mailto:robiulvv290@gmail.com"
                className="flex items-center gap-2 hover:text-[#141413] dark:hover:text-white transition-colors break-all"
              >
                <Mail className="w-3.5 h-3.5 text-[#0F6E56] dark:text-[#34D399] shrink-0" />
                <span>robiulvv290@gmail.com</span>
              </a>

              <div className="flex flex-wrap items-center gap-2.5 pt-1.5 text-[#141413] dark:text-[#F3F4F6]">
                <a
                  href="https://t.me/shopnexamarketplase"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Telegram"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[#F9F8F6] dark:bg-[#141821] border border-[#E5E2DC] dark:border-[#2E3440] hover:border-[#0284C7] hover:text-[#0284C7] dark:hover:border-[#38BDF8] dark:hover:text-[#38BDF8] transition-colors"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 shrink-0" aria-hidden="true">
                    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161-1.97 9.281c-.146.658-.537.818-1.084.508l-3-2.211-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.121l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.833.942z" />
                  </svg>
                  <span>Telegram</span>
                </a>
                <a
                  href="https://www.facebook.com/share/1WFDAntMgp/"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Facebook"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[#F9F8F6] dark:bg-[#141821] border border-[#E5E2DC] dark:border-[#2E3440] hover:border-[#2563EB] hover:text-[#2563EB] dark:hover:border-[#60A5FA] dark:hover:text-[#60A5FA] transition-colors"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 shrink-0" aria-hidden="true">
                    <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.791-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.971H15.83c-1.491 0-1.956.93-1.956 1.886v2.267h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
                  </svg>
                  <span>Facebook</span>
                </a>
                <a
                  href="https://www.youtube.com/@shopnexamarketplase"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="YouTube"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[#F9F8F6] dark:bg-[#141821] border border-[#E5E2DC] dark:border-[#2E3440] hover:border-[#DC2626] hover:text-[#DC2626] dark:hover:border-[#F87171] dark:hover:text-[#F87171] transition-colors"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 shrink-0" aria-hidden="true">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                  </svg>
                  <span>YouTube</span>
                </a>
                <a
                  href="https://www.instagram.com/shopnexa978?knvt=NTd5OHhtMDN6bGc3"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Instagram"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[#F9F8F6] dark:bg-[#141821] border border-[#E5E2DC] dark:border-[#2E3440] hover:border-[#DB2777] hover:text-[#DB2777] dark:hover:border-[#F472B6] dark:hover:text-[#F472B6] transition-colors"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 shrink-0" aria-hidden="true">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
                  </svg>
                  <span>Instagram</span>
                </a>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setOpenAddProductOnAdmin(false);
                    setViewMode('admin');
                  }}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-[#E5E2DC] dark:border-[#2E3440] bg-[#F9F8F6] dark:bg-[#141821] hover:border-[#0F6E56] dark:hover:border-[#34D399] text-[#141413] dark:text-[#FFFFFF] font-semibold transition-colors"
                >
                  <Lock className="w-3.5 h-3.5 text-[#0F6E56] dark:text-[#34D399]" />
                  <span>{t.manageStore}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Two-line English Shayari */}
        <div className="border-t border-[#E5E2DC] dark:border-[#1E222B]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 text-center">
            <p className="font-serif font-semibold text-lg sm:text-xl md:text-2xl leading-relaxed tracking-wide text-[#141413] dark:text-[#FFFFFF]">
              Beyond the stars, beyond the seas,
              <br />
              Love travels far on every breeze.
            </p>
          </div>
        </div>

        {/* Bottom Copyright, Language Selector & Payment Badges */}
        <div className="border-t border-[#E5E2DC] dark:border-[#1E222B]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 flex flex-wrap items-center justify-between gap-4 text-xs text-[#6B6964] dark:text-[#D1D5DB]">
            <span className="leading-relaxed font-medium text-[#141413] dark:text-[#E5E7EB]">
              2026 SHOPNEXA. All rights reserved.
            </span>

            <div className="flex flex-wrap items-center gap-4">
              <div className="inline-flex items-center rounded-lg border border-[#E5E2DC] dark:border-[#2E3440] bg-[#F9F8F6] dark:bg-[#141821] p-0.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => handleSelectLanguageMode('auto')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                    langMode === 'auto' ? 'bg-[#0F6E56] text-white' : 'text-[#6B6964] dark:text-[#D1D5DB] hover:text-[#141413] dark:hover:text-white'
                  }`}
                >
                  Auto
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectLanguageMode('bn')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                    langMode === 'bn' ? 'bg-[#0F6E56] text-white' : 'text-[#6B6964] dark:text-[#D1D5DB] hover:text-[#141413] dark:hover:text-white'
                  }`}
                >
                  বাংলা
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectLanguageMode('en')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                    langMode === 'en' ? 'bg-[#0F6E56] text-white' : 'text-[#6B6964] dark:text-[#D1D5DB] hover:text-[#141413] dark:hover:text-white'
                  }`}
                >
                  English
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-[#4A4945] dark:text-[#E5E7EB]">
                <span>bKash</span>
                <span aria-hidden="true">·</span>
                <span>Nagad</span>
                <span aria-hidden="true">·</span>
                <span>Cash on Delivery</span>
              </div>
            </div>
          </div>
        </div>
      </footer>

      <ProductDetailModal
        product={activeProduct}
        reviews={reviews}
        settings={settings}
        lang={lang}
        onClose={() => setActiveProduct(null)}
        onAddToCart={handleAddToCart}
        onAddReview={handleAddReview}
      />

      <CartDrawer
        isOpen={isCartOpen}
        cart={cart}
        products={products}
        coupons={coupons}
        settings={settings}
        lang={lang}
        onClose={() => setIsCartOpen(false)}
        onUpdateQty={handleUpdateCartQty}
        onRemoveItem={handleRemoveCartItem}
        onPlaceOrder={handlePlaceOrder}
      />

      <OrderTrackerModal
        isOpen={isTrackerOpen}
        recentOrders={recentGuestOrders}
        lang={lang}
        onClose={() => setIsTrackerOpen(false)}
      />

      <WishlistModal
        isOpen={isWishlistOpen}
        products={activeProducts}
        wishlistIds={wishlistIds}
        lang={lang}
        onClose={() => setIsWishlistOpen(false)}
        onToggleWishlist={handleToggleWishlist}
        onAddToCart={handleAddToCart}
        onSelectProduct={(prod) => setActiveProduct(prod)}
      />

      <CompareModal
        isOpen={isCompareOpen}
        products={activeProducts}
        compareIds={compareIds}
        lang={lang}
        onClose={() => setIsCompareOpen(false)}
        onRemoveCompare={handleToggleCompare}
        onAddToCart={handleAddToCart}
      />

      <ContactPolicyModal
        policy={activePolicy}
        settings={settings}
        lang={lang}
        onClose={() => setActivePolicy(null)}
      />
    </div>
  );
}
