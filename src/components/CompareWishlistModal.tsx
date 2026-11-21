import { X, Heart, GitCompareArrows, Trash2, ShoppingBag, ExternalLink } from 'lucide-react';
import { Language, Product } from '../types';
import {
  CATEGORY_LABELS_BN,
  formatBDT,
  getEffectivePrice,
  isSafeExternalUrl,
} from '../data/storeData';
import { ProductImage } from './ProductImage';

interface WishlistModalProps {
  isOpen: boolean;
  products: Product[];
  wishlistIds: number[];
  lang: Language;
  onClose: () => void;
  onToggleWishlist: (productId: number) => void;
  onAddToCart: (product: Product, variant: string, quantity: number, openDrawer?: boolean) => void;
  onSelectProduct: (product: Product) => void;
}

export function WishlistModal({
  isOpen,
  products,
  wishlistIds,
  lang,
  onClose,
  onToggleWishlist,
  onAddToCart,
  onSelectProduct,
}: WishlistModalProps) {
  if (!isOpen) return null;
  const saved = products.filter((p) => wishlistIds.includes(p.id));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-label={lang === 'bn' ? 'পছন্দের তালিকা' : 'Wishlist'}
    >
      <div className="w-full max-w-xl bg-[#FFFFFF] dark:bg-[#16181D] border border-[#E5E2DC] dark:border-[#262930] rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E2DC] dark:border-[#262930]">
          <div className="flex items-center gap-2">
            <Heart className="w-4 h-4 text-[#0F6E56] dark:text-[#34D399]" />
            <h2 className="text-base font-semibold text-[#141413] dark:text-[#F3F2EF]">
              {lang === 'bn' ? 'আমার পছন্দের তালিকা' : 'Saved Wishlist'} ({saved.length})
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-[#6B6964] hover:text-[#141413] dark:text-[#9CA0A6] dark:hover:text-white"
            aria-label="Close wishlist"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 max-h-[75vh] overflow-y-auto space-y-3">
          {saved.length === 0 ? (
            <div className="py-12 text-center border border-dashed border-[#E5E2DC] dark:border-[#2E323B] rounded-xl">
              <Heart className="w-8 h-8 mx-auto text-[#6B6964] opacity-60 mb-2" />
              <p className="text-sm font-medium text-[#141413] dark:text-[#F3F2EF]">
                {lang === 'bn'
                  ? 'আপনার পছন্দের তালিকায় এখনো কোনো পণ্য নেই।'
                  : 'Your wishlist is currently empty.'}
              </p>
              <p className="text-xs text-[#6B6964] dark:text-[#9CA0A6] mt-1">
                {lang === 'bn'
                  ? 'যেকোনো পণ্যের হার্ট আইকনে ট্যাপ করে সংরক্ষণ করুন — কোনো অ্যাকাউন্ট লাগবে না।'
                  : 'Tap the heart button on any product to save it for later—no account required.'}
              </p>
            </div>
          ) : (
            saved.map((product) => (
              <div
                key={product.id}
                className="flex items-center gap-4 p-3 rounded-xl border border-[#E5E2DC] dark:border-[#262930] bg-[#F9F8F6] dark:bg-[#1D2026]"
              >
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onSelectProduct(product);
                  }}
                  className="w-16 h-16 rounded-lg overflow-hidden shrink-0 bg-[#EFECE6]"
                >
                  <ProductImage
                    src={product.image}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                </button>
                <div className="flex-1 min-w-0">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onSelectProduct(product);
                    }}
                    className="text-sm font-semibold truncate block text-left w-full hover:text-[#0F6E56]"
                  >
                    {product.name}
                  </button>
                  <p className="text-xs text-[#6B6964] dark:text-[#9CA0A6] mt-0.5">
                    {product.brand} · {formatBDT(getEffectivePrice(product))}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {product.productType === 'affiliate' && isSafeExternalUrl(product.affiliateUrl) ? (
                    <a
                      href={isSafeExternalUrl(product.affiliateUrl)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#0F6E56] text-white text-xs font-semibold hover:bg-[#0C5945]"
                    >
                      <span>Buy Now</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  ) : (
                    <button
                      type="button"
                      disabled={product.stock <= 0}
                      onClick={() => {
                        onAddToCart(product, product.variants[0] || 'Standard', 1, true);
                        onClose();
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#0F6E56] text-white text-xs font-semibold hover:bg-[#0C5945] disabled:opacity-40"
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      {lang === 'bn' ? 'কিনুন' : 'Bag'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onToggleWishlist(product.id)}
                    className="p-2 rounded-lg border border-[#E5E2DC] dark:border-[#2E323B] text-[#6B6964] hover:text-[#DC2626]"
                    aria-label="Remove from wishlist"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

interface CompareModalProps {
  isOpen: boolean;
  products: Product[];
  compareIds: number[];
  lang: Language;
  onClose: () => void;
  onRemoveCompare: (productId: number) => void;
  onAddToCart: (product: Product, variant: string, quantity: number, openDrawer?: boolean) => void;
}

export function CompareModal({
  isOpen,
  products,
  compareIds,
  lang,
  onClose,
  onRemoveCompare,
  onAddToCart,
}: CompareModalProps) {
  if (!isOpen) return null;
  const items = products.filter((p) => compareIds.includes(p.id));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-label={lang === 'bn' ? 'পণ্য তুলনা করুন' : 'Compare Products'}
    >
      <div className="w-full max-w-4xl bg-[#FFFFFF] dark:bg-[#16181D] border border-[#E5E2DC] dark:border-[#262930] rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E2DC] dark:border-[#262930]">
          <div className="flex items-center gap-2">
            <GitCompareArrows className="w-4 h-4 text-[#0F6E56] dark:text-[#34D399]" />
            <h2 className="text-base font-semibold text-[#141413] dark:text-[#F3F2EF]">
              {lang === 'bn' ? 'পণ্য তুলনা করুন' : 'Compare Products'} ({items.length}/3)
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-[#6B6964] hover:text-[#141413] dark:text-[#9CA0A6] dark:hover:text-white"
            aria-label="Close comparison"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 max-h-[80vh] overflow-auto">
          {items.length === 0 ? (
            <div className="py-12 text-center border border-dashed border-[#E5E2DC] dark:border-[#2E323B] rounded-xl">
              <GitCompareArrows className="w-8 h-8 mx-auto text-[#6B6964] opacity-60 mb-2" />
              <p className="text-sm font-medium text-[#141413] dark:text-[#F3F2EF]">
                {lang === 'bn'
                  ? 'তুলনা করার জন্য এখনো কোনো পণ্য বাছাই করা হয়নি।'
                  : 'No products selected for comparison yet.'}
              </p>
              <p className="text-xs text-[#6B6964] dark:text-[#9CA0A6] mt-1">
                {lang === 'bn'
                  ? 'পণ্যের কার্ডের "তুলনা" বাটনে ট্যাপ করে সর্বোচ্চ ৩টি পণ্য একসাথে তুলনা করুন।'
                  : 'Tap "Compare" on up to 3 product cards to view specifications side by side.'}
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-[#E5E2DC] dark:border-[#262930]">
                  <th className="py-3 pr-4 font-medium text-[#6B6964] dark:text-[#9CA0A6] w-32">
                    {lang === 'bn' ? 'বৈশিষ্ট্য' : 'Attribute'}
                  </th>
                  {items.map((item) => (
                    <th key={item.id} className="py-3 px-3 min-w-[180px] align-top">
                      <div className="space-y-2">
                        <div className="aspect-[4/3] rounded-lg overflow-hidden bg-[#EFECE6] dark:bg-[#1D2026]">
                          <ProductImage
                            src={item.image}
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-semibold text-[#141413] dark:text-[#F3F2EF] line-clamp-2">
                            {item.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => onRemoveCompare(item.id)}
                            className="text-[#6B6964] hover:text-[#DC2626] shrink-0"
                            aria-label="Remove from compare"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E2DC] dark:divide-[#262930]">
                <tr>
                  <td className="py-2.5 pr-4 text-[#6B6964] dark:text-[#9CA0A6]">
                    {lang === 'bn' ? 'মূল্য' : 'Price'}
                  </td>
                  {items.map((item) => (
                    <td key={item.id} className="py-2.5 px-3 font-mono font-semibold">
                      {formatBDT(getEffectivePrice(item))}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2.5 pr-4 text-[#6B6964] dark:text-[#9CA0A6]">
                    {lang === 'bn' ? 'ব্র্যান্ড' : 'Brand'}
                  </td>
                  {items.map((item) => (
                    <td key={item.id} className="py-2.5 px-3">{item.brand}</td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2.5 pr-4 text-[#6B6964] dark:text-[#9CA0A6]">
                    {lang === 'bn' ? 'ক্যাটাগরি' : 'Category'}
                  </td>
                  {items.map((item) => (
                    <td key={item.id} className="py-2.5 px-3">
                      {lang === 'bn' ? CATEGORY_LABELS_BN[item.category] || item.category : item.category}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2.5 pr-4 text-[#6B6964] dark:text-[#9CA0A6]">
                    {lang === 'bn' ? 'স্টক' : 'Stock'}
                  </td>
                  {items.map((item) => (
                    <td key={item.id} className="py-2.5 px-3 font-mono">
                      {item.stock > 0 ? `${item.stock} ${lang === 'bn' ? 'টি' : 'pcs'}` : '0'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2.5 pr-4 text-[#6B6964] dark:text-[#9CA0A6]">
                    {lang === 'bn' ? 'পিস / প্যাক' : 'Pack'}
                  </td>
                  {items.map((item) => (
                    <td key={item.id} className="py-2.5 px-3">{item.piecesInfo || '—'}</td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2.5 pr-4 text-[#6B6964] dark:text-[#9CA0A6]">
                    {lang === 'bn' ? 'ওজন' : 'Weight'}
                  </td>
                  {items.map((item) => (
                    <td key={item.id} className="py-2.5 px-3">{item.weight || '—'}</td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2.5 pr-4 text-[#6B6964] dark:text-[#9CA0A6]">
                    {lang === 'bn' ? 'ওয়ারেন্টি' : 'Warranty'}
                  </td>
                  {items.map((item) => (
                    <td key={item.id} className="py-2.5 px-3">{item.warranty || '—'}</td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 pr-4" />
                  {items.map((item) => {
                    const safeUrl =
                      item.productType === 'affiliate' ? isSafeExternalUrl(item.affiliateUrl) : null;
                    return (
                      <td key={item.id} className="py-3 px-3">
                        {safeUrl ? (
                          <a
                            href={safeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full py-2 px-3 rounded-lg bg-[#0F6E56] hover:bg-[#0C5945] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5"
                          >
                            <span>Buy Now</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        ) : (
                          <button
                            type="button"
                            disabled={item.stock <= 0}
                            onClick={() => {
                              onAddToCart(item, item.variants[0] || 'Standard', 1, true);
                              onClose();
                            }}
                            className="w-full py-2 px-3 rounded-lg bg-[#0F6E56] hover:bg-[#0C5945] text-white text-xs font-semibold disabled:opacity-40"
                          >
                            {lang === 'bn' ? 'ব্যাগে যোগ করুন' : 'Add to Bag'}
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
