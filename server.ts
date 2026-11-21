import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import nodemailer from 'nodemailer';
import {
  INITIAL_CATEGORIES,
  INITIAL_COUPONS,
  INITIAL_PRODUCTS,
  INITIAL_REVIEWS,
  INITIAL_SETTINGS,
  INITIAL_STOCK_HISTORY,
} from './src/data/storeData.ts';
import type {
  Category,
  ContactMessage,
  Coupon,
  Order,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Product,
  ProductReview,
  StockHistoryEntry,
  StoreSettings,
} from './src/types.ts';

interface AdminCredential {
  username: string;
  passwordHash: string;
  passwordSalt: string;
  createdAt: string;
}

interface StoreDatabase {
  adminCredential: AdminCredential | null;
  products: Product[];
  categories: Category[];
  coupons: Coupon[];
  orders: Order[];
  reviews: ProductReview[];
  messages: ContactMessage[];
  stockHistory: StockHistoryEntry[];
  newsletterEmails: string[];
  settings: StoreSettings;
}

interface PendingCredential {
  username: string;
  passwordHash: string;
  passwordSalt: string;
}

interface OtpChallenge {
  username: string;
  otpHash: string;
  salt: string;
  expiresAt: number;
  attemptsLeft: number;
  lastSentAt: number;
  pendingCredential?: PendingCredential;
}

interface AdminSession {
  username: string;
  expiresAt: number;
}

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.resolve(process.cwd(), 'data');
const UPLOAD_DIR = path.resolve(DATA_DIR, 'uploads');
const DATA_FILE = path.join(DATA_DIR, 'store.json');
const ADMIN_OTP_EMAIL = (process.env.ADMIN_OTP_EMAIL || 'robiulvv494@gmail.com').trim().toLowerCase();
const SESSION_SECRET =
  process.env.ADMIN_SESSION_SECRET || crypto.randomBytes(32).toString('hex');

const otpChallenges = new Map<string, OtpChallenge>();
const adminSessions = new Map<string, AdminSession>();
const loginRateLimits = new Map<string, { count: number; resetAt: number }>();

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}

function loadDatabase(): StoreDatabase {
  ensureDataDir();
  if (fs.existsSync(DATA_FILE)) {
    try {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      const parsed = JSON.parse(raw) as Partial<StoreDatabase>;
      return {
        adminCredential: parsed.adminCredential || null,
        products: parsed.products?.length
          ? parsed.products.map((p) => ({
              ...p,
              piecesInfo: p.piecesInfo ?? '',
              productType: p.productType === 'affiliate' ? 'affiliate' : 'standard',
              affiliateUrl: typeof p.affiliateUrl === 'string' ? p.affiliateUrl : '',
            }))
          : INITIAL_PRODUCTS,
        categories: parsed.categories?.length ? parsed.categories : INITIAL_CATEGORIES,
        coupons: parsed.coupons?.length ? parsed.coupons : INITIAL_COUPONS,
        orders: parsed.orders || [],
        reviews: parsed.reviews?.length ? parsed.reviews : INITIAL_REVIEWS,
        messages: parsed.messages || [],
        stockHistory: parsed.stockHistory?.length ? parsed.stockHistory : INITIAL_STOCK_HISTORY,
        newsletterEmails: parsed.newsletterEmails || [],
        settings: parsed.settings ? { ...INITIAL_SETTINGS, ...parsed.settings } : INITIAL_SETTINGS,
      };
    } catch {
      // Fall through to seed database if corrupted
    }
  }
  const initialDb: StoreDatabase = {
    adminCredential: null,
    products: INITIAL_PRODUCTS,
    categories: INITIAL_CATEGORIES,
    coupons: INITIAL_COUPONS,
    orders: [],
    reviews: INITIAL_REVIEWS,
    messages: [],
    stockHistory: INITIAL_STOCK_HISTORY,
    newsletterEmails: [],
    settings: INITIAL_SETTINGS,
  };
  fs.writeFileSync(DATA_FILE, JSON.stringify(initialDb, null, 2), 'utf8');
  return initialDb;
}

const db: StoreDatabase = loadDatabase();

