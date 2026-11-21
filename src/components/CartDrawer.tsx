import { useState, FormEvent } from 'react';
import { X, Minus, Plus, Trash2, CheckCircle2, ArrowLeft, Printer } from 'lucide-react';
import {
  CartItem,
  Coupon,
  Language,
  Order,
  PaymentMethod,
  Product,
  StoreSettings,
} from '../types';
import { BD_DISTRICTS, formatBDT, getEffectivePrice } from '../data/storeData';
import { ProductImage } from './ProductImage';

interface CartDrawerProps {
  isOpen: boolean;
  cart: CartItem[];
  products: Product[];
  coupons: Coupon[];
  settings: StoreSettings;
  lang: Language;
  onClose: () => void;
  onUpdateQty: (productId: number, variant: string, delta: number) => void;
  onRemoveItem: (productId: number, variant: string) => void;
  onPlaceOrder: (orderData: {
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
  }) => Promise<Order>;
}

export function CartDrawer({
  isOpen,
  cart,
  products,
  coupons,
  settings,
  lang,
  onClose,
  onUpdateQty,
  onRemoveItem,
  onPlaceOrder,
}: CartDrawerProps) {
  const [step, setStep] = useState<'bag' | 'checkout' | 'confirmed'>('bag');
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [couponError, setCouponError] = useState('');
  const [deliveryZone, setDeliveryZone] = useState<'dhaka' | 'outside'>('dhaka');

  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [district, setDistrict] = useState('Dhaka');
  const [area, setArea] = useState('');
  const [fullAddress, setFullAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('COD');
  const [trxId, setTrxId] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(null);

  if (!isOpen) return null;

  const detailedItems = cart
    .map((item) => {
      const product = products.find((p) => p.id === item.productId);
      if (!product) return null;
      return { ...item, product, unitPrice: getEffectivePrice(product) };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const subtotal = detailedItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  const discountAmount = appliedCoupon
    ? Math.round((subtotal * appliedCoupon.discountPercent) / 100)
    : 0;

  const afterDiscount = Math.max(0, subtotal - discountAmount);
  const qualifiesFreeDelivery = subtotal >= settings.free_delivery_threshold;
  const deliveryFee =
    detailedItems.length === 0
      ? 0
      : qualifiesFreeDelivery
      ? 0
      : deliveryZone === 'dhaka'
      ? settings.delivery_charge_dhaka
      : settings.delivery_charge_outside;

  const total = afterDiscount + deliveryFee;

  const handleApplyCoupon = () => {
    setCouponError('');
    const normalized = couponInput.trim().toUpperCase();
    if (!normalized) return;
    const found = coupons.find((c) => c.active && c.code.toUpperCase() === normalized);
    if (!found) {
      setCouponError(lang === 'bn' ? 'কুপন কোডটি সঠিক নয়।' : 'Invalid coupon code.');
      return;
    }
    if (subtotal < found.minOrder) {
      setCouponError(`Minimum order ${formatBDT(found.minOrder)} required.`);
      return;
    }
    setAppliedCoupon(found);
  };

  const handleCheckoutSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!customerName.trim() || !phone.trim() || !area.trim() || !fullAddress.trim()) {
      setFormError(
        lang === 'bn'
          ? 'অনুগ্রহ করে নাম, মোবাইল নম্বর, এলাকা ও সম্পূর্ণ ঠিকানা দিন।'
          : 'Please complete your name, phone, area, and full delivery address.'
      );
      return;
    }
    if ((paymentMethod === 'bKash' || paymentMethod === 'Nagad') && !trxId.trim()) {
      setFormError(
        lang === 'bn'
          ? `${paymentMethod} পেমেন্টের Transaction ID (TrxID) লিখুন।`
          : `Please enter your ${paymentMethod} Transaction ID (TrxID).`
      );
      return;
    }

    setSubmitting(true);
    try {
      const order = await onPlaceOrder({
        customerName: customerName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        district,
        area: area.trim(),
        fullAddress: fullAddress.trim(),
        deliveryZone,
        paymentMethod,
        trxId: trxId.trim(),
        couponCode: appliedCoupon?.code || '',
        discountAmount,
        deliveryFee,
        subtotal,
        total,
      });

      setConfirmedOrder(order);
      setStep('confirmed');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to place order.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseDrawer = () => {
    if (step === 'confirmed') {
      setStep('bag');
      setConfirmedOrder(null);
      setAppliedCoupon(null);
      setCouponInput('');
      setTrxId('');
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs">
      <div
        className="w-full max-w-lg bg-[#FFFFFF] dark:bg-[#16181D] h-full flex flex-col border-l border-[#E5E2DC] dark:border-[#262930] shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Shopping Bag"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E2DC] dark:border-[#262930]">
          <div className="flex items-center gap-3">
            {step === 'checkout' && (
              <button
                type="button"
                onClick={() => setStep('bag')}
                className="p-1.5 rounded-md hover:bg-[#F2F0EC] dark:hover:bg-[#22252D]"
                aria-label="Back to bag"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <h2 className="text-base font-semibold text-[#141413] dark:text-[#F3F2EF]">
              {step === 'bag' && (lang === 'bn' ? `আপনার ব্যাগ (${detailedItems.length})` : `Shopping Bag (${detailedItems.length})`)}
              {step === 'checkout' && (lang === 'bn' ? 'চেকআউট ও ডেলিভারি' : 'Checkout & Delivery')}
              {step === 'confirmed' && (lang === 'bn' ? 'অর্ডার কনফার্মড' : 'Order Confirmed')}
            </h2>
          </div>
          <button
            type="button"
            onClick={handleCloseDrawer}
            className="p-2 rounded-lg text-[#6B6964] hover:text-[#141413] dark:text-[#9CA0A6] dark:hover:text-white hover:bg-[#F2F0EC] dark:hover:bg-[#22252D]"
            aria-label="Close bag"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {step === 'confirmed' && confirmedOrder ? (
            <div className="space-y-6">
              <div className="p-5 rounded-xl bg-[#0F6E56]/8 border border-[#0F6E56]/25">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-[#0F6E56] dark:text-[#34D399] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-mono uppercase tracking-wider text-[#0F6E56] dark:text-[#34D399]">
                      {lang === 'bn'
                        ? `অর্ডার ${confirmedOrder.orderId} কনফার্মড`
                        : `Order ${confirmedOrder.orderId} Confirmed`}
                    </p>
                    <h3 className="text-lg font-semibold text-[#141413] dark:text-[#F3F2EF] mt-1">
                      {lang === 'bn'
                        ? 'আপনার অর্ডার সফলভাবে গ্রহণ করা হয়েছে!'
                        : 'Thank you! Your order is received.'}
                    </h3>
                    <p className="text-sm text-[#4A4945] dark:text-[#C8C6C0] mt-1">
                      {confirmedOrder.paymentMethod === 'COD'
                        ? lang === 'bn'
                          ? 'ডেলিভারি নিশ্চিত করতে আমাদের টিম শীঘ্রই কল করবে।'
                          : 'Our Banani team will call to confirm dispatch shortly.'
                        : lang === 'bn'
                        ? `${confirmedOrder.paymentMethod} TrxID (${confirmedOrder.trxId}) যাচাইয়ের অপেক্ষায় আছে।`
                        : `Pending ${confirmedOrder.paymentMethod} TrxID (${confirmedOrder.trxId}) verification.`}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3 text-sm border border-[#E5E2DC] dark:border-[#262930] rounded-xl p-5">
                <div className="flex justify-between">
                  <span className="text-[#6B6964] dark:text-[#9CA0A6]">
                    {lang === 'bn' ? 'ক্রেতা' : 'Customer'}
                  </span>
                  <span className="font-medium">{confirmedOrder.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6B6964] dark:text-[#9CA0A6]">
                    {lang === 'bn' ? 'মোবাইল' : 'Phone'}
                  </span>
                  <span className="font-mono tabular-nums">{confirmedOrder.phone}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-[#6B6964] dark:text-[#9CA0A6]">
                    {lang === 'bn' ? 'ঠিকানা' : 'Address'}
                  </span>
                  <span className="text-right">
                    {confirmedOrder.fullAddress}, {confirmedOrder.area}, {confirmedOrder.district}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6B6964] dark:text-[#9CA0A6]">
                    {lang === 'bn' ? 'পেমেন্ট' : 'Payment'}
                  </span>
                  <span className="font-medium">
                    {confirmedOrder.paymentMethod} ({confirmedOrder.paymentStatus})
                  </span>
                </div>
                <div className="pt-3 border-t border-[#E5E2DC] dark:border-[#262930] flex justify-between font-semibold text-base">
                  <span>{lang === 'bn' ? 'সর্বমোট বিল' : 'Total Payable'}</span>
                  <span className="font-mono tabular-nums">{formatBDT(confirmedOrder.total)}</span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex-1 py-2.5 px-4 rounded-lg border border-[#E5E2DC] dark:border-[#2E323B] text-sm font-medium flex items-center justify-center gap-2 hover:bg-[#F2F0EC] dark:hover:bg-[#22252D]"
                >
                  <Printer className="w-4 h-4" />
                  {lang === 'bn' ? 'রিসিট প্রিন্ট' : 'Print Receipt'}
                </button>
                <button
                  type="button"
                  onClick={handleCloseDrawer}
                  className="flex-1 py-2.5 px-4 rounded-lg bg-[#0F6E56] text-white text-sm font-semibold hover:bg-[#0C5945]"
                >
                  {lang === 'bn' ? 'আরও শপিং করুন' : 'Continue Shopping'}
                </button>
              </div>
            </div>
          ) : detailedItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-16">
              <p className="text-base font-medium text-[#141413] dark:text-[#F3F2EF]">
                {lang === 'bn' ? 'আপনার ব্যাগ এখনো খালি' : 'Your shopping bag is empty'}
              </p>
              <p className="text-sm text-[#6B6964] dark:text-[#9CA0A6] mt-1 max-w-xs">
                {lang === 'bn'
                  ? 'কালেকশন থেকে পছন্দের পণ্য যোগ করুন। ৳৫,০০০+ অর্ডারে ফ্রি ডেলিভারি!'
                  : 'Explore our curated essentials. Orders over ৳5,000 ship free across Bangladesh.'}
              </p>
              <button
                type="button"
                onClick={handleCloseDrawer}
                className="mt-6 px-5 py-2.5 rounded-lg bg-[#0F6E56] text-white text-sm font-semibold hover:bg-[#0C5945]"
              >
                {lang === 'bn' ? 'শপিং শুরু করুন' : 'Browse Collection'}
              </button>
            </div>
          ) : step === 'bag' ? (
            <div className="space-y-6">
              <div className="divide-y divide-[#E5E2DC] dark:divide-[#262930]">
                {detailedItems.map((item) => (
                  <div
                    key={`${item.productId}-${item.variant}`}
                    className="py-4 first:pt-0 flex gap-4"
                  >
                    <div className="w-20 h-20 rounded-lg overflow-hidden bg-[#F2F0EC] dark:bg-[#1D2026] border border-[#E5E2DC] dark:border-[#262930] shrink-0">
                      <ProductImage
                        src={item.product.image}
                        alt={item.product.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between gap-2">
                        <h3 className="text-sm font-medium text-[#141413] dark:text-[#F3F2EF] truncate">
                          {item.product.name}
                        </h3>
                        <button
                          type="button"
                          onClick={() => onRemoveItem(item.productId, item.variant)}
                          className="text-[#6B6964] hover:text-[#DC2626] p-1"
                          aria-label="Remove item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-xs text-[#6B6964] dark:text-[#9CA0A6] mt-0.5">
                        {item.variant} · {item.product.sku}
                      </p>
                      <div className="mt-3 flex items-center justify-between">
                        <div className="flex items-center border border-[#E5E2DC] dark:border-[#2E323B] rounded-md">
                          <button
                            type="button"
                            onClick={() => onUpdateQty(item.productId, item.variant, -1)}
                            className="p-1.5 hover:bg-[#F2F0EC] dark:hover:bg-[#22252D]"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="px-2.5 text-xs font-mono tabular-nums">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => onUpdateQty(item.productId, item.variant, 1)}
                            className="p-1.5 hover:bg-[#F2F0EC] dark:hover:bg-[#22252D]"
                            aria-label="Increase quantity"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <span className="text-sm font-semibold font-mono tabular-nums">
                          {formatBDT(item.unitPrice * item.quantity)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-[#E5E2DC] dark:border-[#262930] space-y-3">
                <label className="block text-xs font-medium text-[#6B6964] dark:text-[#9CA0A6]">
                  {lang === 'bn' ? 'প্রোমো কোড (যেমন: WELCOME10)' : 'Promo Code (try WELCOME10)'}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value)}
                    placeholder="WELCOME10"
                    className="flex-1 px-3.5 py-2 text-sm uppercase font-mono rounded-lg border border-[#E5E2DC] dark:border-[#2E323B] bg-[#F9F8F6] dark:bg-[#1D2026] focus:outline-none focus:border-[#0F6E56]"
                  />
                  <button
                    type="button"
                    onClick={handleApplyCoupon}
                    className="px-4 py-2 rounded-lg border border-[#E5E2DC] dark:border-[#2E323B] text-xs font-semibold hover:bg-[#F2F0EC] dark:hover:bg-[#22252D]"
                  >
                    {lang === 'bn' ? 'প্রয়োগ করুন' : 'Apply'}
                  </button>
                </div>
                {couponError && <p className="text-xs text-[#DC2626]">{couponError}</p>}
                {appliedCoupon && (
                  <p className="text-xs text-[#0F6E56] dark:text-[#34D399]">
                    {lang === 'bn'
                      ? `${appliedCoupon.code} কোড চালু হয়েছে (${appliedCoupon.discountPercent}% ছাড়)`
                      : `Code ${appliedCoupon.code} applied (${appliedCoupon.discountPercent}% off)`}
                  </p>
                )}
              </div>

              <div className="pt-4 border-t border-[#E5E2DC] dark:border-[#262930] space-y-2">
                <span className="block text-xs font-medium text-[#6B6964] dark:text-[#9CA0A6]">
                  {lang === 'bn' ? 'ডেলিভারি এলাকা' : 'Delivery Zone'}
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDeliveryZone('dhaka');
                      setDistrict('Dhaka');
                    }}
                    className={`py-2 px-3 rounded-lg border text-xs font-medium transition-colors ${
                      deliveryZone === 'dhaka'
                        ? 'bg-[#0F6E56] text-white border-[#0F6E56]'
                        : 'border-[#E5E2DC] dark:border-[#2E323B] hover:border-[#0F6E56]'
                    }`}
                  >
                    {lang === 'bn'
                      ? `ঢাকার ভেতরে (${formatBDT(settings.delivery_charge_dhaka)})`
                      : `Inside Dhaka (${formatBDT(settings.delivery_charge_dhaka)})`}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDeliveryZone('outside');
                      if (district === 'Dhaka') setDistrict('Chattogram');
                    }}
                    className={`py-2 px-3 rounded-lg border text-xs font-medium transition-colors ${
                      deliveryZone === 'outside'
                        ? 'bg-[#0F6E56] text-white border-[#0F6E56]'
                        : 'border-[#E5E2DC] dark:border-[#2E323B] hover:border-[#0F6E56]'
                    }`}
                  >
                    {lang === 'bn'
                      ? `ঢাকার বাইরে (${formatBDT(settings.delivery_charge_outside)})`
                      : `Outside Dhaka (${formatBDT(settings.delivery_charge_outside)})`}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <form id="checkout-form" onSubmit={handleCheckoutSubmit} className="space-y-4">
              {formError && (
                <div className="p-3 rounded-lg bg-[#DC2626]/10 border border-[#DC2626]/30 text-xs text-[#DC2626]">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium mb-1">
                  {lang === 'bn' ? 'পুরো নাম *' : 'Full Name *'}
                </label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder={lang === 'bn' ? 'যেমন: তানভীর আহমেদ' : 'e.g. Tanvir Ahmed'}
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-[#E5E2DC] dark:border-[#2E323B] bg-[#F9F8F6] dark:bg-[#1D2026] focus:outline-none focus:border-[#0F6E56]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">
                    {lang === 'bn' ? 'মোবাইল নম্বর *' : 'Mobile Number *'}
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="017XXXXXXXX"
                    className="w-full px-3.5 py-2 text-sm font-mono rounded-lg border border-[#E5E2DC] dark:border-[#2E323B] bg-[#F9F8F6] dark:bg-[#1D2026] focus:outline-none focus:border-[#0F6E56]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">
                    {lang === 'bn' ? 'ইমেইল (ঐচ্ছিক)' : 'Email (optional)'}
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-3.5 py-2 text-sm rounded-lg border border-[#E5E2DC] dark:border-[#2E323B] bg-[#F9F8F6] dark:bg-[#1D2026] focus:outline-none focus:border-[#0F6E56]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">
                    {lang === 'bn' ? 'জেলা *' : 'District *'}
                  </label>
                  <select
                    value={district}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDistrict(val);
                      setDeliveryZone(val === 'Dhaka' ? 'dhaka' : 'outside');
                    }}
                    className="w-full px-3.5 py-2 text-sm rounded-lg border border-[#E5E2DC] dark:border-[#2E323B] bg-[#F9F8F6] dark:bg-[#1D2026] focus:outline-none focus:border-[#0F6E56]"
                  >
                    {BD_DISTRICTS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">
                    {lang === 'bn' ? 'এলাকা / থানা *' : 'Area / Thana *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    placeholder={lang === 'bn' ? 'যেমন: বনানী, উত্তরা' : 'e.g. Banani, Uttara'}
                    className="w-full px-3.5 py-2 text-sm rounded-lg border border-[#E5E2DC] dark:border-[#2E323B] bg-[#F9F8F6] dark:bg-[#1D2026] focus:outline-none focus:border-[#0F6E56]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">
                  {lang === 'bn' ? 'সম্পূর্ণ ঠিকানা *' : 'Full Street Address *'}
                </label>
                <textarea
                  required
                  rows={2}
                  value={fullAddress}
                  onChange={(e) => setFullAddress(e.target.value)}
                  placeholder={lang === 'bn' ? 'বাসা, রোড, ব্লক / ফ্ল্যাট নম্বর' : 'House, Road, Block / Apartment'}
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-[#E5E2DC] dark:border-[#2E323B] bg-[#F9F8F6] dark:bg-[#1D2026] focus:outline-none focus:border-[#0F6E56]"
                />
              </div>

              <div className="pt-2 space-y-2.5">
                <label className="block text-xs font-medium">
                  {lang === 'bn' ? 'পেমেন্ট মাধ্যম' : 'Payment Method'}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['COD', 'bKash', 'Nagad'] as PaymentMethod[]).map((method) => {
                    if (method === 'COD' && !settings.cod_enabled) return null;
                    const label =
                      lang === 'bn'
                        ? method === 'COD'
                          ? 'ক্যাশ অন ডেলিভারি'
                          : method === 'bKash'
                          ? 'বিকাশ'
                          : 'নগদ'
                        : method === 'COD'
                        ? 'Cash on Delivery'
                        : method;
                    return (
                      <button
                        key={method}
                        type="button"
                        onClick={() => setPaymentMethod(method)}
                        className={`py-2.5 px-3 rounded-lg border text-xs font-semibold transition-colors ${
                          paymentMethod === method
                            ? 'bg-[#0F6E56] text-white border-[#0F6E56]'
                            : 'border-[#E5E2DC] dark:border-[#2E323B] hover:border-[#0F6E56]'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                {(paymentMethod === 'bKash' || paymentMethod === 'Nagad') && (
                  <div className="p-3.5 rounded-lg bg-[#F2F0EC] dark:bg-[#1D2026] border border-[#E5E2DC] dark:border-[#2E323B] space-y-2.5">
                    <p className="text-xs leading-relaxed text-[#4A4945] dark:text-[#C8C6C0]">
                      {lang === 'bn' ? (
                        <>
                          আমাদের {paymentMethod === 'bKash' ? 'বিকাশ' : 'নগদ'} পার্সোনাল নম্বরে{' '}
                          <strong className="font-mono text-[#141413] dark:text-white">
                            {paymentMethod === 'bKash' ? settings.bkash_number : settings.nagad_number}
                          </strong>{' '}
                          মোট <strong className="font-mono">{formatBDT(total)}</strong> Send Money করে নিচে Transaction ID দিন।
                        </>
                      ) : (
                        <>
                          Send Money <strong className="font-mono">{formatBDT(total)}</strong> to our{' '}
                          {paymentMethod} Personal number:{' '}
                          <strong className="font-mono text-[#141413] dark:text-white">
                            {paymentMethod === 'bKash' ? settings.bkash_number : settings.nagad_number}
                          </strong>
                          , then enter the Transaction ID below.
                        </>
                      )}
                    </p>
                    <input
                      type="text"
                      required
                      value={trxId}
                      onChange={(e) => setTrxId(e.target.value)}
                      placeholder={`${paymentMethod} Transaction ID (যেমন: BL74K90X12)`}
                      className="w-full px-3.5 py-2 text-sm font-mono uppercase rounded-lg border border-[#E5E2DC] dark:border-[#2E323B] bg-white dark:bg-[#16181D] focus:outline-none focus:border-[#0F6E56]"
                    />
                  </div>
                )}
              </div>
            </form>
          )}
        </div>

        {detailedItems.length > 0 && step !== 'confirmed' && (
          <div className="p-6 border-t border-[#E5E2DC] dark:border-[#262930] bg-[#F9F8F6] dark:bg-[#121419] space-y-3">
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-[#6B6964] dark:text-[#9CA0A6]">
                <span>{lang === 'bn' ? 'সাবটোটাল' : 'Subtotal'}</span>
                <span className="font-mono tabular-nums">{formatBDT(subtotal)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-[#0F6E56] dark:text-[#34D399]">
                  <span>
                    {lang === 'bn'
                      ? `ডিসকাউন্ট (${appliedCoupon?.code})`
                      : `Discount (${appliedCoupon?.code})`}
                  </span>
                  <span className="font-mono tabular-nums">-{formatBDT(discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-[#6B6964] dark:text-[#9CA0A6]">
                <span>
                  {lang === 'bn'
                    ? `ডেলিভারি (${deliveryZone === 'dhaka' ? 'ঢাকা' : 'সারা দেশ'})`
                    : `Delivery (${deliveryZone === 'dhaka' ? 'Dhaka' : 'Nationwide'})`}
                </span>
                <span className="font-mono tabular-nums">
                  {deliveryFee === 0 ? (lang === 'bn' ? 'ফ্রি' : 'Free') : formatBDT(deliveryFee)}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-[#E5E2DC] dark:border-[#262930] font-semibold text-base text-[#141413] dark:text-[#F3F2EF]">
                <span>{lang === 'bn' ? 'সর্বমোট' : 'Total'}</span>
                <span className="font-mono tabular-nums">{formatBDT(total)}</span>
              </div>
            </div>

            {step === 'bag' ? (
              <button
                type="button"
                onClick={() => setStep('checkout')}
                className="w-full py-3 px-5 rounded-lg bg-[#0F6E56] hover:bg-[#0C5945] text-white text-sm font-semibold transition-colors"
              >
                {lang === 'bn' ? 'চেকআউট করুন' : 'Proceed to Checkout'}
              </button>
            ) : (
              <button
                type="submit"
                form="checkout-form"
                disabled={submitting}
                className="w-full py-3 px-5 rounded-lg bg-[#0F6E56] hover:bg-[#0C5945] text-white text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {submitting
                  ? lang === 'bn'
                    ? 'অর্ডার প্রসেস হচ্ছে...'
                    : 'Placing Order...'
                  : lang === 'bn'
                  ? `অর্ডার কনফার্ম করুন (${formatBDT(total)})`
                  : `Place Order (${formatBDT(total)})`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
