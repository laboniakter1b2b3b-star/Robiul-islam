import { useState, FormEvent } from 'react';
import { X, Minus, Plus, Star, ShieldCheck, Truck, Check, ExternalLink } from 'lucide-react';
import { Language, Product, ProductReview, StoreSettings } from '../types';
import {
  formatBDT,
  getDiscountPercent,
  getEffectivePrice,
  isSafeExternalUrl,
} from '../data/storeData';
import { ProductImage } from './ProductImage';

interface ProductDetailModalProps {
  product: Product | null;
  reviews: ProductReview[];
  settings: StoreSettings;
  lang: Language;
  onClose: () => void;
  onAddToCart: (product: Product, variant: string, quantity: number, openDrawer?: boolean) => void;
  onAddReview: (productId: number, author: string, rating: number, comment: string) => void;
}

export function ProductDetailModal({
  product,
  reviews,
  settings,
  lang,
  onClose,
  onAddToCart,
  onAddReview,
}: ProductDetailModalProps) {
  const [selectedVariant, setSelectedVariant] = useState<string>('');
  const [quantity, setQuantity] = useState(1);
  const [addedFeedback, setAddedFeedback] = useState(false);
  const [reviewName, setReviewName] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');

  if (!product) return null;

  const activeVariant =
    selectedVariant && product.variants.includes(selectedVariant)
      ? selectedVariant
      : product.variants[0] || 'Standard';

  const effectivePrice = getEffectivePrice(product);
  const discountPct = getDiscountPercent(product);
  const productReviews = reviews.filter((r) => r.productId === product.id);
  const safeAffiliateUrl =
    product.productType === 'affiliate' ? isSafeExternalUrl(product.affiliateUrl) : null;
  const isAffiliate = Boolean(safeAffiliateUrl);

  const handleAdd = (buyNow = false) => {
    if (isAffiliate || product.stock <= 0) return;
    onAddToCart(product, activeVariant, quantity, buyNow);
    if (!buyNow) {
      setAddedFeedback(true);
      setTimeout(() => setAddedFeedback(false), 1800);
    } else {
      onClose();
    }
  };

  const handleReviewSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!reviewName.trim() || !reviewComment.trim()) return;
    onAddReview(product.id, reviewName.trim(), reviewRating, reviewComment.trim());
    setReviewName('');
    setReviewComment('');
    setReviewRating(5);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-xs p-4 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={product.name}
    >
      <div className="relative w-full max-w-4xl bg-[#FFFFFF] dark:bg-[#16181D] border border-[#E5E2DC] dark:border-[#262930] rounded-xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E2DC] dark:border-[#262930]">
          <div className="flex items-center gap-2 text-xs text-[#6B6964] dark:text-[#9CA0A6] font-mono tabular-nums">
            <span>{product.category}</span>
            <span aria-hidden="true">·</span>
            <span>{product.subcategory}</span>
            <span aria-hidden="true">·</span>
            <span>{product.sku}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-[#6B6964] hover:text-[#141413] dark:text-[#9CA0A6] dark:hover:text-white hover:bg-[#F2F0EC] dark:hover:bg-[#22252D] transition-colors"
            aria-label="Close product details"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-6 sm:p-8 space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            <div className="aspect-[4/3] w-full rounded-lg overflow-hidden bg-[#F2F0EC] dark:bg-[#1D2026] border border-[#E5E2DC] dark:border-[#262930]">
              <ProductImage
                src={product.image}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            </div>

            <div className="space-y-5">
              <div>
                <p className="text-xs font-medium tracking-wider uppercase text-[#6B6964] dark:text-[#9CA0A6]">
                  {product.brand} · {product.code}
                </p>
                <h2 className="mt-1.5 text-2xl font-semibold text-[#141413] dark:text-[#F3F2EF] text-balance">
                  {product.name}
                </h2>
              </div>

              <div className="flex items-baseline gap-3">
                <span className="text-2xl font-semibold font-mono tabular-nums text-[#141413] dark:text-[#F3F2EF]">
                  {formatBDT(effectivePrice)}
                </span>
                {discountPct !== null && (
                  <>
                    <span className="text-base font-mono tabular-nums line-through text-[#6B6964] dark:text-[#9CA0A6]">
                      {formatBDT(product.regularPrice)}
                    </span>
                    <span className="text-xs font-medium text-[#0F6E56] dark:text-[#34D399]">
                      {lang === 'bn' ? `${discountPct}% ছাড়` : `Save ${discountPct}%`}
                    </span>
                  </>
                )}
              </div>

              <p className="text-sm leading-relaxed text-[#4A4945] dark:text-[#C8C6C0]">
                {product.description}
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-3 border-y border-[#E5E2DC] dark:border-[#262930] text-xs">
                <div>
                  <span className="block text-[#6B6964] dark:text-[#9CA0A6]">
                    {isAffiliate
                      ? lang === 'bn'
                        ? 'অর্ডার মাধ্যম'
                        : 'Fulfillment'
                      : lang === 'bn'
                      ? 'স্টক'
                      : 'Availability'}
                  </span>
                  <span className="mt-0.5 block font-medium font-mono tabular-nums text-[#141413] dark:text-[#F3F2EF]">
                    {isAffiliate
                      ? lang === 'bn'
                        ? 'পার্টনার ওয়েবসাইট'
                        : 'External Partner'
                      : product.stock > 0
                      ? lang === 'bn'
                        ? `${product.stock} টি`
                        : `${product.stock} units`
                      : lang === 'bn'
                      ? 'স্টক শেষ'
                      : 'Out of stock'}
                  </span>
                </div>
                <div>
                  <span className="block text-[#6B6964] dark:text-[#9CA0A6]">
                    {lang === 'bn' ? 'ওজন' : 'Weight'}
                  </span>
                  <span className="mt-0.5 block font-medium text-[#141413] dark:text-[#F3F2EF]">
                    {product.weight || (lang === 'bn' ? 'স্ট্যান্ডার্ড' : 'Standard')}
                  </span>
                </div>
                <div>
                  <span className="block text-[#6B6964] dark:text-[#9CA0A6]">
                    {lang === 'bn' ? 'ওয়ারেন্টি' : 'Coverage'}
                  </span>
                  <span className="mt-0.5 block font-medium text-[#141413] dark:text-[#F3F2EF]">
                    {product.warranty || (lang === 'bn' ? '৭ দিনের রিটার্ন' : '7-Day Return')}
                  </span>
                </div>
                <div>
                  <span className="block text-[#6B6964] dark:text-[#9CA0A6]">
                    {lang === 'bn' ? 'পিস তথ্য' : 'Pieces Info'}
                  </span>
                  <span className="mt-0.5 block font-medium text-[#141413] dark:text-[#F3F2EF]">
                    {product.piecesInfo || (lang === 'bn' ? '১ পিস' : '1 pc')}
                  </span>
                </div>
              </div>

              {product.variants.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-[#6B6964] dark:text-[#9CA0A6] mb-2">
                    {lang === 'bn' ? 'ভ্যারিয়েন্ট নির্বাচন করুন' : 'Select Option'}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {product.variants.map((variant) => {
                      const isActive = activeVariant === variant;
                      return (
                        <button
                          key={variant}
                          type="button"
                          onClick={() => setSelectedVariant(variant)}
                          className={`px-3.5 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                            isActive
                              ? 'bg-[#0F6E56] text-white border-[#0F6E56]'
                              : 'bg-[#F9F8F6] dark:bg-[#1D2026] text-[#141413] dark:text-[#F3F2EF] border-[#E5E2DC] dark:border-[#2E323B] hover:border-[#0F6E56]'
                          }`}
                        >
                          {variant}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {safeAffiliateUrl ? (
                <div className="space-y-3 pt-1">
                  <a
                    href={safeAffiliateUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 px-5 rounded-lg bg-[#0F6E56] hover:bg-[#0C5945] text-white text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2"
                  >
                    <span>Buy Now</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  <p className="text-xs text-[#6B6964] dark:text-[#9CA0A6]">
                    {lang === 'bn'
                      ? 'Buy Now বাটনে ক্লিক করলে পার্টনার ওয়েবসাইটে নিয়ে যাবে—সেখান থেকেই সরাসরি অর্ডার ও পেমেন্ট সম্পন্ন হবে।'
                      : 'Clicking Buy Now redirects directly to the partner website to complete your purchase.'}
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <div className="flex items-center border border-[#E5E2DC] dark:border-[#2E323B] rounded-lg bg-[#F9F8F6] dark:bg-[#1D2026]">
                      <button
                        type="button"
                        onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                        className="p-2.5 text-[#4A4945] dark:text-[#C8C6C0] hover:text-[#141413] dark:hover:text-white"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-9 text-center text-sm font-mono tabular-nums font-medium">
                        {quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => setQuantity((q) => Math.min(Math.max(1, product.stock), q + 1))}
                        className="p-2.5 text-[#4A4945] dark:text-[#C8C6C0] hover:text-[#141413] dark:hover:text-white"
                        aria-label="Increase quantity"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>

                    <button
                      type="button"
                      disabled={product.stock <= 0}
                      onClick={() => handleAdd(false)}
                      className="flex-1 min-w-[140px] py-2.5 px-5 rounded-lg border border-[#0F6E56] text-[#0F6E56] dark:text-[#34D399] dark:border-[#34D399]/60 text-sm font-semibold hover:bg-[#0F6E56]/8 transition-colors disabled:opacity-40 whitespace-nowrap shrink-0 flex items-center justify-center gap-2"
                    >
                      {addedFeedback ? (
                        <>
                          <Check className="w-4 h-4" />
                          {lang === 'bn' ? 'ব্যাগে যোগ হয়েছে' : 'Added to Bag'}
                        </>
                      ) : lang === 'bn' ? (
                        'ব্যাগে যোগ করুন'
                      ) : (
                        'Add to Bag'
                      )}
                    </button>

                    <button
                      type="button"
                      disabled={product.stock <= 0}
                      onClick={() => handleAdd(true)}
                      className="flex-1 min-w-[140px] py-2.5 px-5 rounded-lg bg-[#0F6E56] hover:bg-[#0C5945] text-white text-sm font-semibold transition-colors disabled:opacity-40 whitespace-nowrap shrink-0"
                    >
                      {lang === 'bn' ? 'এখনই অর্ডার করুন' : 'Buy Now'}
                    </button>
                  </div>

                  <div className="pt-2 space-y-2 text-xs text-[#6B6964] dark:text-[#9CA0A6]">
                    <div className="flex items-center gap-2">
                      <Truck className="w-4 h-4 text-[#0F6E56] dark:text-[#34D399] shrink-0" />
                      <span>
                        {lang === 'bn'
                          ? `ঢাকার ভেতরে ${formatBDT(settings.delivery_charge_dhaka)} · ঢাকার বাইরে ${formatBDT(settings.delivery_charge_outside)} · ${formatBDT(settings.free_delivery_threshold)}+ অর্ডারে ফ্রি ডেলিভারি`
                          : `Inside Dhaka ${formatBDT(settings.delivery_charge_dhaka)} · Outside Dhaka ${formatBDT(settings.delivery_charge_outside)} · Free over ${formatBDT(settings.free_delivery_threshold)}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-[#0F6E56] dark:text-[#34D399] shrink-0" />
                      <span>
                        {lang === 'bn'
                          ? 'বিকাশ, নগদ ও ক্যাশ অন ডেলিভারি সুবিধা'
                          : 'bKash, Nagad & Cash on Delivery verified in Dhaka'}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="pt-6 border-t border-[#E5E2DC] dark:border-[#262930] grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-base font-semibold text-[#141413] dark:text-[#F3F2EF] mb-4">
                {lang === 'bn' ? 'ক্রেতাদের রিভিউ' : 'Customer Reviews'} ({productReviews.length})
              </h3>
              {productReviews.length === 0 ? (
                <p className="text-sm text-[#6B6964] dark:text-[#9CA0A6]">
                  {lang === 'bn'
                    ? 'এখনো কোনো রিভিউ নেই। প্রথম রিভিউটি আপনিই দিন।'
                    : 'No reviews yet for this item. Share your experience.'}
                </p>
              ) : (
                <div className="space-y-4">
                  {productReviews.map((review) => (
                    <div
                      key={review.id}
                      className="pb-4 border-b border-[#E5E2DC] dark:border-[#262930] last:border-b-0"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-[#141413] dark:text-[#F3F2EF]">
                          {review.author}
                        </span>
                        <span className="text-xs font-mono text-[#6B6964] dark:text-[#9CA0A6]">
                          {review.date}
                        </span>
                      </div>
                      <div className="flex items-center gap-0.5 my-1 text-[#D97706]">
                        {Array.from({ length: review.rating }).map((_, idx) => (
                          <Star key={idx} className="w-3.5 h-3.5 fill-current" />
                        ))}
                      </div>
                      <p className="text-sm text-[#4A4945] dark:text-[#C8C6C0]">{review.comment}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <form onSubmit={handleReviewSubmit} className="space-y-3">
              <h3 className="text-base font-semibold text-[#141413] dark:text-[#F3F2EF]">
                {lang === 'bn' ? 'রিভিউ লিখুন' : 'Write a Review'}
              </h3>
              <input
                type="text"
                required
                value={reviewName}
                onChange={(e) => setReviewName(e.target.value)}
                placeholder={lang === 'bn' ? 'আপনার নাম ও এলাকা' : 'Your name & district'}
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-[#E5E2DC] dark:border-[#2E323B] bg-[#F9F8F6] dark:bg-[#1D2026] text-[#141413] dark:text-[#F3F2EF] focus:outline-none focus:border-[#0F6E56]"
              />
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#6B6964] dark:text-[#9CA0A6]">
                  {lang === 'bn' ? 'রেটিং:' : 'Rating:'}
                </span>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setReviewRating(star)}
                    className={`p-1 ${star <= reviewRating ? 'text-[#D97706]' : 'text-[#C8C6C0]'}`}
                    aria-label={`Rate ${star} stars`}
                  >
                    <Star className="w-4 h-4 fill-current" />
                  </button>
                ))}
              </div>
              <textarea
                required
                rows={3}
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder={lang === 'bn' ? 'পণ্যটি কেমন লেগেছে লিখুন...' : 'Share fit, finish, or delivery feedback...'}
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-[#E5E2DC] dark:border-[#2E323B] bg-[#F9F8F6] dark:bg-[#1D2026] text-[#141413] dark:text-[#F3F2EF] focus:outline-none focus:border-[#0F6E56]"
              />
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#141413] dark:bg-[#F3F2EF] text-white dark:text-[#141413] hover:opacity-90 transition-opacity"
              >
                {lang === 'bn' ? 'রিভিউ জমা দিন' : 'Submit Review'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