function persistDatabase() {
  ensureDataDir();
  const tempFile = `${DATA_FILE}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(db, null, 2), 'utf8');
  fs.renameSync(tempFile, DATA_FILE);
}

function safeEqualText(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function hashOtp(otp: string, salt: string): string {
  return crypto.createHash('sha256').update(`${salt}:${otp}`).digest('hex');
}

function hasEnvAdminCredentials(): boolean {
  return Boolean(process.env.ADMIN_USERNAME?.trim() && process.env.ADMIN_PASSWORD?.trim());
}

function isAdminConfigured(): boolean {
  return hasEnvAdminCredentials() || Boolean(db.adminCredential);
}

function hasEmailProviderConfigured(): boolean {
  const hasGmailSmtp = Boolean(
    process.env.GMAIL_USER?.trim() && process.env.GMAIL_APP_PASSWORD?.trim()
  );
  const hasCustomSmtp = Boolean(
    process.env.SMTP_HOST?.trim() &&
      process.env.SMTP_USER?.trim() &&
      process.env.SMTP_PASS?.trim()
  );
  const hasResend = Boolean(process.env.RESEND_API_KEY?.trim());
  return hasGmailSmtp || hasCustomSmtp || hasResend;
}

async function sendEmailOtp(otp: string): Promise<'gateway' | 'server_console'> {
  const targetEmail = ADMIN_OTP_EMAIL;
  const subject = 'SHOPNEXA Admin Verification Code';
  const textBody = `Your SHOPNEXA Admin Verification Code is: ${otp}. It is valid for 5 minutes. Do not share this code with anyone.`;
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; border: 1px solid #e5e2dc; border-radius: 12px;">
      <h2 style="margin: 0 0 8px; color: #0f6e56;">SHOPNEXA Admin Verification</h2>
      <p style="margin: 0 0 16px; color: #4a4945; font-size: 14px;">
        Use the 6-digit code below to verify your admin sign-in for <strong>${targetEmail}</strong>:
      </p>
      <div style="padding: 16px; background: #f9f8f6; border-radius: 8px; text-align: center; font-size: 28px; font-weight: bold; letter-spacing: 8px; color: #141413;">
        ${otp}
      </div>
      <p style="margin: 16px 0 0; color: #6b6964; font-size: 12px;">
        This code expires in 5 minutes. If you did not attempt to sign in, ignore this message.
      </p>
    </div>
  `;

  if (process.env.GMAIL_USER?.trim() && process.env.GMAIL_APP_PASSWORD?.trim()) {
    const gmailUser = process.env.GMAIL_USER.trim();
    const gmailPass = process.env.GMAIL_APP_PASSWORD.replace(/\s+/g, '');
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: gmailUser, pass: gmailPass },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
    await transporter.sendMail({
      from: `"SHOPNEXA Security" <${gmailUser}>`,
      to: targetEmail,
      subject,
      text: textBody,
      html: htmlBody,
    });
    return 'gateway';
  }

  if (
    process.env.SMTP_HOST?.trim() &&
    process.env.SMTP_USER?.trim() &&
    process.env.SMTP_PASS?.trim()
  ) {
    const port = Number(process.env.SMTP_PORT) || 465;
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST.trim(),
      port,
      secure: port === 465,
      auth: {
        user: process.env.SMTP_USER.trim(),
        pass: process.env.SMTP_PASS.trim(),
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
    await transporter.sendMail({
      from: `"SHOPNEXA Security" <${process.env.SMTP_USER.trim()}>`,
      to: targetEmail,
      subject,
      text: textBody,
      html: htmlBody,
    });
    return 'gateway';
  }

  if (process.env.RESEND_API_KEY?.trim()) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL?.trim() || 'SHOPNEXA Security <onboarding@resend.dev>',
        to: [targetEmail],
        subject,
        text: textBody,
        html: htmlBody,
      }),
    });
    if (!res.ok) {
      throw new Error('Resend email delivery failed');
    }
    return 'gateway';
  }

  // Server-only fallback log when Gmail/SMTP secrets are not yet configured
  console.info(`[SHOPNEXA ADMIN EMAIL OTP] Email: ${targetEmail} | Code: ${otp} (expires in 5m)`);
  return 'server_console';
}

function createSignedSessionToken(username: string): { token: string; expiresAt: number } {
  const sessionId = crypto.randomBytes(24).toString('hex');
  const expiresAt = Date.now() + 12 * 60 * 60 * 1000;
  adminSessions.set(sessionId, { username, expiresAt });
  const sig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(sessionId)
    .digest('hex');
  return { token: `${sessionId}.${sig}`, expiresAt };
}

function verifySessionToken(bearerToken: string): AdminSession | null {
  const parts = bearerToken.split('.');
  if (parts.length !== 2) return null;
  const [sessionId, sig] = parts;
  if (!sessionId || !sig) return null;
  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(sessionId)
    .digest('hex');
  if (!safeEqualText(sig, expectedSig)) return null;
  const session = adminSessions.get(sessionId);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    adminSessions.delete(sessionId);
    return null;
  }
  return session;
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = loginRateLimits.get(ip);
  if (!entry || now > entry.resetAt) {
    loginRateLimits.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return true;
  }
  if (entry.count >= 15) {
    return false;
  }
  entry.count += 1;
  return true;
}

function isSafeExternalUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

function isSafeImageUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return true;
  if (
    trimmed.startsWith('/assets/') ||
    trimmed.startsWith('/src/assets/') ||
    trimmed.startsWith('/uploads/')
  ) {
    return true;
  }
  return isSafeExternalUrl(trimmed) !== null;
}

function toPublicProduct(product: Product): Omit<Product, 'purchasePrice'> & { purchasePrice: number } {
  return {
    ...product,
    purchasePrice: 0,
  };
}

