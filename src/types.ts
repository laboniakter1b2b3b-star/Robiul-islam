export type Language = 'en' | 'bn';

export type PaymentMethod = 'bKash' | 'Nagad' | 'COD';
export type PaymentStatus = 'Pending Verification' | 'Verified' | 'COD Unpaid' | 'Paid';
export type OrderStatus = 'Pending' | 'Confirmed' | 'Shipped' | 'Delivered' | 'Cancelled';

export interface Product {
  id: number;
  code: string;
  sku: string;
  name: string;
  category: string;
  subcategory: string;
  brand: string;
  regularPrice: number;
  discountPrice: number | null;
  purchasePrice: number;
  stock: number;
  piecesInfo: string;
  weight: string;
  warranty: string;
  status: 'Active' | 'Draft';
  productType?: 'standard' | 'affiliate';
  affiliateUrl?: string;
  image: string;
  description: string;
  variants: string[];
  createdAt: string;
}

export interface AdminAuthStatus {
  configured: boolean;
  emailProviderConfigured: boolean;
}

export interface Category {
  id: number;
  name: string;
  subcategories: string[];
  description: string;
  image: string;
}

export interface ProductReview {
  id: string;
  productId: number;
  author: string;
  rating: number;
  comment: string;
  date: string;
}

export interface CartItem {
  productId: number;
  variant: string;
  quantity: number;
}

export interface OrderItem {
  productId: number;
  code: string;
  sku: string;
  name: string;
  variant: string;
  unitPrice: number;
  quantity: number;
  image: string;
}

export interface Order {
  orderId: string;
  customerName: string;
  phone: string;
  email: string;
  district: string;
  area: string;
  fullAddress: string;
  deliveryZone: 'dhaka' | 'outside';
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  trxId: string;
  couponCode: string;
  discountAmount: number;
  deliveryFee: number;
  subtotal: number;
  total: number;
  items: OrderItem[];
  createdAt: string;
}

export interface ContactMessage {
  id: number;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  status: 'Unread' | 'Replied';
  createdAt: string;
}

export interface StockHistoryEntry {
  id: number;
  productId: number;
  productName: string;
  sku: string;
  variant: string;
  change: number;
  prevStock: number;
  newStock: number;
  reason: string;
  admin: string;
  date: string;
}

export interface Coupon {
  code: string;
  discountPercent: number;
  minOrder: number;
  description: string;
  active: boolean;
}

export interface StoreSettings {
  site_name: string;
  site_tagline: string;
  hero_banner: string;
  hero_title: string;
  hero_subtitle: string;
  hero_cta_text: string;
  secondary_banner: string;
  secondary_title: string;
  secondary_subtitle: string;
  promo_banner_text: string;
  whatsapp_number: string;
  support_phone: string;
  support_email: string;
  store_address: string;
  bkash_number: string;
  nagad_number: string;
  cod_enabled: boolean;
  delivery_charge_dhaka: number;
  delivery_charge_outside: number;
  free_delivery_threshold: number;
  social_facebook: string;
  social_instagram: string;
  social_youtube: string;
  about_content: string;
  privacy_policy: string;
  terms_conditions: string;
  shipping_policy: string;
  return_policy: string;
  footer_text: string;
}

export type PolicyKey = 'about' | 'privacy' | 'terms' | 'shipping' | 'return' | 'faq';
