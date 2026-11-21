import { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import {
  ArrowLeft,
  Plus,
  Check,
  LogOut,
  Package,
  ShoppingBag,
  MessageSquare,
  Sliders,
  History,
  X,
  Upload,
  Tag,
  Users,
  Trash2,
  Download,
  Search,
  ExternalLink,
} from 'lucide-react';
import {
  Category,
  ContactMessage,
  Coupon,
  Order,
  OrderStatus,
  PaymentStatus,
  Product,
  StockHistoryEntry,
  StoreSettings,
} from '../types';
import {
  ASSET_IMAGES,
  CATEGORY_LABELS_BN,
  formatBDT,
  getEffectivePrice,
  isSafeExternalUrl,
} from '../data/storeData';
import { ProductImage } from './ProductImage';

interface AdminConsoleProps {
  adminUsername: string;
  products: Product[];
  categories: Category[];
  coupons: Coupon[];
  orders: Order[];
  messages: ContactMessage[];
  stockHistory: StockHistoryEntry[];
  settings: StoreSettings;
  initialOpenAddProduct?: boolean | 'standard' | 'affiliate';
  onConsumeInitialAddProduct?: () => void;
  onExitAdmin: () => void;
  onLogout: () => void;
  onUpdateProduct: (updated: Product, reason?: string) => Promise<void>;
  onAddProduct: (newProduct: Omit<Product, 'id' | 'createdAt'>) => Promise<void>;
  onDeleteProduct: (productId: number) => Promise<void>;
  onUploadImage: (dataUrl: string) => Promise<string>;
  onUpdateOrderStatus: (orderId: string, orderStatus: OrderStatus, paymentStatus: PaymentStatus) => Promise<void>;
  onUpdateSettings: (nextSettings: StoreSettings) => Promise<void>;
  onMarkMessageReplied: (id: number) => Promise<void>;
  onSaveCoupon: (coupon: { code: string; discountPercent: number; minOrder: number; description: string }) => Promise<void>;
  onToggleCoupon: (code: string) => Promise<void>;
}

type AdminTab = 'products' | 'orders' | 'coupons' | 'customers' | 'settings' | 'messages' | 'stock';

interface ProductFormState {
  productType: 'standard' | 'affiliate';
  affiliateUrl: string;
  code: string;
  sku: string;
  name: string;
  category: string;
  subcategory: string;
  brand: string;
  regularPrice: string;
  discountPrice: string;
  purchasePrice: string;
  stock: string;
  piecesInfo: string;
  weight: string;
  warranty: string;
  status: 'Active' | 'Draft';
  image: string;
  variants: string;
  description: string;
  reason: string;
}

const IMAGE_PRESETS = [
  { label: 'ওভারশার্ট', url: ASSET_IMAGES.oxfordShirt },
  { label: 'মিনিমালিস্ট ঘড়ি', url: ASSET_IMAGES.minimalWatch },
  { label: 'লেদার ব্যাগ', url: ASSET_IMAGES.leatherTote },
  { label: 'স্নিকার্স জুতা', url: ASSET_IMAGES.runnerSneakers },
  { label: 'স্টুডিও হেডফোন', url: ASSET_IMAGES.wirelessAudio },
  { label: 'হুডি', url: ASSET_IMAGES.merinoHoodie },
  { label: 'ডেনিম জ্যাকেট', url: ASSET_IMAGES.denimJacket },
];

const ORDER_STATUS_BN: Record<OrderStatus, string> = {
  Pending: 'অপেক্ষমাণ (Pending)',
  Confirmed: 'নিশ্চিত (Confirmed)',
  Shipped: 'পাঠানো হয়েছে (Shipped)',
  Delivered: 'ডেলিভারড (Delivered)',
  Cancelled: 'বাতিল (Cancelled)',
};

export function AdminConsole({
  adminUsername,
  products,
  categories,
  coupons,
  orders,
  messages,
  stockHistory,
  settings,
  initialOpenAddProduct = false,
  onConsumeInitialAddProduct,
  onExitAdmin,
  onLogout,
  onUpdateProduct,
  onAddProduct,
  onDeleteProduct,
  onUploadImage,
  onUpdateOrderStatus,
  onUpdateSettings,
  onMarkMessageReplied,
  onSaveCoupon,
  onToggleCoupon,
}: AdminConsoleProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('products');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showProductForm, setShowProductForm] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [productError, setProductError] = useState('');
  const [adminSearch, setAdminSearch] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const [couponCode, setCouponCode] = useState('');
  const [couponDiscount, setCouponDiscount] = useState('10');
  const [couponMinOrder, setCouponMinOrder] = useState('1000');
  const [couponDesc, setCouponDesc] = useState('');
  const [couponSaving, setCouponSaving] = useState(false);

  const createEmptyForm = (productType: 'standard' | 'affiliate' = 'standard'): ProductFormState => {
    const defaultCategory = categories[0]?.name || 'Apparel';
    const defaultSubcategory = categories[0]?.subcategories[0] || 'Overshirts';
    const nextCode = `SNX-${products.length + 1001}`;
    return {
      productType,
      affiliateUrl: '',
      code: nextCode,
      sku: `SNX-SKU-${products.length + 1001}`,
      name: '',
      category: defaultCategory,
      subcategory: defaultSubcategory,
      brand: 'SHOPNEXA',
      regularPrice: '',
      discountPrice: '',
      purchasePrice: '',
      stock: productType === 'affiliate' ? '99' : '10',
      piecesInfo: '1 pc',
      weight: '',
      warranty: productType === 'affiliate' ? 'Partner Store Policy' : '7-Day Exchange',
      status: 'Active',
      image: categories[0]?.image || ASSET_IMAGES.oxfordShirt,
      variants: 'Standard',
      description: '',
      reason: productType === 'affiliate' ? 'অ্যাডমিন নতুন এফিলিয়েট পণ্য আপলোড' : 'অ্যাডমিন নতুন পণ্য আপলোড',
    };
  };

  const [productForm, setProductForm] = useState<ProductFormState>(() => createEmptyForm('standard'));
  const [settingsDraft, setSettingsDraft] = useState<StoreSettings>(settings);
  const [settingsSaved, setSettingsSaved] = useState(false);

  useEffect(() => {
    if (initialOpenAddProduct) {
      const targetType = initialOpenAddProduct === 'affiliate' ? 'affiliate' : 'standard';
      setActiveTab('products');
      setEditingProduct(null);
      setProductForm(createEmptyForm(targetType));
      setProductError('');
      setShowProductForm(true);
      onConsumeInitialAddProduct?.();
    }
  }, [initialOpenAddProduct]);

  const totalRevenue = orders
    .filter((o) => o.orderStatus !== 'Cancelled')
    .reduce((sum, o) => sum + o.total, 0);
  const totalInventoryUnits = products.reduce((sum, p) => sum + p.stock, 0);
  const lowStockCount = products.filter((p) => p.productType !== 'affiliate' && p.stock <= 20).length;

  const openNewProductForm = (productType: 'standard' | 'affiliate' = 'standard') => {
    setEditingProduct(null);
    setProductForm(createEmptyForm(productType));
    setProductError('');
    setShowProductForm(true);
  };

  const openEditProductForm = (product: Product) => {
    const productType = product.productType === 'affiliate' ? 'affiliate' : 'standard';
    setEditingProduct(product);
    setProductForm({
      productType,
      affiliateUrl: product.affiliateUrl || '',
      code: product.code,
      sku: product.sku,
      name: product.name,
      category: product.category,
      subcategory: product.subcategory,
      brand: product.brand,
      regularPrice: String(product.regularPrice),
      discountPrice: product.discountPrice !== null ? String(product.discountPrice) : '',
      purchasePrice: String(product.purchasePrice),
      stock: String(product.stock),
      piecesInfo: product.piecesInfo || '',
      weight: product.weight || '',
      warranty: product.warranty || '',
      status: product.status,
      image: product.image || '',
      variants: product.variants.join(', '),
      description: product.description || '',
      reason: 'অ্যাডমিন পণ্য আপডেট',
    });
    setProductError('');
    setShowProductForm(true);
  };

  const handleProductFormSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setProductError('');
    if (!productForm.name.trim()) {
      setProductError('পণ্যের নাম অবশ্যই লিখতে হবে।');
      return;
    }

    let normalizedAffiliateUrl = '';
    if (productForm.productType === 'affiliate') {
      const validUrl = isSafeExternalUrl(productForm.affiliateUrl);
      if (!validUrl) {
        setProductError('এফিলিয়েট প্রোডাক্টের জন্য সঠিক Affiliate URL / External Link (https://...) দিন।');
        return;
      }
      normalizedAffiliateUrl = validUrl;
    }

    const parsedVariants = productForm.variants
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);

    const payload: Omit<Product, 'id' | 'createdAt'> = {
      code: productForm.code.trim(),
      sku: productForm.sku.trim(),
      name: productForm.name.trim(),
      category: productForm.category.trim(),
      subcategory: productForm.subcategory.trim(),
      brand: productForm.brand.trim(),
      regularPrice: Math.max(0, Number(productForm.regularPrice) || 0),
      discountPrice: productForm.discountPrice.trim()
        ? Math.max(0, Number(productForm.discountPrice) || 0)
        : null,
      purchasePrice:
        productForm.productType === 'affiliate'
          ? 0
          : Math.max(0, Number(productForm.purchasePrice) || 0),
      stock:
        productForm.productType === 'affiliate'
          ? 99
          : Math.max(0, Math.floor(Number(productForm.stock) || 0)),
      piecesInfo: productForm.piecesInfo.trim(),
      weight: productForm.weight.trim(),
      warranty: productForm.warranty.trim(),
      status: productForm.status,
      productType: productForm.productType,
      affiliateUrl: normalizedAffiliateUrl,
      image: productForm.image.trim(),
      variants: parsedVariants.length > 0 ? parsedVariants : ['Standard'],
      description: productForm.description.trim(),
    };

    setSavingProduct(true);
    try {
      if (editingProduct) {
        await onUpdateProduct(
          {
            ...editingProduct,
            ...payload,
          },
          productForm.reason.trim() || 'অ্যাডমিন পণ্য আপডেট'
        );
      } else {
        await onAddProduct(payload);
      }
      setShowProductForm(false);
      setEditingProduct(null);
    } catch (err) {
      setProductError(err instanceof Error ? err.message : 'পণ্য সংরক্ষণ করা যায়নি।');
    } finally {
      setSavingProduct(false);
    }
  };

  const handleSaveSettings = async (e: FormEvent) => {
    e.preventDefault();
    await onUpdateSettings(settingsDraft);
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2000);
  };

  const handleImageFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProductError('');
    if (file.size > 2 * 1024 * 1024) {
      setProductError('ছবির সাইজ সর্বোচ্চ ২ মেগাবাইটের মধ্যে হতে হবে।');
      return;
    }
    setUploadingImage(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('ছবি পড়া যায়নি।'));
        reader.readAsDataURL(file);
      });
      const uploadedUrl = await onUploadImage(dataUrl);
      setProductForm((prev) => ({ ...prev, image: uploadedUrl }));
    } catch (err) {
      setProductError(err instanceof Error ? err.message : 'ছবি আপলোড করা যায়নি।');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleCouponSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!couponCode.trim()) return;
    setCouponSaving(true);
    try {
      await onSaveCoupon({
        code: couponCode.trim().toUpperCase(),
        discountPercent: Math.max(1, Number(couponDiscount) || 10),
        minOrder: Math.max(0, Number(couponMinOrder) || 0),
        description: couponDesc.trim(),
      });
      setCouponCode('');
      setCouponDesc('');
    } finally {
      setCouponSaving(false);
    }
  };

  const handleExportOrdersCsv = () => {
    const header = ['OrderID', 'Customer', 'Phone', 'District', 'Area', 'Payment', 'Total', 'Status', 'Date'];
    const rows = orders.map((o) => [
      o.orderId,
      o.customerName,
      o.phone,
      o.district,
      o.area,
      o.paymentMethod,
      String(o.total),
      o.orderStatus,
      o.createdAt,
    ]);
    const csv = [header, ...rows]
      .map((cols) => cols.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shopnexa-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredAdminProducts = products.filter((p) => {
    const q = adminSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      p.code.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      p.brand.toLowerCase().includes(q)
    );
  });

  const customerSummaries = Array.from(
    orders.reduce((map, order) => {
      const key = order.phone || order.customerName;
      const existing = map.get(key) || {
        name: order.customerName,
        phone: order.phone,
        district: order.district,
        ordersCount: 0,
        totalSpent: 0,
        lastOrder: order.createdAt,
      };
      existing.ordersCount += 1;
      if (order.orderStatus !== 'Cancelled') {
        existing.totalSpent += order.total;
      }
      map.set(key, existing);
      return map;
    }, new Map<string, { name: string; phone: string; district: string; ordersCount: number; totalSpent: number; lastOrder: string }>())
  ).map(([, val]) => val);

  return (
    <div className="min-h-screen bg-[#F9F8F6] dark:bg-[#0E0F12] text-[#141413] dark:text-[#F3F2EF]">
      <header className="border-b border-[#E5E2DC] dark:border-[#262930] bg-[#FFFFFF] dark:bg-[#16181D]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-6">
          <div className="flex items-center gap-4 min-w-0">
            <button
              type="button"
              onClick={onExitAdmin}
              className="inline-flex items-center gap-2 text-xs font-medium text-[#6B6964] hover:text-[#141413] dark:text-[#9CA0A6] dark:hover:text-white whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              স্টোরে ফিরে যান
            </button>
            <span className="text-[#E5E2DC] dark:text-[#2E323B]">/</span>
            <h1 className="text-base font-semibold truncate">SHOPNEXA · অ্যাডমিন ড্যাশবোর্ড</h1>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="hidden sm:inline text-xs font-mono text-[#6B6964] dark:text-[#9CA0A6]">
              লগইন: {adminUsername}
            </span>
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E5E2DC] dark:border-[#2E323B] text-xs font-medium text-[#6B6964] hover:text-[#DC2626] dark:text-[#9CA0A6] whitespace-nowrap shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
              লগআউট
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-xl bg-[#FFFFFF] dark:bg-[#16181D] border border-[#E5E2DC] dark:border-[#262930]">
            <span className="text-xs text-[#6B6964] dark:text-[#9CA0A6]">সক্রিয় পণ্য</span>
            <p className="mt-2 text-2xl font-semibold font-mono tabular-nums">
              {products.filter((p) => p.status === 'Active').length} / {products.length}
            </p>
          </div>
          <div className="p-5 rounded-xl bg-[#FFFFFF] dark:bg-[#16181D] border border-[#E5E2DC] dark:border-[#262930]">
            <span className="text-xs text-[#6B6964] dark:text-[#9CA0A6]">মোট স্টক</span>
            <p className="mt-2 text-2xl font-semibold font-mono tabular-nums">
              {totalInventoryUnits.toLocaleString()}
            </p>
            <span className="text-xs text-[#6B6964] dark:text-[#9CA0A6]">
              {lowStockCount} টি কম স্টক পণ্য
            </span>
          </div>
          <div className="p-5 rounded-xl bg-[#FFFFFF] dark:bg-[#16181D] border border-[#E5E2DC] dark:border-[#262930]">
            <span className="text-xs text-[#6B6964] dark:text-[#9CA0A6]">মোট অর্ডার</span>
            <p className="mt-2 text-2xl font-semibold font-mono tabular-nums">{orders.length}</p>
          </div>
          <div className="p-5 rounded-xl bg-[#FFFFFF] dark:bg-[#16181D] border border-[#E5E2DC] dark:border-[#262930]">
            <span className="text-xs text-[#6B6964] dark:text-[#9CA0A6]">মোট বিক্রয় মূল্য</span>
            <p className="mt-2 text-2xl font-semibold font-mono tabular-nums text-[#0F6E56] dark:text-[#34D399]">
              {formatBDT(totalRevenue)}
            </p>
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-2 border-b border-[#E5E2DC] dark:border-[#262930] pb-3">
          {[
            { id: 'products' as const, label: 'পণ্য ও আপলোড', icon: Package },
            { id: 'orders' as const, label: `অর্ডারসমূহ (${orders.length})`, icon: ShoppingBag },
            { id: 'coupons' as const, label: `কুপন ও অফার (${coupons.length})`, icon: Tag },
            { id: 'customers' as const, label: `ক্রেতা তালিকা (${customerSummaries.length})`, icon: Users },
            { id: 'settings' as const, label: 'স্টোর সেটিংস', icon: Sliders },
            { id: 'messages' as const, label: `বার্তাসমূহ (${messages.length})`, icon: MessageSquare },
            { id: 'stock' as const, label: 'স্টক ইতিহাস', icon: History },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-[#0F6E56] text-white'
                    : 'bg-[#FFFFFF] dark:bg-[#16181D] border border-[#E5E2DC] dark:border-[#262930] text-[#4A4945] dark:text-[#C8C6C0] hover:border-[#0F6E56]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === 'products' && (
          <section className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">সম্পূর্ণ পণ্য ব্যবস্থাপনা ও আপলোড</h2>
                <p className="text-xs text-[#6B6964] dark:text-[#9CA0A6]">
                  নতুন পণ্য আপলোড করুন অথবা বিদ্যমান পণ্যের ১৯টি ফিল্ড ও তথ্য সহজে এডিট করুন।
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#6B6964]" />
                  <input
                    type="search"
                    value={adminSearch}
                    onChange={(e) => setAdminSearch(e.target.value)}
                    placeholder="পণ্য খুঁজুন..."
                    className="pl-8 pr-3 py-2 text-xs rounded-lg border border-[#E5E2DC] dark:border-[#2E323B] bg-[#FFFFFF] dark:bg-[#16181D] focus:outline-none focus:border-[#0F6E56]"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => openNewProductForm('standard')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0F6E56] text-white text-xs font-semibold hover:bg-[#0C5945] whitespace-nowrap shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  নতুন পণ্য আপলোড করুন
                </button>
                <button
                  type="button"
                  onClick={() => openNewProductForm('affiliate')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#D97706] text-white text-xs font-semibold hover:bg-[#B45309] whitespace-nowrap shrink-0"
                >
                  <ExternalLink className="w-4 h-4" />
                  এফিলিয়েট প্রোডাক্ট এড
                </button>
              </div>
            </div>

            {showProductForm && (
              <form
                onSubmit={handleProductFormSubmit}
                className="p-6 rounded-xl bg-[#FFFFFF] dark:bg-[#16181D] border border-[#E5E2DC] dark:border-[#262930] space-y-6"
              >
                <div className="flex items-center justify-between border-b border-[#E5E2DC] dark:border-[#262930] pb-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold">
                        {editingProduct
                          ? `${productForm.productType === 'affiliate' ? 'এফিলিয়েট পণ্য এডিট করুন' : 'পণ্য এডিট করুন'}: ${editingProduct.name}`
                          : productForm.productType === 'affiliate'
                          ? 'এফিলিয়েট প্রোডাক্ট এড ফর্ম'
                          : 'নতুন পণ্য আপলোড ফর্ম'}
                      </h3>
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                          productForm.productType === 'affiliate'
                            ? 'bg-[#D97706]/15 text-[#D97706] dark:text-[#FBBF24]'
                            : 'bg-[#0F6E56]/15 text-[#0F6E56] dark:text-[#34D399]'
                        }`}
                      >
                        {productForm.productType === 'affiliate' ? 'Affiliate External Link' : 'Direct Store'}
                      </span>
                    </div>
                    {editingProduct && (
                      <p className="text-xs font-mono text-[#6B6964] dark:text-[#9CA0A6] mt-0.5">
                        পণ্য আইডি (ID): {editingProduct.id} · তৈরির সময় (Created At):{' '}
                        {editingProduct.createdAt}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowProductForm(false);
                      setEditingProduct(null);
                    }}
                    className="p-1.5 rounded-lg text-[#6B6964] hover:text-[#141413] dark:hover:text-white"
                    aria-label="ফর্ম বন্ধ করুন"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {productError && (
                  <div className="p-3 rounded-lg bg-[#DC2626]/10 border border-[#DC2626]/30 text-xs text-[#DC2626]">
                    {productError}
                  </div>
                )}

                {/* ধাপ ১: মূল পরিচিতি */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-[#0F6E56] dark:text-[#34D399]">
                    ০১. মূল পরিচিতি ও ক্যাটাগরি
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium mb-1">পণ্যের নাম (Name) *</label>
                      <input
                        type="text"
                        required
                        value={productForm.name}
                        onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                        placeholder="যেমন: Dhaka Loom Charcoal Overshirt"
                        className="w-full px-3.5 py-2 text-sm rounded-lg border border-[#E5E2DC] dark:border-[#2E323B] bg-[#F9F8F6] dark:bg-[#1D2026]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">প্রোডাক্ট কোড (Code) *</label>
                      <input
                        type="text"
                        required
                        value={productForm.code}
                        onChange={(e) => setProductForm({ ...productForm, code: e.target.value })}
                        placeholder="যেমন: PHB-1001"
                        className="w-full px-3.5 py-2 text-sm font-mono rounded-lg border border-[#E5E2DC] dark:border-[#2E323B] bg-[#F9F8F6] dark:bg-[#1D2026]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">এসকেইউ (SKU) *</label>
                      <input
                        type="text"
                        required
                        value={productForm.sku}
                        onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })}
                        placeholder="যেমন: PHB-APP-OVS-01"
                        className="w-full px-3.5 py-2 text-sm font-mono rounded-lg border border-[#E5E2DC] dark:border-[#2E323B] bg-[#F9F8F6] dark:bg-[#1D2026]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">ব্র্যান্ড (Brand) *</label>
                      <input
                        type="text"
                        required
                        value={productForm.brand}
                        onChange={(e) => setProductForm({ ...productForm, brand: e.target.value })}
                        placeholder="যেমন: Atelier Dhaka"
                        className="w-full px-3.5 py-2 text-sm rounded-lg border border-[#E5E2DC] dark:border-[#2E323B] bg-[#F9F8F6] dark:bg-[#1D2026]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">ক্যাটাগরি (Category) *</label>
                      <select
                        value={productForm.category}
                        onChange={(e) => {
                          const cat = categories.find((c) => c.name === e.target.value);
                          setProductForm({
                            ...productForm,
                            category: e.target.value,
                            subcategory: cat?.subcategories[0] || productForm.subcategory,
                          });
                        }}
                        className="w-full px-3.5 py-2 text-sm rounded-lg border border-[#E5E2DC] dark:border-[#2E323B] bg-[#F9F8F6] dark:bg-[#1D2026]"
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.name}>
                            {CATEGORY_LABELS_BN[c.name] ? `${CATEGORY_LABELS_BN[c.name]} (${c.name})` : c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">সাব-ক্যাটাগরি (Subcategory) *</label>
                      <input
                        type="text"
                        required
                        value={productForm.subcategory}
                        onChange={(e) =>
                          setProductForm({ ...productForm, subcategory: e.target.value })
                        }
                        placeholder="যেমন: Overshirts"
                        className="w-full px-3.5 py-2 text-sm rounded-lg border border-[#E5E2DC] dark:border-[#2E323B] bg-[#F9F8F6] dark:bg-[#1D2026]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">অবস্থা (Status) *</label>
                      <select
                        value={productForm.status}
                        onChange={(e) =>
                          setProductForm({
                            ...productForm,
                            status: e.target.value === 'Draft' ? 'Draft' : 'Active',
                          })
                        }
                        className="w-full px-3.5 py-2 text-sm rounded-lg border border-[#E5E2DC] dark:border-[#2E323B] bg-[#F9F8F6] dark:bg-[#1D2026]"
                      >
                        <option value="Active">সক্রিয় (স্টোরে দৃশ্যমান)</option>
                        <option value="Draft">খসড়া (স্টোরে লুকানো)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* ধাপ ২: মূল্য ও অর্ডার মাধ্যম */}
                <div className="space-y-4 pt-4 border-t border-[#E5E2DC] dark:border-[#262930]">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-[#0F6E56] dark:text-[#34D399]">
                    {productForm.productType === 'affiliate'
                      ? '০২. মূল্য ও এফিলিয়েট এক্সটার্নাল লিংক'
                      : '০২. মূল্য ও ইনভেন্টরি নিয়ন্ত্রণ'}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div>
                      <label className="block text-xs font-medium mb-1">রেগুলার মূল্য (Regular Price ৳) *</label>
                      <input
                        type="number"
                        min={0}
                        required
                        value={productForm.regularPrice}
                        onChange={(e) =>
                          setProductForm({ ...productForm, regularPrice: e.target.value })
                        }
                        placeholder="3850"
                        className="w-full px-3.5 py-2 text-sm font-mono rounded-lg border border-[#E5E2DC] dark:border-[#2E323B] bg-[#F9F8F6] dark:bg-[#1D2026]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">ডিসকাউন্ট মূল্য (Discount Price ৳)</label>
                      <input
                        type="number"
                        min={0}
                        value={productForm.discountPrice}
                        onChange={(e) =>
                          setProductForm({ ...productForm, discountPrice: e.target.value })
                        }
                        placeholder="ঐচ্ছিক"
                        className="w-full px-3.5 py-2 text-sm font-mono rounded-lg border border-[#E5E2DC] dark:border-[#2E323B] bg-[#F9F8F6] dark:bg-[#1D2026]"
                      />
                    </div>
                    {productForm.productType === 'standard' && (
                      <>
                        <div>
                          <label className="block text-xs font-medium mb-1">ক্রয় মূল্য (Purchase Price ৳)</label>
                          <input
                            type="number"
                            min={0}
                            value={productForm.purchasePrice}
                            onChange={(e) =>
                              setProductForm({ ...productForm, purchasePrice: e.target.value })
                            }
                            placeholder="কেনা দাম"
                            className="w-full px-3.5 py-2 text-sm font-mono rounded-lg border border-[#E5E2DC] dark:border-[#2E323B] bg-[#F9F8F6] dark:bg-[#1D2026]"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1">স্টক পরিমাণ (Stock) *</label>
                          <input
                            type="number"
                            min={0}
                            required
                            value={productForm.stock}
                            onChange={(e) => setProductForm({ ...productForm, stock: e.target.value })}
                            placeholder="50"
                            className="w-full px-3.5 py-2 text-sm font-mono rounded-lg border border-[#E5E2DC] dark:border-[#2E323B] bg-[#F9F8F6] dark:bg-[#1D2026]"
                          />
                        </div>
                      </>
                    )}
                    <div className={productForm.productType === 'affiliate' ? 'lg:col-span-3' : ''}>
                      <label className="block text-xs font-medium mb-1">পিস তথ্য (Pieces Info)</label>
                      <input
                        type="text"
                        value={productForm.piecesInfo}
                        onChange={(e) =>
                          setProductForm({ ...productForm, piecesInfo: e.target.value })
                        }
                        placeholder="যেমন: ১ পিস / ২ পিসের সেট"
                        className="w-full px-3.5 py-2 text-sm rounded-lg border border-[#E5E2DC] dark:border-[#2E323B] bg-[#F9F8F6] dark:bg-[#1D2026]"
                      />
                    </div>
                  </div>

                  {productForm.productType === 'affiliate' && (
                    <div className="p-4 rounded-xl border border-[#D97706]/35 bg-[#D97706]/8 space-y-2">
                      <label className="block text-xs font-semibold text-[#B45309] dark:text-[#FBBF24]">
                        Affiliate URL / External Link (এফিলিয়েট ওয়েবসাইট লিংক) *
                      </label>
                      <input
                        type="url"
                        required
                        value={productForm.affiliateUrl}
                        onChange={(e) =>
                          setProductForm({ ...productForm, affiliateUrl: e.target.value })
                        }
                        placeholder="https://www.aliexpress.com/item/..."
                        className="w-full px-3.5 py-2.5 text-sm font-mono rounded-lg border border-[#D97706]/40 bg-[#FFFFFF] dark:bg-[#12151C] focus:outline-none focus:border-[#D97706]"
                      />
                      <p className="text-[11px] text-[#6B6964] dark:text-[#D1D5DB]">
                        এই পণ্যের জন্য স্টোরের নিজস্ব কার্ট, বিকাশ/নগদ বা COD চেকআউট ব্যবহার হবে না। ক্রেতা <strong className="text-[#141413] dark:text-white">Buy Now</strong> বাটনে ক্লিক করলে সরাসরি এই লিংকে গিয়ে পণ্য কিনতে পারবেন।
                      </p>
                    </div>
                  )}
                </div>

                {/* ধাপ ৩: বৈশিষ্ট্য, ছবি ও বিবরণ */}
                <div className="space-y-4 pt-4 border-t border-[#E5E2DC] dark:border-[#262930]">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-[#0F6E56] dark:text-[#34D399]">
                    ০৩. বৈশিষ্ট্য, সাইজ/ভ্যারিয়েন্ট ও ছবি
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium mb-1">ওজন (Weight)</label>
                      <input
                        type="text"
                        value={productForm.weight}
                        onChange={(e) => setProductForm({ ...productForm, weight: e.target.value })}
                        placeholder="যেমন: 480g"
                        className="w-full px-3.5 py-2 text-sm rounded-lg border border-[#E5E2DC] dark:border-[#2E323B] bg-[#F9F8F6] dark:bg-[#1D2026]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">ওয়ারেন্টি (Warranty)</label>
                      <input
                        type="text"
                        value={productForm.warranty}
                        onChange={(e) =>
                          setProductForm({ ...productForm, warranty: e.target.value })
                        }
                        placeholder="যেমন: ২ বছরের ওয়ারেন্টি"
                        className="w-full px-3.5 py-2 text-sm rounded-lg border border-[#E5E2DC] dark:border-[#2E323B] bg-[#F9F8F6] dark:bg-[#1D2026]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">
                        সাইজ ও ভ্যারিয়েন্ট (Size / Variants — কমা দিয়ে লিখুন)
                      </label>
                      <input
                        type="text"
                        value={productForm.variants}
                        onChange={(e) =>
                          setProductForm({ ...productForm, variants: e.target.value })
                        }
                        placeholder="যেমন: S, M, L, XL"
                        className="w-full px-3.5 py-2 text-sm rounded-lg border border-[#E5E2DC] dark:border-[#2E323B] bg-[#F9F8F6] dark:bg-[#1D2026]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                    <div className="md:col-span-9 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label className="block text-xs font-medium">ছবির লিংক বা ডিভাইস আপলোড (Product Image)</label>
                        <label className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#0F6E56]/10 text-[#0F6E56] dark:text-[#34D399] border border-[#0F6E56]/30 text-[11px] font-semibold cursor-pointer hover:bg-[#0F6E56]/20">
                          <Upload className="w-3.5 h-3.5" />
                          {uploadingImage ? 'আপলোড হচ্ছে...' : 'গ্যালারি থেকে ছবি আপলোড'}
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            onChange={handleImageFileChange}
                            className="sr-only"
                          />
                        </label>
                      </div>
                      <input
                        type="text"
                        value={productForm.image}
                        onChange={(e) => setProductForm({ ...productForm, image: e.target.value })}
                        placeholder="/assets/aistudio/... অথবা https://..."
                        className="w-full px-3.5 py-2 text-sm font-mono rounded-lg border border-[#E5E2DC] dark:border-[#2E323B] bg-[#F9F8F6] dark:bg-[#1D2026]"
                      />
                      <div className="flex flex-wrap gap-1.5">
                        {IMAGE_PRESETS.map((preset) => (
                          <button
                            key={preset.url}
                            type="button"
                            onClick={() => setProductForm({ ...productForm, image: preset.url })}
                            className="px-2.5 py-1 rounded border border-[#E5E2DC] dark:border-[#2E323B] text-[11px] hover:border-[#0F6E56]"
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="md:col-span-3">
                      <span className="block text-xs font-medium mb-1">ছবির প্রিভিউ</span>
                      <div className="aspect-[4/3] rounded-lg overflow-hidden border border-[#E5E2DC] dark:border-[#2E323B] bg-[#F2F0EC] dark:bg-[#1D2026]">
                        <ProductImage
                          src={productForm.image}
                          alt={productForm.name || 'Preview'}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-1">পণ্যের বিস্তারিত বিবরণ (Description) *</label>
                    <textarea
                      required
                      rows={3}
                      value={productForm.description}
                      onChange={(e) =>
                        setProductForm({ ...productForm, description: e.target.value })
                      }
                      placeholder="পণ্যের উপাদান, ফিট, ব্যবহার ও মান সম্পর্কে বিস্তারিত লিখুন..."
                      className="w-full px-3.5 py-2 text-sm rounded-lg border border-[#E5E2DC] dark:border-[#2E323B] bg-[#F9F8F6] dark:bg-[#1D2026]"
                    />
                  </div>

                  {editingProduct && (
                    <div>
                      <label className="block text-xs font-medium mb-1">
                        ইনভেন্টরি / পরিবর্তন নোট (ঐচ্ছিক)
                      </label>
                      <input
                        type="text"
                        value={productForm.reason}
                        onChange={(e) => setProductForm({ ...productForm, reason: e.target.value })}
                        placeholder="স্টক বা মূল্য পরিবর্তনের কারণ"
                        className="w-full px-3.5 py-2 text-sm rounded-lg border border-[#E5E2DC] dark:border-[#2E323B] bg-[#F9F8F6] dark:bg-[#1D2026]"
                      />
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-[#E5E2DC] dark:border-[#262930]">
                  <button
                    type="button"
                    onClick={() => {
                      setShowProductForm(false);
                      setEditingProduct(null);
                    }}
                    className="px-4 py-2 rounded-lg border border-[#E5E2DC] dark:border-[#2E323B] text-xs font-medium"
                  >
                    বাতিল করুন
                  </button>
                  <button
                    type="submit"
                    disabled={savingProduct}
                    className="px-5 py-2 rounded-lg bg-[#0F6E56] hover:bg-[#0C5945] text-white text-xs font-semibold disabled:opacity-50"
                  >
                    {savingProduct
                      ? 'সংরক্ষণ হচ্ছে...'
                      : editingProduct
                      ? 'সব পরিবর্তন সেভ করুন'
                      : 'পণ্য প্রকাশ করুন'}
                  </button>
                </div>
              </form>
            )}

            <div className="rounded-xl bg-[#FFFFFF] dark:bg-[#16181D] border border-[#E5E2DC] dark:border-[#262930] overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[#E5E2DC] dark:border-[#262930] text-xs text-[#6B6964] dark:text-[#9CA0A6]">
                    <th className="py-3 px-4 font-medium">কোড / SKU</th>
                    <th className="py-3 px-4 font-medium">পণ্য</th>
                    <th className="py-3 px-4 font-medium">ক্যাটাগরি</th>
                    <th className="py-3 px-4 font-medium text-right">রেগুলার</th>
                    <th className="py-3 px-4 font-medium text-right">বিক্রয় মূল্য</th>
                    <th className="py-3 px-4 font-medium text-right">ক্রয় মূল্য</th>
                    <th className="py-3 px-4 font-medium text-right">স্টক</th>
                    <th className="py-3 px-4 font-medium">অবস্থা</th>
                    <th className="py-3 px-4 font-medium text-right">অ্যাকশন</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E2DC] dark:divide-[#262930]">
                  {filteredAdminProducts.map((product) => (
                    <tr key={product.id} className="hover:bg-[#F9F8F6] dark:hover:bg-[#1A1D24]">
                      <td className="py-3 px-4 font-mono text-xs text-[#6B6964] dark:text-[#9CA0A6] whitespace-nowrap">
                        <div>{product.code}</div>
                        <div>{product.sku}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap items-center gap-1.5 font-medium">
                          <span>{product.name}</span>
                          {product.productType === 'affiliate' && (
                            <span className="px-1.5 py-0.5 rounded bg-[#D97706]/15 text-[#D97706] dark:text-[#FBBF24] text-[10px] font-semibold">
                              Affiliate
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-[#6B6964] dark:text-[#9CA0A6]">
                          {product.brand} · {product.weight || '—'} · {product.piecesInfo || '১ পিস'}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs text-[#6B6964] dark:text-[#9CA0A6]">
                        {CATEGORY_LABELS_BN[product.category] || product.category} / {product.subcategory}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        {formatBDT(product.regularPrice)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        {formatBDT(getEffectivePrice(product))}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-[#6B6964]">
                        {product.productType === 'affiliate' ? '—' : formatBDT(product.purchasePrice)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-xs">
                        {product.productType === 'affiliate' ? 'External Link' : product.stock}
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateProduct(
                              {
                                ...product,
                                status: product.status === 'Active' ? 'Draft' : 'Active',
                              },
                              'অবস্থা পরিবর্তন'
                            )
                          }
                          className={`px-2 py-0.5 rounded border text-xs font-medium ${
                            product.status === 'Active'
                              ? 'border-[#0F6E56]/40 text-[#0F6E56] dark:text-[#34D399]'
                              : 'border-[#E5E2DC] text-[#6B6964]'
                          }`}
                        >
                          {product.status === 'Active' ? 'সক্রিয়' : 'খসড়া'}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditProductForm(product)}
                            className="px-3 py-1.5 rounded border border-[#E5E2DC] dark:border-[#2E323B] text-xs font-medium hover:border-[#0F6E56]"
                          >
                            এডিট
                          </button>
                          {confirmDeleteId === product.id ? (
                            <button
                              type="button"
                              onClick={async () => {
                                await onDeleteProduct(product.id);
                                setConfirmDeleteId(null);
                              }}
                              className="px-2.5 py-1.5 rounded bg-[#DC2626] text-white text-xs font-semibold"
                            >
                              নিশ্চিত ডিলিট
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(product.id)}
                              className="p-1.5 rounded border border-[#E5E2DC] dark:border-[#2E323B] text-[#6B6964] hover:text-[#DC2626]"
                              aria-label="পণ্য ডিলিট করুন"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeTab === 'orders' && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">সকল কাস্টমার অর্ডার</h2>
              {orders.length > 0 && (
                <button
                  type="button"
                  onClick={handleExportOrdersCsv}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E5E2DC] dark:border-[#2E323B] bg-[#FFFFFF] dark:bg-[#16181D] text-xs font-medium hover:border-[#0F6E56]"
                >
                  <Download className="w-3.5 h-3.5" />
                  CSV ডাউনলোড
                </button>
              )}
            </div>
            <div className="rounded-xl bg-[#FFFFFF] dark:bg-[#16181D] border border-[#E5E2DC] dark:border-[#262930] overflow-x-auto">
            {orders.length === 0 ? (
              <div className="p-12 text-center text-sm text-[#6B6964] dark:text-[#9CA0A6]">
                এখনো কোনো অর্ডার আসেনি। গেস্ট চেকআউট থেকে অর্ডার করা হলে এখানে দেখা যাবে।
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[#E5E2DC] dark:border-[#262930] text-xs text-[#6B6964] dark:text-[#9CA0A6]">
                    <th className="py-3 px-4 font-medium">অর্ডার আইডি</th>
                    <th className="py-3 px-4 font-medium">ক্রেতা</th>
                    <th className="py-3 px-4 font-medium">জেলা</th>
                    <th className="py-3 px-4 font-medium">পেমেন্ট</th>
                    <th className="py-3 px-4 font-medium text-right">মোট</th>
                    <th className="py-3 px-4 font-medium">অর্ডার স্ট্যাটাস</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E2DC] dark:divide-[#262930]">
                  {orders.map((order) => (
                    <tr key={order.orderId}>
                      <td className="py-3 px-4 font-mono text-xs">{order.orderId}</td>
                      <td className="py-3 px-4">
                        <div className="font-medium">{order.customerName}</div>
                        <div className="text-xs font-mono text-[#6B6964]">{order.phone}</div>
                      </td>
                      <td className="py-3 px-4 text-xs">
                        {order.area}, {order.district}
                      </td>
                      <td className="py-3 px-4 text-xs">
                        {order.paymentMethod}
                        {order.trxId ? ` · ${order.trxId}` : ''}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold">
                        {formatBDT(order.total)}
                      </td>
                      <td className="py-3 px-4">
                        <select
                          value={order.orderStatus}
                          onChange={(e) =>
                            onUpdateOrderStatus(
                              order.orderId,
                              e.target.value as OrderStatus,
                              order.paymentStatus
                            )
                          }
                          className="px-2.5 py-1 text-xs rounded border border-[#E5E2DC] dark:border-[#2E323B] bg-[#F9F8F6] dark:bg-[#1D2026]"
                        >
                          {(['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'] as OrderStatus[]).map(
                            (st) => (
                              <option key={st} value={st}>
                                {ORDER_STATUS_BN[st]}
                              </option>
                            )
                          )}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            </div>
          </section>
        )}

        {activeTab === 'coupons' && (
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <form
              onSubmit={handleCouponSubmit}
              className="lg:col-span-5 p-6 rounded-xl bg-[#FFFFFF] dark:bg-[#16181D] border border-[#E5E2DC] dark:border-[#262930] space-y-4"
            >
              <h2 className="text-base font-semibold">নতুন প্রোমো কুপন তৈরি করুন</h2>
              <div>
                <label className="block text-xs font-medium mb-1">কুপন কোড (Coupon Code) *</label>
                <input
                  type="text"
                  required
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  placeholder="যেমন: EID20"
                  className="w-full px-3.5 py-2 text-sm font-mono rounded-lg border border-[#E5E2DC] dark:border-[#2E323B] bg-[#F9F8F6] dark:bg-[#1D2026]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">ছাড় (%)</label>
                  <input
                    type="number"
                    min={1}
                    max={90}
                    required
                    value={couponDiscount}
                    onChange={(e) => setCouponDiscount(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm font-mono rounded-lg border border-[#E5E2DC] dark:border-[#2E323B] bg-[#F9F8F6] dark:bg-[#1D2026]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">সর্বনিম্ন অর্ডার (৳)</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={couponMinOrder}
                    onChange={(e) => setCouponMinOrder(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm font-mono rounded-lg border border-[#E5E2DC] dark:border-[#2E323B] bg-[#F9F8F6] dark:bg-[#1D2026]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">বিবরণ (Description)</label>
                <input
                  type="text"
                  value={couponDesc}
                  onChange={(e) => setCouponDesc(e.target.value)}
                  placeholder="যেমন: ঈদ স্পেশাল ২০% ছাড়"
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-[#E5E2DC] dark:border-[#2E323B] bg-[#F9F8F6] dark:bg-[#1D2026]"
                />
              </div>
              <button
                type="submit"
                disabled={couponSaving}
                className="w-full py-2.5 px-4 rounded-lg bg-[#0F6E56] hover:bg-[#0C5945] text-white text-xs font-semibold disabled:opacity-50"
              >
                {couponSaving ? 'সংরক্ষণ হচ্ছে...' : 'কুপন যোগ করুন'}
              </button>
            </form>

            <div className="lg:col-span-7 space-y-3">
              {coupons.map((c) => (
                <div
                  key={c.code}
                  className="p-4 rounded-xl bg-[#FFFFFF] dark:bg-[#16181D] border border-[#E5E2DC] dark:border-[#262930] flex items-center justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-[#0F6E56] dark:text-[#34D399]">
                        {c.code}
                      </span>
                      <span className="text-xs font-mono">
                        {c.discountPercent}% ছাড় · সর্বনিম্ন {formatBDT(c.minOrder)}
                      </span>
                    </div>
                    <p className="text-xs text-[#6B6964] dark:text-[#9CA0A6] mt-0.5">{c.description}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onToggleCoupon(c.code)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                      c.active
                        ? 'border-[#0F6E56]/40 text-[#0F6E56] dark:text-[#34D399]'
                        : 'border-[#E5E2DC] text-[#6B6964]'
                    }`}
                  >
                    {c.active ? 'সক্রিয়' : 'বন্ধ'}
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'customers' && (
          <section className="rounded-xl bg-[#FFFFFF] dark:bg-[#16181D] border border-[#E5E2DC] dark:border-[#262930] overflow-x-auto">
            {customerSummaries.length === 0 ? (
              <div className="p-12 text-center text-sm text-[#6B6964] dark:text-[#9CA0A6]">
                অর্ডার করা গেস্ট ক্রেতাদের তালিকা এখানে স্বয়ংক্রিয়ভাবে তৈরি হবে।
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[#E5E2DC] dark:border-[#262930] text-xs text-[#6B6964] dark:text-[#9CA0A6]">
                    <th className="py-3 px-4 font-medium">ক্রেতার নাম</th>
                    <th className="py-3 px-4 font-medium">মোবাইল</th>
                    <th className="py-3 px-4 font-medium">জেলা</th>
                    <th className="py-3 px-4 font-medium text-right">মোট অর্ডার</th>
                    <th className="py-3 px-4 font-medium text-right">মোট খরচ</th>
                    <th className="py-3 px-4 font-medium">সর্বশেষ অর্ডার</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E2DC] dark:divide-[#262930]">
                  {customerSummaries.map((cust) => (
                    <tr key={`${cust.phone}-${cust.name}`}>
                      <td className="py-3 px-4 font-medium">{cust.name}</td>
                      <td className="py-3 px-4 font-mono text-xs">{cust.phone}</td>
                      <td className="py-3 px-4 text-xs">{cust.district}</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">{cust.ordersCount}</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold">
                        {formatBDT(cust.totalSpent)}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-[#6B6964]">{cust.lastOrder}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        )}

        {activeTab === 'settings' && (
          <form
            onSubmit={handleSaveSettings}
            className="p-6 rounded-xl bg-[#FFFFFF] dark:bg-[#16181D] border border-[#E5E2DC] dark:border-[#262930] space-y-5"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">লাইভ স্টোর সেটিংস</h2>
              <button
                type="submit"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0F6E56] text-white text-xs font-semibold hover:bg-[#0C5945]"
              >
                {settingsSaved ? <Check className="w-4 h-4" /> : null}
                {settingsSaved ? 'সেভ হয়েছে' : 'সেটিংস সেভ করুন'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1">স্টোরের নাম (Store Name)</label>
                <input
                  type="text"
                  value={settingsDraft.site_name}
                  onChange={(e) =>
                    setSettingsDraft({ ...settingsDraft, site_name: e.target.value })
                  }
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-[#E5E2DC] dark:border-[#2E323B] bg-[#F9F8F6] dark:bg-[#1D2026]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">ট্যাগলাইন (Tagline / Sub-headline)</label>
                <input
                  type="text"
                  value={settingsDraft.site_tagline}
                  onChange={(e) =>
                    setSettingsDraft({ ...settingsDraft, site_tagline: e.target.value })
                  }
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-[#E5E2DC] dark:border-[#2E323B] bg-[#F9F8F6] dark:bg-[#1D2026]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">হিরো হেডলাইন (Hero Headline)</label>
                <input
                  type="text"
                  value={settingsDraft.hero_title}
                  onChange={(e) =>
                    setSettingsDraft({ ...settingsDraft, hero_title: e.target.value })
                  }
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-[#E5E2DC] dark:border-[#2E323B] bg-[#F9F8F6] dark:bg-[#1D2026]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">ব্র্যান্ড বিবরণ (Brand Description)</label>
                <input
                  type="text"
                  value={settingsDraft.hero_subtitle}
                  onChange={(e) =>
                    setSettingsDraft({ ...settingsDraft, hero_subtitle: e.target.value })
                  }
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-[#E5E2DC] dark:border-[#2E323B] bg-[#F9F8F6] dark:bg-[#1D2026]"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium mb-1">প্রোমো ব্যানার টেক্সট</label>
                <input
                  type="text"
                  value={settingsDraft.promo_banner_text}
                  onChange={(e) =>
                    setSettingsDraft({ ...settingsDraft, promo_banner_text: e.target.value })
                  }
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-[#E5E2DC] dark:border-[#2E323B] bg-[#F9F8F6] dark:bg-[#1D2026]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">বিকাশ নম্বর (bKash Number)</label>
                <input
                  type="text"
                  value={settingsDraft.bkash_number}
                  onChange={(e) =>
                    setSettingsDraft({ ...settingsDraft, bkash_number: e.target.value })
                  }
                  className="w-full px-3.5 py-2 text-sm font-mono rounded-lg border border-[#E5E2DC] dark:border-[#2E323B] bg-[#F9F8F6] dark:bg-[#1D2026]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">নগদ নম্বর (Nagad Number)</label>
                <input
                  type="text"
                  value={settingsDraft.nagad_number}
                  onChange={(e) =>
                    setSettingsDraft({ ...settingsDraft, nagad_number: e.target.value })
                  }
                  className="w-full px-3.5 py-2 text-sm font-mono rounded-lg border border-[#E5E2DC] dark:border-[#2E323B] bg-[#F9F8F6] dark:bg-[#1D2026]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">সাপোর্ট / হোয়াটসঅ্যাপ নম্বর</label>
                <input
                  type="text"
                  value={settingsDraft.support_phone}
                  onChange={(e) =>
                    setSettingsDraft({ ...settingsDraft, support_phone: e.target.value })
                  }
                  className="w-full px-3.5 py-2 text-sm font-mono rounded-lg border border-[#E5E2DC] dark:border-[#2E323B] bg-[#F9F8F6] dark:bg-[#1D2026]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">
                  ফ্রি ডেলিভারি সীমা (৳ BDT)
                </label>
                <input
                  type="number"
                  value={settingsDraft.free_delivery_threshold}
                  onChange={(e) =>
                    setSettingsDraft({
                      ...settingsDraft,
                      free_delivery_threshold: Number(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3.5 py-2 text-sm font-mono rounded-lg border border-[#E5E2DC] dark:border-[#2E323B] bg-[#F9F8F6] dark:bg-[#1D2026]"
                />
              </div>
            </div>
          </form>
        )}

        {activeTab === 'messages' && (
          <section className="space-y-3">
            {messages.length === 0 ? (
              <div className="p-12 rounded-xl bg-[#FFFFFF] dark:bg-[#16181D] border border-[#E5E2DC] dark:border-[#262930] text-center text-sm text-[#6B6964]">
                এখনো কোনো কাস্টমার বার্তা আসেনি।
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className="p-5 rounded-xl bg-[#FFFFFF] dark:bg-[#16181D] border border-[#E5E2DC] dark:border-[#262930] flex flex-col sm:flex-row justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center gap-2 text-xs text-[#6B6964] font-mono">
                      <span>{msg.name}</span>
                      <span>·</span>
                      <span>{msg.phone}</span>
                      <span>·</span>
                      <span>{msg.status === 'Unread' ? 'অপঠিত' : 'উত্তর দেওয়া হয়েছে'}</span>
                    </div>
                    <h3 className="text-sm font-semibold mt-1">{msg.subject}</h3>
                    <p className="text-sm text-[#4A4945] dark:text-[#C8C6C0] mt-1">{msg.message}</p>
                  </div>
                  {msg.status === 'Unread' && (
                    <button
                      type="button"
                      onClick={() => onMarkMessageReplied(msg.id)}
                      className="self-start px-3 py-1.5 rounded-lg border border-[#E5E2DC] dark:border-[#2E323B] text-xs font-medium hover:border-[#0F6E56] whitespace-nowrap shrink-0"
                    >
                      রিপ্লাই চিহ্নিত করুন
                    </button>
                  )}
                </div>
              ))
            )}
          </section>
        )}

        {activeTab === 'stock' && (
          <section className="rounded-xl bg-[#FFFFFF] dark:bg-[#16181D] border border-[#E5E2DC] dark:border-[#262930] overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#E5E2DC] dark:border-[#262930] text-xs text-[#6B6964] dark:text-[#9CA0A6]">
                  <th className="py-3 px-4 font-medium">SKU</th>
                  <th className="py-3 px-4 font-medium">পণ্য</th>
                  <th className="py-3 px-4 font-medium text-right">পরিবর্তন</th>
                  <th className="py-3 px-4 font-medium text-right">নতুন স্টক</th>
                  <th className="py-3 px-4 font-medium">কারণ</th>
                  <th className="py-3 px-4 font-medium">তারিখ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E2DC] dark:divide-[#262930]">
                {stockHistory.map((entry) => (
                  <tr key={entry.id}>
                    <td className="py-3 px-4 font-mono text-xs">{entry.sku}</td>
                    <td className="py-3 px-4 font-medium">{entry.productName}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      {entry.change >= 0 ? `+${entry.change}` : entry.change}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      {entry.newStock}
                    </td>
                    <td className="py-3 px-4 text-xs text-[#6B6964]">{entry.reason}</td>
                    <td className="py-3 px-4 font-mono text-xs text-[#6B6964]">{entry.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </main>
    </div>
  );
}