function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: Admin verification required.' });
    return;
  }
  const token = authHeader.slice(7).trim();
  const session = verifySessionToken(token);
  if (!session) {
    res.status(401).json({ error: 'Unauthorized: Invalid or expired admin session.' });
    return;
  }
  res.locals.adminUser = session.username;
  res.locals.adminSessionId = token.split('.')[0];
  next();
}

function sanitizeProductInput(body: Record<string, unknown>, existing?: Product): Omit<Product, 'id' | 'createdAt'> | null {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return null;

  const image = typeof body.image === 'string' ? body.image.trim() : existing?.image || '';
  if (!isSafeImageUrl(image)) return null;

  const regularPrice = Math.max(0, Number(body.regularPrice) || 0);
  const rawDiscount =
    body.discountPrice === null || body.discountPrice === '' || body.discountPrice === undefined
      ? null
      : Math.max(0, Number(body.discountPrice) || 0);
  const purchasePrice = Math.max(0, Number(body.purchasePrice) || 0);
  const stock = Math.max(0, Math.floor(Number(body.stock) || 0));

  const variantsRaw = Array.isArray(body.variants)
    ? body.variants.map((v) => String(v).trim()).filter(Boolean)
    : typeof body.variants === 'string'
    ? body.variants
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean)
    : existing?.variants || ['Standard'];

  const statusVal = body.status === 'Draft' ? 'Draft' : 'Active';
  const productType: 'standard' | 'affiliate' =
    body.productType === 'affiliate'
      ? 'affiliate'
      : body.productType === 'standard'
      ? 'standard'
      : existing?.productType === 'affiliate'
      ? 'affiliate'
      : 'standard';

  let affiliateUrl = '';
  if (productType === 'affiliate') {
    const rawAffiliateUrl =
      typeof body.affiliateUrl === 'string' ? body.affiliateUrl : existing?.affiliateUrl || '';
    const safeUrl = isSafeExternalUrl(rawAffiliateUrl);
    if (!safeUrl) return null;
    affiliateUrl = safeUrl;
  }

  return {
    code:
      typeof body.code === 'string' && body.code.trim()
        ? body.code.trim()
        : existing?.code || `SNX-${db.products.length + 1001}`,
    sku:
      typeof body.sku === 'string' && body.sku.trim()
        ? body.sku.trim()
        : existing?.sku || `SNX-SKU-${db.products.length + 1001}`,
    name,
    category:
      typeof body.category === 'string' && body.category.trim()
        ? body.category.trim()
        : existing?.category || 'Apparel',
    subcategory:
      typeof body.subcategory === 'string' && body.subcategory.trim()
        ? body.subcategory.trim()
        : existing?.subcategory || 'Essentials',
    brand:
      typeof body.brand === 'string' && body.brand.trim()
        ? body.brand.trim()
        : existing?.brand || 'SHOPNEXA',
    regularPrice,
    discountPrice: rawDiscount,
    purchasePrice: productType === 'affiliate' ? 0 : purchasePrice,
    stock: productType === 'affiliate' ? Math.max(1, stock || 99) : stock,
    piecesInfo: typeof body.piecesInfo === 'string' ? body.piecesInfo.trim() : existing?.piecesInfo || '',
    weight: typeof body.weight === 'string' ? body.weight.trim() : existing?.weight || '',
    warranty: typeof body.warranty === 'string' ? body.warranty.trim() : existing?.warranty || '',
    status: statusVal,
    productType,
    affiliateUrl,
    image: image || db.categories.find((c) => c.name === body.category)?.image || db.products[0]?.image || '',
    description:
      typeof body.description === 'string'
        ? body.description.trim()
        : existing?.description || '',
    variants: variantsRaw.length > 0 ? variantsRaw : ['Standard'],
  };
}

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '4mb' }));

  app.get('/uploads/:filename', (req, res) => {
    const rawName = String(req.params.filename || '');
    if (!/^[a-zA-Z0-9_-]+\.(png|jpg|jpeg|webp)$/.test(rawName)) {
      res.status(400).end();
      return;
    }
    const resolved = path.resolve(UPLOAD_DIR, rawName);
    if (!resolved.startsWith(UPLOAD_DIR + path.sep) || !fs.existsSync(resolved)) {
      res.status(404).end();
      return;
    }
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.sendFile(resolved);
  });

  // =========================================================================
  // PUBLIC STOREFRONT & GUEST CHECKOUT ROUTES
  // =========================================================================

  app.get('/api/store', (_req, res) => {
    res.json({
      products: db.products.filter((p) => p.status === 'Active').map(toPublicProduct),
      categories: db.categories,
      coupons: db.coupons.filter((c) => c.active),
      reviews: db.reviews,
      settings: db.settings,
    });
  });

  app.post('/api/orders', (req, res) => {
    const body = (req.body || {}) as Record<string, unknown>;
    const customerName = typeof body.customerName === 'string' ? body.customerName.trim() : '';
    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const district = typeof body.district === 'string' ? body.district.trim() : 'Dhaka';
    const area = typeof body.area === 'string' ? body.area.trim() : '';
    const fullAddress = typeof body.fullAddress === 'string' ? body.fullAddress.trim() : '';
    const deliveryZone = body.deliveryZone === 'outside' ? 'outside' : 'dhaka';
    const paymentMethodRaw = body.paymentMethod;
    const paymentMethod: PaymentMethod =
      paymentMethodRaw === 'bKash' || paymentMethodRaw === 'Nagad' ? paymentMethodRaw : 'COD';
    const trxId = typeof body.trxId === 'string' ? body.trxId.trim() : '';
    const couponCode = typeof body.couponCode === 'string' ? body.couponCode.trim().toUpperCase() : '';
    const rawItems = Array.isArray(body.items) ? body.items : [];

    if (!customerName || !phone || !area || !fullAddress || rawItems.length === 0) {
      res.status(400).json({ error: 'Customer name, phone, area, address, and cart items are required.' });
      return;
    }

    if (paymentMethod === 'COD' && !db.settings.cod_enabled) {
      res.status(400).json({ error: 'Cash on Delivery is currently disabled.' });
      return;
    }

    if ((paymentMethod === 'bKash' || paymentMethod === 'Nagad') && !trxId) {
      res.status(400).json({ error: `${paymentMethod} Transaction ID is required.` });
      return;
    }

    const orderItems: Order['items'] = [];
    for (const raw of rawItems) {
      const itemObj = raw as Record<string, unknown>;
      const productId = Number(itemObj.productId);
      const quantity = Math.floor(Number(itemObj.quantity) || 0);
      const variant = typeof itemObj.variant === 'string' ? itemObj.variant.trim() : 'Standard';
      const product = db.products.find((p) => p.id === productId && p.status === 'Active');
      if (!product || quantity <= 0) {
        res.status(400).json({ error: 'Invalid product or quantity in cart.' });
        return;
      }
      if (product.productType === 'affiliate') {
        res.status(400).json({ error: `${product.name} is an affiliate product and must be purchased via its external Buy Now link.` });
        return;
      }
      if (product.stock < quantity) {
        res.status(409).json({ error: `Insufficient stock for ${product.name}.` });
        return;
      }
      const unitPrice =
        product.discountPrice !== null && product.discountPrice < product.regularPrice
          ? product.discountPrice
          : product.regularPrice;

      orderItems.push({
        productId: product.id,
        code: product.code,
        sku: product.sku,
        name: product.name,
        variant: variant || product.variants[0] || 'Standard',
        unitPrice,
        quantity,
        image: product.image,
      });
    }

    const subtotal = orderItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    let discountAmount = 0;
    let appliedCouponCode = '';
    if (couponCode) {
      const coupon = db.coupons.find(
        (c) => c.active && c.code.toUpperCase() === couponCode && subtotal >= c.minOrder
      );
      if (coupon) {
        discountAmount = Math.round((subtotal * coupon.discountPercent) / 100);
        appliedCouponCode = coupon.code;
      }
    }

    const qualifiesFree = subtotal >= db.settings.free_delivery_threshold;
    const deliveryFee = qualifiesFree
      ? 0
      : deliveryZone === 'dhaka'
      ? db.settings.delivery_charge_dhaka
      : db.settings.delivery_charge_outside;

    const total = Math.max(0, subtotal - discountAmount) + deliveryFee;
    const orderId = `SNX-ORD-${crypto.randomInt(100000, 999999)}`;
    const now = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const paymentStatus: PaymentStatus =
      paymentMethod === 'COD' ? 'COD Unpaid' : 'Pending Verification';

    const newOrder: Order = {
      orderId,
      customerName,
      phone,
      email,
      district,
      area,
      fullAddress,
      deliveryZone,
      paymentMethod,
      paymentStatus,
      orderStatus: 'Pending',
      trxId,
      couponCode: appliedCouponCode,
      discountAmount,
      deliveryFee,
      subtotal,
      total,
      items: orderItems,
      createdAt: now,
    };

    for (const ordered of orderItems) {
      const product = db.products.find((p) => p.id === ordered.productId);
      if (product) {
        const prevStock = product.stock;
        product.stock = Math.max(0, product.stock - ordered.quantity);
        db.stockHistory.unshift({
          id: Date.now() + product.id,
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          variant: ordered.variant,
          change: -ordered.quantity,
          prevStock,
          newStock: product.stock,
          reason: `Guest Order ${orderId}`,
          admin: 'Guest Checkout',
          date: now,
        });
      }
    }

    db.orders.unshift(newOrder);
    persistDatabase();
    res.status(201).json({ order: newOrder });
  });

  app.post('/api/orders/track', (req, res) => {
    const query = typeof req.body?.query === 'string' ? req.body.query.trim().toLowerCase() : '';
    if (!query || query.length < 4) {
      res.status(400).json({ error: 'Enter at least 4 characters of your Order ID or phone number.' });
      return;
    }
    const matches = db.orders
      .filter(
        (o) =>
          o.orderId.toLowerCase() === query ||
          o.phone.toLowerCase().replace(/\D/g, '') === query.replace(/\D/g, '')
      )
      .map((o) => ({
        orderId: o.orderId,
        customerName: o.customerName,
        district: o.district,
        orderStatus: o.orderStatus,
        paymentStatus: o.paymentStatus,
        paymentMethod: o.paymentMethod,
        total: o.total,
        createdAt: o.createdAt,
        items: o.items,
      }));
    res.json({ orders: matches });
  });

  app.post('/api/reviews', (req, res) => {
    const productId = Number(req.body?.productId);
    const author = typeof req.body?.author === 'string' ? req.body.author.trim() : '';
    const comment = typeof req.body?.comment === 'string' ? req.body.comment.trim() : '';
    const rating = Math.min(5, Math.max(1, Math.round(Number(req.body?.rating) || 5)));

    if (!db.products.some((p) => p.id === productId) || !author || !comment) {
      res.status(400).json({ error: 'Product, author, and review comment are required.' });
      return;
    }

    const review: ProductReview = {
      id: `rev-${Date.now()}`,
      productId,
      author,
      rating,
      comment,
      date: new Date().toISOString().slice(0, 10),
    };
    db.reviews.unshift(review);
    persistDatabase();
    res.status(201).json({ review });
  });

  app.post('/api/contact', (req, res) => {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const phone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : '';
    const subject = typeof req.body?.subject === 'string' ? req.body.subject.trim() : '';
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';

    if (!name || !phone || !message) {
      res.status(400).json({ error: 'Name, phone, and message are required.' });
      return;
    }

    const entry: ContactMessage = {
      id: Date.now(),
      name,
      email: '',
      phone,
      subject: subject || 'Storefront Inquiry',
      message,
      status: 'Unread',
      createdAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
    };
    db.messages.unshift(entry);
    persistDatabase();
    res.status(201).json({ ok: true });
  });

  app.post('/api/newsletter', (req, res) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!email || !email.includes('@')) {
      res.status(400).json({ error: 'Valid email address is required.' });
      return;
    }
    if (!db.newsletterEmails.includes(email)) {
      db.newsletterEmails.push(email);
      persistDatabase();
    }
    res.status(201).json({ ok: true });
  });

  // =========================================================================
  // ADMIN 3-STEP AUTHENTICATION ROUTES (USERNAME + PASSWORD -> GMAIL OTP)
  // =========================================================================

  app.get('/api/admin/auth/status', (_req, res) => {
    res.json({
      configured: isAdminConfigured(),
      emailProviderConfigured: hasEmailProviderConfigured(),
    });
  });

  app.post('/api/admin/auth/bootstrap', async (req, res) => {
    const ip = req.ip || 'unknown';
    if (!checkRateLimit(ip)) {
      res.status(429).json({ error: 'অতিরিক্ত চেষ্টা করা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।' });
      return;
    }

    if (isAdminConfigured()) {
      res.status(409).json({ error: 'অ্যাডমিন অ্যাকাউন্ট ইতিমধ্যেই সেট করা আছে।' });
      return;
    }

    const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';

    if (username.length < 3 || password.length < 8) {
      res.status(400).json({
        error: 'ইউজারনেম কমপক্ষে ৩ অক্ষরের এবং পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে।',
      });
      return;
    }

    if (!email || !safeEqualText(email, ADMIN_OTP_EMAIL)) {
      res.status(403).json({
        error: 'ভুল জিমেইল! শুধুমাত্র অনুমোদিত অ্যাডমিন জিমেইল দিয়েই ভেরিফাই করা যাবে।',
      });
      return;
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = hashPassword(password, salt);

    // Defer committing db.adminCredential until 3rd-step OTP is verified
    const otp = crypto.randomInt(100000, 1000000).toString();
    const otpSalt = crypto.randomBytes(16).toString('hex');
    const challengeToken = crypto.randomBytes(32).toString('hex');
    otpChallenges.set(challengeToken, {
      username,
      otpHash: hashOtp(otp, otpSalt),
      salt: otpSalt,
      expiresAt: Date.now() + 5 * 60 * 1000,
      attemptsLeft: 5,
      lastSentAt: Date.now(),
      pendingCredential: {
        username,
        passwordHash,
        passwordSalt: salt,
      },
    });

    try {
      const deliveryMode = await sendEmailOtp(otp);
      res.json({
        step: 'otp_required',
        challengeToken,
        expiresInSeconds: 300,
        deliveryMode,
      });
    } catch (err) {
      console.error('OTP send error:', err);
      otpChallenges.delete(challengeToken);
      res.status(502).json({
        error: 'জিমেইল OTP পাঠানো যায়নি। GMAIL_USER ও GMAIL_APP_PASSWORD সেটিংস পরীক্ষা করুন।',
      });
    }
  });

  app.post('/api/admin/auth/login', async (req, res) => {
    const ip = req.ip || 'unknown';
    if (!checkRateLimit(ip)) {
      res.status(429).json({ error: 'অতিরিক্ত লগইন চেষ্টা করা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।' });
      return;
    }

    if (!isAdminConfigured()) {
      res.status(400).json({ error: 'অ্যাডমিন অ্যাকাউন্ট এখনো তৈরি করা হয়নি।' });
      return;
    }

    const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';

    if (!username || !password || !email) {
      res.status(400).json({
        error: 'অ্যাডমিন ইউজারনেম, পাসওয়ার্ড এবং ভেরিফিকেশন জিমেইল দিন।',
      });
      return;
    }

    if (!safeEqualText(email, ADMIN_OTP_EMAIL)) {
      res.status(403).json({
        error: 'ভুল জিমেইল! শুধুমাত্র অনুমোদিত অ্যাডমিন জিমেইল দিয়েই ভেরিফাই করা যাবে।',
      });
      return;
    }

    let validCredentials = false;
    if (hasEnvAdminCredentials()) {
      const envUser = process.env.ADMIN_USERNAME!.trim();
      const envPass = process.env.ADMIN_PASSWORD!;
      validCredentials = safeEqualText(username, envUser) && safeEqualText(password, envPass);
    } else if (db.adminCredential) {
      const expectedHash = hashPassword(password, db.adminCredential.passwordSalt);
      validCredentials =
        safeEqualText(username, db.adminCredential.username) &&
        safeEqualText(expectedHash, db.adminCredential.passwordHash);
    }

    if (!validCredentials) {
      res.status(401).json({ error: 'অ্যাডমিন ইউজারনেম বা পাসওয়ার্ড সঠিক নয়।' });
      return;
    }

    const otp = crypto.randomInt(100000, 1000000).toString();
    const otpSalt = crypto.randomBytes(16).toString('hex');
    const challengeToken = crypto.randomBytes(32).toString('hex');
    otpChallenges.set(challengeToken, {
      username,
      otpHash: hashOtp(otp, otpSalt),
      salt: otpSalt,
      expiresAt: Date.now() + 5 * 60 * 1000,
      attemptsLeft: 5,
      lastSentAt: Date.now(),
    });

    try {
      const deliveryMode = await sendEmailOtp(otp);
      res.json({
        step: 'otp_required',
        challengeToken,
        expiresInSeconds: 300,
        deliveryMode,
      });
    } catch (err) {
      console.error('OTP send error:', err);
      otpChallenges.delete(challengeToken);
      res.status(502).json({
        error: 'জিমেইল OTP পাঠানো যায়নি। GMAIL_USER ও GMAIL_APP_PASSWORD সেটিংস পরীক্ষা করুন।',
      });
    }
  });

  app.post('/api/admin/auth/resend-otp', async (req, res) => {
    const challengeToken =
      typeof req.body?.challengeToken === 'string' ? req.body.challengeToken.trim() : '';
    const challenge = otpChallenges.get(challengeToken);
    if (!challenge) {
      res.status(400).json({ error: 'ভেরিফিকেশন সেশনের মেয়াদ শেষ হয়েছে। অনুগ্রহ করে আবার সাইন ইন করুন।' });
      return;
    }
    if (Date.now() - challenge.lastSentAt < 45 * 1000) {
      res.status(429).json({ error: 'নতুন OTP পাঠাতে ৪৫ সেকেন্ড অপেক্ষা করুন।' });
      return;
    }

    const otp = crypto.randomInt(100000, 1000000).toString();
    const otpSalt = crypto.randomBytes(16).toString('hex');
    challenge.otpHash = hashOtp(otp, otpSalt);
    challenge.salt = otpSalt;
    challenge.expiresAt = Date.now() + 5 * 60 * 1000;
    challenge.attemptsLeft = 5;
    challenge.lastSentAt = Date.now();

    try {
      const deliveryMode = await sendEmailOtp(otp);
      res.json({
        expiresInSeconds: 300,
        deliveryMode,
      });
    } catch {
      res.status(502).json({
        error: 'নতুন জিমেইল OTP পাঠানো যায়নি।',
      });
    }
  });

  app.post('/api/admin/auth/verify-otp', (req, res) => {
    const challengeToken =
      typeof req.body?.challengeToken === 'string' ? req.body.challengeToken.trim() : '';
    const otp = typeof req.body?.otp === 'string' ? req.body.otp.trim() : '';

    if (!challengeToken || !/^\d{6}$/.test(otp)) {
      res.status(400).json({ error: '৬ ডিজিটের জিমেইল OTP কোড দিন।' });
      return;
    }

    const challenge = otpChallenges.get(challengeToken);
    if (!challenge) {
      res.status(401).json({ error: 'OTP সেশন সঠিক নয় বা মেয়াদ শেষ হয়েছে।' });
      return;
    }

    if (Date.now() > challenge.expiresAt) {
      otpChallenges.delete(challengeToken);
      res.status(401).json({ error: 'OTP কোডের মেয়াদ শেষ হয়ে গেছে। আবার চেষ্টা করুন।' });
      return;
    }

    if (challenge.attemptsLeft <= 0) {
      otpChallenges.delete(challengeToken);
      res.status(429).json({ error: 'অতিরিক্ত ভুল OTP চেষ্টা করা হয়েছে। আবার লগইন করুন।' });
      return;
    }

    const candidateHash = hashOtp(otp, challenge.salt);
    if (!safeEqualText(candidateHash, challenge.otpHash)) {
      challenge.attemptsLeft -= 1;
      if (challenge.attemptsLeft <= 0) {
        otpChallenges.delete(challengeToken);
      }
      res.status(401).json({
        error: `ভুল OTP কোড! আর ${Math.max(0, challenge.attemptsLeft)} বার চেষ্টা করা যাবে।`,
      });
      return;
    }

    if (challenge.pendingCredential && !isAdminConfigured()) {
      db.adminCredential = {
        ...challenge.pendingCredential,
        createdAt: new Date().toISOString(),
      };
      persistDatabase();
    }

    otpChallenges.delete(challengeToken);
    const session = createSignedSessionToken(challenge.username);
    res.json({
      token: session.token,
      adminUsername: challenge.username,
      expiresAt: session.expiresAt,
    });
  });

  // =========================================================================
  // PROTECTED ADMIN DASHBOARD & PRODUCT MANAGEMENT ROUTES
  // =========================================================================

  app.post('/api/admin/logout', requireAdminAuth, (_req, res) => {
    const sessionId = res.locals.adminSessionId as string | undefined;
    if (sessionId) {
      adminSessions.delete(sessionId);
    }
    res.json({ ok: true });
  });

  app.get('/api/admin/dashboard', requireAdminAuth, (_req, res) => {
    res.json({
      products: db.products,
      categories: db.categories,
      coupons: db.coupons,
      orders: db.orders,
      messages: db.messages,
      stockHistory: db.stockHistory,
      settings: db.settings,
      adminUsername: res.locals.adminUser,
    });
  });

  app.post('/api/admin/upload-image', requireAdminAuth, (req, res) => {
    const dataUrl = typeof req.body?.dataUrl === 'string' ? req.body.dataUrl : '';
    const match = /^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
    if (!match) {
      res.status(400).json({ error: 'শুধুমাত্র PNG, JPG বা WebP ছবি আপলোড করা যাবে।' });
      return;
    }
    const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length === 0 || buffer.length > 2 * 1024 * 1024) {
      res.status(400).json({ error: 'ছবির সাইজ সর্বোচ্চ ২ মেগাবাইট হতে হবে।' });
      return;
    }

    ensureDataDir();
    const filename = `snx-${crypto.randomUUID()}.${ext}`;
    const targetPath = path.resolve(UPLOAD_DIR, filename);
    if (!targetPath.startsWith(UPLOAD_DIR + path.sep)) {
      res.status(400).json({ error: 'Invalid upload path.' });
      return;
    }
    fs.writeFileSync(targetPath, buffer);
    res.status(201).json({ url: `/uploads/${filename}` });
  });

  app.post('/api/admin/products', requireAdminAuth, (req, res) => {
    const sanitized = sanitizeProductInput((req.body || {}) as Record<string, unknown>);
    if (!sanitized) {
      res.status(400).json({
        error: 'পণ্যের তথ্য, ছবির লিংক অথবা অ্যাফিলিয়েট লিংক (https://...) সঠিক নয়।',
      });
      return;
    }

    const nextId = db.products.reduce((max, p) => Math.max(max, p.id), 0) + 1;
    const now = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const created: Product = {
      id: nextId,
      ...sanitized,
      createdAt: now,
    };

    db.products.unshift(created);
    db.stockHistory.unshift({
      id: Date.now(),
      productId: created.id,
      productName: created.name,
      sku: created.sku,
      variant: 'ALL',
      change: created.stock,
      prevStock: 0,
      newStock: created.stock,
      reason: created.productType === 'affiliate' ? 'Affiliate product added by Admin' : 'Product created by Admin',
      admin: String(res.locals.adminUser || 'Admin'),
      date: now,
    });
    persistDatabase();
    res.status(201).json({ product: created });
  });

  app.put('/api/admin/products/:id', requireAdminAuth, (req, res) => {
    const id = Number(req.params.id);
    const idx = db.products.findIndex((p) => p.id === id);
    if (idx === -1) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }

    const existing = db.products[idx];
    const sanitized = sanitizeProductInput((req.body || {}) as Record<string, unknown>, existing);
    if (!sanitized) {
      res.status(400).json({
        error: 'পণ্যের তথ্য, ছবির লিংক অথবা অ্যাফিলিয়েট লিংক (https://...) সঠিক নয়।',
      });
      return;
    }

    const updated: Product = {
      ...existing,
      ...sanitized,
      id: existing.id,
      createdAt: existing.createdAt,
    };

    if (updated.stock !== existing.stock) {
      const now = new Date().toISOString().slice(0, 16).replace('T', ' ');
      db.stockHistory.unshift({
        id: Date.now(),
        productId: updated.id,
        productName: updated.name,
        sku: updated.sku,
        variant: 'ALL',
        change: updated.stock - existing.stock,
        prevStock: existing.stock,
        newStock: updated.stock,
        reason:
          typeof req.body?.reason === 'string' && req.body.reason.trim()
            ? req.body.reason.trim()
            : 'Admin product update',
        admin: String(res.locals.adminUser || 'Admin'),
        date: now,
      });
    }

    db.products[idx] = updated;
    persistDatabase();
    res.json({ product: updated });
  });

  app.patch('/api/admin/orders/:orderId', requireAdminAuth, (req, res) => {
    const orderId = req.params.orderId;
    const order = db.orders.find((o) => o.orderId === orderId);
    if (!order) {
      res.status(404).json({ error: 'Order not found.' });
      return;
    }

    const allowedStatuses: OrderStatus[] = [
      'Pending',
      'Confirmed',
      'Shipped',
      'Delivered',
      'Cancelled',
    ];
    const nextOrderStatus = req.body?.orderStatus as OrderStatus;
    if (!allowedStatuses.includes(nextOrderStatus)) {
      res.status(400).json({ error: 'Invalid order status.' });
      return;
    }

    order.orderStatus = nextOrderStatus;
    if (nextOrderStatus === 'Confirmed' && order.paymentMethod !== 'COD') {
      order.paymentStatus = 'Verified';
    } else if (nextOrderStatus === 'Delivered') {
      order.paymentStatus = 'Paid';
    }

    persistDatabase();
    res.json({ order });
  });

  app.put('/api/admin/settings', requireAdminAuth, (req, res) => {
    const incoming = (req.body || {}) as Partial<StoreSettings>;
    if (incoming.hero_banner && !isSafeImageUrl(incoming.hero_banner)) {
      res.status(400).json({ error: 'Invalid hero banner URL.' });
      return;
    }
    if (incoming.secondary_banner && !isSafeImageUrl(incoming.secondary_banner)) {
      res.status(400).json({ error: 'Invalid secondary banner URL.' });
      return;
    }
    db.settings = {
      ...db.settings,
      ...incoming,
      delivery_charge_dhaka: Math.max(0, Number(incoming.delivery_charge_dhaka ?? db.settings.delivery_charge_dhaka) || 0),
      delivery_charge_outside: Math.max(0, Number(incoming.delivery_charge_outside ?? db.settings.delivery_charge_outside) || 0),
      free_delivery_threshold: Math.max(0, Number(incoming.free_delivery_threshold ?? db.settings.free_delivery_threshold) || 0),
    };
    persistDatabase();
    res.json({ settings: db.settings });
  });

  app.patch('/api/admin/messages/:id', requireAdminAuth, (req, res) => {
    const id = Number(req.params.id);
    const msg = db.messages.find((m) => m.id === id);
    if (!msg) {
      res.status(404).json({ error: 'Message not found.' });
      return;
    }
    msg.status = 'Replied';
    persistDatabase();
    res.json({ message: msg });
  });

  app.delete('/api/admin/products/:id', requireAdminAuth, (req, res) => {
    const id = Number(req.params.id);
    const idx = db.products.findIndex((p) => p.id === id);
    if (idx === -1) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }
    db.products.splice(idx, 1);
    persistDatabase();
    res.json({ ok: true });
  });

  app.post('/api/admin/coupons', requireAdminAuth, (req, res) => {
    const code = typeof req.body?.code === 'string' ? req.body.code.trim().toUpperCase() : '';
    const discountPercent = Math.min(90, Math.max(1, Math.round(Number(req.body?.discountPercent) || 0)));
    const minOrder = Math.max(0, Math.round(Number(req.body?.minOrder) || 0));
    const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';

    if (!/^[A-Z0-9_-]{3,20}$/.test(code)) {
      res.status(400).json({ error: 'কুপন কোড ৩–২০ অক্ষরের ইংরেজি/সংখ্যা হতে হবে।' });
      return;
    }
    const existing = db.coupons.find((c) => c.code === code);
    if (existing) {
      existing.discountPercent = discountPercent;
      existing.minOrder = minOrder;
      existing.description = description || existing.description;
      existing.active = true;
    } else {
      db.coupons.unshift({
        code,
        discountPercent,
        minOrder,
        description: description || `${discountPercent}% ছাড় (সর্বনিম্ন ৳${minOrder})`,
        active: true,
      });
    }
    persistDatabase();
    res.status(201).json({ coupons: db.coupons });
  });

  app.patch('/api/admin/coupons/:code', requireAdminAuth, (req, res) => {
    const code = String(req.params.code || '').trim().toUpperCase();
    const coupon = db.coupons.find((c) => c.code === code);
    if (!coupon) {
      res.status(404).json({ error: 'Coupon not found.' });
      return;
    }
    coupon.active = !coupon.active;
    persistDatabase();
    res.json({ coupon });
  });

  // =========================================================================
  // VITE DEV MIDDLEWARE OR PRODUCTION STATIC SERVING
  // =========================================================================

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SHOPNEXA server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
