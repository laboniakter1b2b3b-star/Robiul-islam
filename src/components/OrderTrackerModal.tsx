import { useState, FormEvent } from 'react';
import { X, Search, PackageCheck } from 'lucide-react';
import { Language, Order } from '../types';
import { formatBDT } from '../data/storeData';

interface OrderTrackerModalProps {
  isOpen: boolean;
  recentOrders: Order[];
  lang: Language;
  onClose: () => void;
}

export function OrderTrackerModal({
  isOpen,
  recentOrders,
  lang,
  onClose,
}: OrderTrackerModalProps) {
  const [query, setQuery] = useState('');
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Order[]>([]);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const displayedOrders = searched ? results : recentOrders.slice(0, 3);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const trimmed = query.trim();
    if (trimmed.length < 4) {
      setError(
        lang === 'bn'
          ? 'অর্ডার আইডি অথবা ফোন নম্বরের কমপক্ষে ৪ অক্ষর লিখুন।'
          : 'Enter at least 4 characters of your Order ID or phone number.'
      );
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/orders/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Unable to look up order.');
        return;
      }
      setResults(data.orders || []);
      setSearched(true);
    } catch {
      setError('Network error while checking order status.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Track Order"
    >
      <div className="w-full max-w-xl bg-[#FFFFFF] dark:bg-[#16181D] border border-[#E5E2DC] dark:border-[#262930] rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E2DC] dark:border-[#262930]">
          <h2 className="text-base font-semibold text-[#141413] dark:text-[#F3F2EF]">
            {lang === 'bn' ? 'অর্ডার ট্র্যাক করুন' : 'Track Your Order'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-[#6B6964] hover:text-[#141413] dark:text-[#9CA0A6] dark:hover:text-white"
            aria-label="Close order tracker"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6B6964]" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={
                  lang === 'bn'
                    ? 'অর্ডার আইডি (যেমন SNX-ORD-...) বা ফোন নম্বর লিখুন'
                    : 'Enter Order ID (e.g. SNX-ORD-...) or phone number'
                }
                className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-lg border border-[#E5E2DC] dark:border-[#2E323B] bg-[#F9F8F6] dark:bg-[#1D2026] focus:outline-none focus:border-[#0F6E56]"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2.5 rounded-lg bg-[#0F6E56] text-white text-sm font-semibold hover:bg-[#0C5945] whitespace-nowrap shrink-0 disabled:opacity-50"
            >
              {loading ? '...' : lang === 'bn' ? 'খুঁজুন' : 'Track'}
            </button>
          </form>

          {error && <p className="text-xs text-[#DC2626]">{error}</p>}

          {displayedOrders.length === 0 ? (
            <div className="py-10 text-center border border-dashed border-[#E5E2DC] dark:border-[#2E323B] rounded-xl">
              <PackageCheck className="w-8 h-8 mx-auto text-[#6B6964] mb-2 opacity-60" />
              <p className="text-sm font-medium text-[#141413] dark:text-[#F3F2EF]">
                {searched
                  ? lang === 'bn'
                    ? 'এই আইডি বা ফোন নম্বরে কোনো অর্ডার পাওয়া যায়নি।'
                    : 'No matching order found for that ID or phone.'
                  : lang === 'bn'
                  ? 'অর্ডার আইডি বা মোবাইল নম্বর দিয়ে স্ট্যাটাস দেখুন।'
                  : 'Enter your Order ID or mobile number to check live delivery status.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {displayedOrders.map((order) => (
                <div
                  key={order.orderId}
                  className="p-4 rounded-xl border border-[#E5E2DC] dark:border-[#262930] bg-[#F9F8F6] dark:bg-[#1D2026] space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-sm font-semibold text-[#141413] dark:text-[#F3F2EF]">
                      {order.orderId}
                    </span>
                    <span className="text-xs font-medium text-[#0F6E56] dark:text-[#34D399]">
                      {order.orderStatus} · {order.paymentStatus}
                    </span>
                  </div>
                  <p className="text-xs text-[#6B6964] dark:text-[#9CA0A6]">
                    {order.customerName} · {order.district} · {order.createdAt}
                  </p>
                  <div className="pt-2 border-t border-[#E5E2DC] dark:border-[#2E323B] flex justify-between text-xs">
                    <span>{order.items.map((i) => `${i.name} ×${i.quantity}`).join(', ')}</span>
                    <span className="font-mono font-semibold tabular-nums shrink-0 ml-3">
                      {formatBDT(order.total)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
