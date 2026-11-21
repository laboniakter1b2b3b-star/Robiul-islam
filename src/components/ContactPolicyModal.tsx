import { X } from 'lucide-react';
import { PolicyKey, StoreSettings } from '../types';

interface ContactPolicyModalProps {
  policy: PolicyKey | null;
  settings: StoreSettings;
  lang?: 'en' | 'bn';
  onClose: () => void;
}

const POLICY_TITLES_EN: Record<PolicyKey, string> = {
  about: 'About SHOPNEXA',
  privacy: 'Privacy Policy',
  terms: 'Terms & Conditions',
  shipping: 'Shipping & Delivery Policy',
  return: 'Return & Refund Policy',
  faq: 'Frequently Asked Questions',
};

const POLICY_TITLES_BN: Record<PolicyKey, string> = {
  about: 'SHOPNEXA সম্পর্কে',
  privacy: 'প্রাইভেসি পলিসি',
  terms: 'শর্তাবলী',
  shipping: 'ডেলিভারি নীতিমালা',
  return: 'রিটার্ন ও রিফান্ড নীতিমালা',
  faq: 'সাধারণ জিজ্ঞাসা (FAQ)',
};

const FAQ_ITEMS_BN = [
  {
    q: 'অর্ডার করতে কি অ্যাকাউন্ট খুলতে হবে?',
    a: 'না, কোনো অ্যাকাউন্ট বা লগইন ছাড়াই সরাসরি নাম, ফোন ও ঠিকানা দিয়ে গেস্ট চেকআউটে অর্ডার করতে পারবেন।',
  },
  {
    q: 'ডেলিভারি চার্জ ও সময় কত?',
    a: 'ঢাকার ভেতরে ২৪–৪৮ ঘণ্টায় (৳৭০) এবং ঢাকার বাইরে ২–৪ দিনে (৳১৩০) ডেলিভারি করা হয়। ৳৫,০০০+ অর্ডারে ফ্রি ডেলিভারি।',
  },
  {
    q: 'পেমেন্ট কীভাবে করা যাবে?',
    a: 'ক্যাশ অন ডেলিভারি, বিকাশ অথবা নগদ Send Money-এর মাধ্যমে পেমেন্ট করা যায়।',
  },
  {
    q: 'পণ্য পছন্দ না হলে বা সাইজ না মিললে কী করবো?',
    a: 'ডেলিভারি পাওয়ার ৭ দিনের মধ্যে ট্যাগ ও অরিজিনাল প্যাকেজিং অক্ষুণ্ণ থাকলে রিটার্ন বা সাইজ এক্সচেঞ্জ করতে পারবেন।',
  },
];

const FAQ_ITEMS_EN = [
  {
    q: 'Do I need an account to order?',
    a: 'No. SHOPNEXA supports instant Guest Checkout—simply enter your name, phone number, and delivery address.',
  },
  {
    q: 'What are the delivery charges and timelines?',
    a: 'Inside Dhaka: 24–48 hours (৳70). Outside Dhaka: 2–4 business days (৳130). Orders above ৳5,000 qualify for free delivery.',
  },
  {
    q: 'Which payment methods are accepted?',
    a: 'Cash on Delivery (COD), bKash Send Money, and Nagad Send Money.',
  },
  {
    q: 'What is the return/exchange policy?',
    a: 'Unused items with tags and original packaging can be exchanged or returned within 7 days of delivery.',
  },
];

export function ContactPolicyModal({
  policy,
  settings,
  lang = 'bn',
  onClose,
}: ContactPolicyModalProps) {
  if (!policy) return null;

  const titles = lang === 'bn' ? POLICY_TITLES_BN : POLICY_TITLES_EN;
  const faqItems = lang === 'bn' ? FAQ_ITEMS_BN : FAQ_ITEMS_EN;

  const contentMap: Record<Exclude<PolicyKey, 'faq'>, string> = {
    about: settings.about_content,
    privacy: settings.privacy_policy,
    terms: settings.terms_conditions,
    shipping: settings.shipping_policy,
    return: settings.return_policy,
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-label={titles[policy]}
    >
      <div className="w-full max-w-lg bg-[#FFFFFF] dark:bg-[#16181D] border border-[#E5E2DC] dark:border-[#262930] rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E2DC] dark:border-[#262930]">
          <h2 className="text-base font-semibold text-[#141413] dark:text-[#F3F2EF]">
            {titles[policy]}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-[#6B6964] hover:text-[#141413] dark:text-[#9CA0A6] dark:hover:text-white"
            aria-label="Close policy dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {policy === 'faq' ? (
            <div className="space-y-3">
              {faqItems.map((item) => (
                <div
                  key={item.q}
                  className="p-3.5 rounded-lg bg-[#F9F8F6] dark:bg-[#1D2026] border border-[#E5E2DC] dark:border-[#2E323B]"
                >
                  <p className="text-sm font-semibold text-[#141413] dark:text-[#F3F2EF]">
                    {item.q}
                  </p>
                  <p className="text-xs leading-relaxed text-[#4A4945] dark:text-[#C8C6C0] mt-1">
                    {item.a}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm leading-relaxed text-[#4A4945] dark:text-[#C8C6C0]">
              {contentMap[policy]}
            </p>
          )}
          <div className="pt-4 border-t border-[#E5E2DC] dark:border-[#262930] text-xs text-[#6B6964] dark:text-[#9CA0A6] space-y-1">
            <p>{settings.store_address}</p>
            <p>
              {lang === 'bn' ? 'সাপোর্ট:' : 'Support:'} {settings.support_phone} · {settings.support_email}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
