import { useState, useEffect, FormEvent } from 'react';
import { ShieldCheck, Lock, Mail, ArrowLeft, RefreshCw } from 'lucide-react';
import { AdminAuthStatus } from '../types';

interface AdminLoginModalProps {
  onSuccess: (token: string, adminUsername: string) => void;
  onBackToStore: () => void;
}

export function AdminLoginModal({ onSuccess, onBackToStore }: AdminLoginModalProps) {
  const [authStatus, setAuthStatus] = useState<AdminAuthStatus | null>(null);
  const [step, setStep] = useState<'credentials' | 'otp'>('credentials');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [challengeToken, setChallengeToken] = useState('');
  const [deliveryMode, setDeliveryMode] = useState<'gateway' | 'server_console'>('gateway');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    fetch('/api/admin/auth/status')
      .then((res) => res.json())
      .then((data: AdminAuthStatus) => {
        setAuthStatus(data);
      })
      .catch(() => {
        setError('অথেনটিকেশন সার্ভারের সাথে সংযোগ করা যাচ্ছে না।');
      });
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleCredentialsSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');

    const isBootstrap = authStatus && !authStatus.configured;
    if (isBootstrap) {
      if (username.trim().length < 3) {
        setError('অ্যাডমিন ইউজারনেম কমপক্ষে ৩ অক্ষরের হতে হবে।');
        return;
      }
      if (password.length < 8) {
        setError('অ্যাডমিন পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে।');
        return;
      }
      if (password !== confirmPassword) {
        setError('দুটি পাসওয়ার্ড এক নয়।');
        return;
      }
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      setError('অনুগ্রহ করে সঠিক অনুমোদিত জিমেইল ঠিকানা লিখুন।');
      return;
    }

    setLoading(true);
    try {
      const endpoint = isBootstrap ? '/api/admin/auth/bootstrap' : '/api/admin/auth/login';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password,
          email: normalizedEmail,
        }),
      });
      const rawText = await res.text();
      let data: Record<string, any> = {};
      try {
        data = rawText ? JSON.parse(rawText) : {};
      } catch {
        data = {};
      }
      if (!res.ok) {
        setError(data.error || `সার্ভার রেসপন্স পাওয়া যায়নি (কোড: ${res.status})। কিছুক্ষণ পর আবার চেষ্টা করুন।`);
        return;
      }
      setChallengeToken(data.challengeToken);
      setDeliveryMode(data.deliveryMode || 'gateway');
      setStep('otp');
      setResendCooldown(45);
      setInfo(
        data.deliveryMode === 'gateway'
          ? 'আপনার অনুমোদিত জিমেইলে ৬ ডিজিটের ভেরিফিকেশন কোড পাঠানো হয়েছে। ইনবক্স বা স্প্যাম ফোল্ডার দেখুন।'
          : '৬ ডিজিটের ভেরিফিকেশন কোড তৈরি হয়েছে। সরাসরি ইনবক্সে পাঠাতে Secrets-এ ইমেইল সেটিংস যোগ করুন।'
      );
    } catch {
      setError('তথ্য যাচাইয়ের সময় নেটওয়ার্ক সমস্যা হয়েছে।');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!/^\d{6}$/.test(otp.trim())) {
      setError('অনুগ্রহ করে ৬ ডিজিটের জিমেইল OTP কোড দিন।');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/admin/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeToken, otp: otp.trim() }),
      });
      const rawText = await res.text();
      let data: Record<string, any> = {};
      try {
        data = rawText ? JSON.parse(rawText) : {};
      } catch {
        data = {};
      }
      if (!res.ok) {
        setError(data.error || 'OTP কোডটি সঠিক নয়।');
        return;
      }
      onSuccess(data.token, data.adminUsername);
    } catch {
      setError('OTP যাচাইয়ের সময় নেটওয়ার্ক সমস্যা হয়েছে।');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || !challengeToken) return;
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/admin/auth/resend-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeToken }),
      });
      const rawText = await res.text();
      let data: Record<string, any> = {};
      try {
        data = rawText ? JSON.parse(rawText) : {};
      } catch {
        data = {};
      }
      if (!res.ok) {
        setError(data.error || 'নতুন OTP পাঠানো যায়নি।');
        return;
      }
      setDeliveryMode(data.deliveryMode || deliveryMode);
      setResendCooldown(45);
      setInfo(
        data.deliveryMode === 'gateway'
          ? 'আপনার অনুমোদিত জিমেইলে নতুন ৬ ডিজিটের কোড পাঠানো হয়েছে।'
          : 'নতুন ৬ ডিজিটের ভেরিফিকেশন কোড তৈরি হয়েছে।'
      );
    } catch {
      setError('OTP পুনরায় পাঠাতে সমস্যা হয়েছে।');
    } finally {
      setLoading(false);
    }
  };

  const isBootstrap = authStatus !== null && !authStatus.configured;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F9F8F6] dark:bg-[#080A0E] text-[#141413] dark:text-[#FFFFFF] px-4 py-12">
      <div className="w-full max-w-md rounded-xl bg-[#FFFFFF] dark:bg-[#12151C] border border-[#E5E2DC] dark:border-[#252A34] shadow-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E5E2DC] dark:border-[#252A34] flex items-center justify-between">
          <button
            type="button"
            onClick={onBackToStore}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#6B6964] hover:text-[#141413] dark:text-[#D1D5DB] dark:hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
            স্টোরে ফিরে যান
          </button>
          <span className="text-xs font-mono text-[#0F6E56] dark:text-[#34D399]">
            ৩-ধাপের জিমেইল নিরাপত্তা
          </span>
        </div>

        <div className="p-6 sm:p-8 space-y-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-[#0F6E56] dark:text-[#34D399]">
              {step === 'credentials' ? <Lock className="w-5 h-5" /> : <Mail className="w-5 h-5" />}
              <span className="text-xs font-semibold uppercase tracking-wider">
                {step === 'credentials'
                  ? isBootstrap
                    ? 'ধাপ ১–২ · প্রথমবার অ্যাডমিন সেটআপ'
                    : 'ধাপ ১–২ · অ্যাডমিন লগইন'
                  : 'ধাপ ৩ · জিমেইল OTP ভেরিফিকেশন'}
              </span>
            </div>
            <h1 className="text-xl font-bold font-display">
              {step === 'credentials'
                ? isBootstrap
                  ? 'অ্যাডমিন অ্যাকাউন্ট সেট করুন'
                  : 'SHOPNEXA অ্যাডমিন সাইন ইন'
                : 'জিমেইল OTP যাচাই করুন'}
            </h1>
            <p className="text-xs text-[#6B6964] dark:text-[#D1D5DB]">
              {step === 'credentials'
                ? 'শুধুমাত্র অনুমোদিত অ্যাডমিন প্রবেশ করতে পারবেন। পাসওয়ার্ডের পর অনুমোদিত জিমেইলে পাঠানো ৬ ডিজিটের OTP কোড দিয়ে যাচাই বাধ্যতামূলক।'
                : 'আপনার অনুমোদিত জিমেইলে পাঠানো ৬ ডিজিটের কোডটি লিখুন।'}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 text-[11px] font-medium">
            <div
              className={`py-1.5 px-2 rounded text-center border ${
                step === 'credentials'
                  ? 'border-[#0F6E56] bg-[#0F6E56]/10 text-[#0F6E56] dark:text-[#34D399]'
                  : 'border-[#0F6E56]/40 text-[#0F6E56] dark:text-[#34D399]'
              }`}
            >
              ১. ইউজারনেম
            </div>
            <div
              className={`py-1.5 px-2 rounded text-center border ${
                step === 'credentials'
                  ? 'border-[#0F6E56] bg-[#0F6E56]/10 text-[#0F6E56] dark:text-[#34D399]'
                  : 'border-[#0F6E56]/40 text-[#0F6E56] dark:text-[#34D399]'
              }`}
            >
              ২. পাসওয়ার্ড
            </div>
            <div
              className={`py-1.5 px-2 rounded text-center border ${
                step === 'otp'
                  ? 'border-[#0F6E56] bg-[#0F6E56]/10 text-[#0F6E56] dark:text-[#34D399]'
                  : 'border-[#E5E2DC] dark:border-[#2E3440] text-[#6B6964] dark:text-[#9CA3AF]'
              }`}
            >
              ৩. জিমেইল OTP
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-[#DC2626]/10 border border-[#DC2626]/30 text-xs text-[#DC2626] dark:text-[#F87171]">
              {error}
            </div>
          )}

          {info && (
            <div className="p-3 rounded-lg bg-[#0F6E56]/10 border border-[#0F6E56]/30 text-xs text-[#0F6E56] dark:text-[#34D399]">
              {info}
            </div>
          )}

          {authStatus === null ? (
            <div className="py-6 text-center text-xs text-[#6B6964] dark:text-[#D1D5DB]">
              নিরাপত্তা সেটিংস যাচাই হচ্ছে...
            </div>
          ) : step === 'credentials' ? (
            <form onSubmit={handleCredentialsSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1">অ্যাডমিন ইউজারনেম</label>
                <input
                  type="text"
                  required
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="অ্যাডমিন ইউজারনেম লিখুন"
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-[#E5E2DC] dark:border-[#2E3440] bg-[#F9F8F6] dark:bg-[#191D26] text-[#141413] dark:text-[#FFFFFF] focus:outline-none focus:border-[#0F6E56]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">অ্যাডমিন পাসওয়ার্ড</label>
                <input
                  type="password"
                  required
                  autoComplete={isBootstrap ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isBootstrap ? 'কমপক্ষে ৮ অক্ষরের পাসওয়ার্ড' : 'পাসওয়ার্ড লিখুন'}
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-[#E5E2DC] dark:border-[#2E3440] bg-[#F9F8F6] dark:bg-[#191D26] text-[#141413] dark:text-[#FFFFFF] focus:outline-none focus:border-[#0F6E56]"
                />
              </div>

              {isBootstrap && (
                <div>
                  <label className="block text-xs font-medium mb-1">পাসওয়ার্ড নিশ্চিত করুন</label>
                  <input
                    type="password"
                    required
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="পাসওয়ার্ড পুনরায় লিখুন"
                    className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-[#E5E2DC] dark:border-[#2E3440] bg-[#F9F8F6] dark:bg-[#191D26] text-[#141413] dark:text-[#FFFFFF] focus:outline-none focus:border-[#0F6E56]"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium mb-1">
                  অনুমোদিত অ্যাডমিন জিমেইল
                </label>
                <input
                  type="email"
                  required
                  autoComplete="off"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="আপনার অ্যাডমিন জিমেইল লিখুন"
                  className="w-full px-3.5 py-2.5 text-sm font-mono rounded-lg border border-[#E5E2DC] dark:border-[#2E3440] bg-[#F9F8F6] dark:bg-[#191D26] text-[#141413] dark:text-[#FFFFFF] focus:outline-none focus:border-[#0F6E56]"
                />
                <p className="text-[11px] text-[#6B6964] dark:text-[#9CA3AF] mt-1">
                  অনুমোদিত অ্যাডমিন জিমেইল ছাড়া অন্য কোনো জিমেইল দিয়ে প্রবেশ করা যাবে না।
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-lg bg-[#0F6E56] hover:bg-[#0C5945] text-white text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {loading
                  ? 'যাচাই করে OTP পাঠানো হচ্ছে...'
                  : isBootstrap
                  ? 'অ্যাডমিন সেভ করে জিমেইলে OTP পাঠান'
                  : 'পরবর্তী ধাপ: জিমেইলে OTP পাঠান'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1">
                  ৬ ডিজিটের জিমেইল OTP কোড
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="w-full px-4 py-3 text-center text-xl tracking-[0.4em] font-mono rounded-lg border border-[#E5E2DC] dark:border-[#2E3440] bg-[#F9F8F6] dark:bg-[#191D26] text-[#141413] dark:text-[#FFFFFF] focus:outline-none focus:border-[#0F6E56]"
                />
              </div>

              {deliveryMode === 'server_console' && (
                <p className="text-[11px] leading-relaxed text-[#6B6964] dark:text-[#D1D5DB]">
                  লাইভ জিমেইল ডেলিভারির জন্য AI Studio Secrets-এ GMAIL_USER এবং ১৬-অক্ষরের GMAIL_APP_PASSWORD (অথবা RESEND_API_KEY) যোগ করুন।
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-lg bg-[#0F6E56] hover:bg-[#0C5945] text-white text-sm font-semibold transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" />
                {loading ? 'OTP যাচাই হচ্ছে...' : 'OTP যাচাই করে ড্যাশবোর্ডে প্রবেশ করুন'}
              </button>

              <div className="flex items-center justify-between pt-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setStep('credentials');
                    setOtp('');
                    setError('');
                    setInfo('');
                  }}
                  className="text-[#6B6964] hover:text-[#141413] dark:text-[#D1D5DB] dark:hover:text-white"
                >
                  তথ্য পরিবর্তন করুন
                </button>
                <button
                  type="button"
                  disabled={resendCooldown > 0 || loading}
                  onClick={handleResendOtp}
                  className="inline-flex items-center gap-1 text-[#0F6E56] dark:text-[#34D399] disabled:opacity-50"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  {resendCooldown > 0 ? `পুনরায় পাঠান (${resendCooldown}s)` : 'আবার OTP পাঠান'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
