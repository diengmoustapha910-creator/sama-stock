process.env.TZ = process.env.TZ || 'Africa/Dakar';

import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import crypto from 'crypto';
import dotenv from 'dotenv';
import {
  SamaStockDatabase,
  AccountRecord,
  QuotaExceededError,
  ForbiddenError,
} from './serverDb.ts';
import {
  getEmailTransportStatus,
  sendPasswordResetEmail,
} from './serverEmail.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const APP_ROOT = fs.existsSync(path.resolve(__dirname, 'package.json'))
  ? __dirname
  : process.cwd();

// Data persistence path (SQLite WAL)
const DATA_DIR = path.resolve(APP_ROOT, '.data');
const UNITECH_DATA_FILE = path.resolve(DATA_DIR, 'unitechpay_store.json');
const samaDb = new SamaStockDatabase(DATA_DIR);
samaDb.migrateLegacyUnitechStoreIfNeeded(UNITECH_DATA_FILE);

interface AuthenticatedRequest extends Request {
  account?: AccountRecord;
  activeEmployee?: any | null;
  sessionToken?: string;
}

const SESSION_COOKIE_NAME = '__session';
const SESSION_COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days

function computeSessionCsrfToken(sessionToken: string): string {
  const secret = (process.env.CSRF_SECRET || 'samastock-csrf-bound-v1').trim();
  return crypto.createHmac('sha256', secret).update(sessionToken).digest('hex');
}

// -------------------------------------------------------------
// In-Memory Sliding-Window Rate Limiter (mono-instance / fallback; Redis prêt dans migrations/003)
// -------------------------------------------------------------
class SlidingWindowRateLimiter {
  private buckets = new Map<string, number[]>();
  private maxEntries: number;

  constructor(maxEntries = 10000) {
    this.maxEntries = maxEntries;
  }

  private pruneKey(key: string, windowMs: number, now: number): number[] {
    const existing = this.buckets.get(key) || [];
    const recent = existing.filter((ts) => now - ts < windowMs);
    if (recent.length === 0) {
      this.buckets.delete(key);
    } else {
      this.buckets.set(key, recent);
    }
    return recent;
  }

  public isBlocked(key: string, maxAttempts: number, windowMs: number): {
    blocked: boolean;
    retryAfterSec: number;
  } {
    const now = Date.now();
    const recent = this.pruneKey(key, windowMs, now);
    if (recent.length >= maxAttempts) {
      const oldest = recent[0];
      const retryAfterSec = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
      return { blocked: true, retryAfterSec };
    }
    return { blocked: false, retryAfterSec: 0 };
  }

  public record(key: string, windowMs: number): void {
    const now = Date.now();
    if (this.buckets.size > this.maxEntries) {
      for (const k of this.buckets.keys()) {
        this.pruneKey(k, windowMs, now);
        if (this.buckets.size <= this.maxEntries * 0.8) break;
      }
    }
    const recent = this.pruneKey(key, windowMs, now);
    recent.push(now);
    this.buckets.set(key, recent);
  }

  public reset(key: string): void {
    this.buckets.delete(key);
  }
}

const loginFailLimiter = new SlidingWindowRateLimiter();
const loginIpLimiter = new SlidingWindowRateLimiter();
const registerLimiter = new SlidingWindowRateLimiter();
const changePasswordLimiter = new SlidingWindowRateLimiter();
const forgotIpLimiter = new SlidingWindowRateLimiter();
const forgotEmailLimiter = new SlidingWindowRateLimiter();
const resetSubmitLimiter = new SlidingWindowRateLimiter();
const pinFailLimiter = new SlidingWindowRateLimiter();
const webhookLimiter = new SlidingWindowRateLimiter();

function getClientIp(req: Request): string {
  // Utilise exclusivement req.ip résolu par Express avec `trust proxy: 1`
  // pour ignorer toute adresse X-Forwarded-For falsifiée injectée à gauche par un client.
  return String(req.ip || req.socket?.remoteAddress || '127.0.0.1').trim() || '127.0.0.1';
}

function parseCookies(req: Request): Record<string, string> {
  const header = req.headers.cookie;
  const result: Record<string, string> = {};
  if (!header || typeof header !== 'string') return result;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) {
      try {
        result[key] = decodeURIComponent(val);
      } catch {
        result[key] = val;
      }
    }
  }
  return result;
}

function extractSessionAuth(req: Request): {
  token: string;
  source: 'bearer' | 'cookie' | 'none';
} {
  const cookies = parseCookies(req);
  const authHeader = String(req.headers.authorization || '');
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    const bearer = authHeader.slice(7).trim();
    if (bearer) return { token: bearer, source: 'bearer' };
  }
  const customHeader = req.headers['x-session-token'];
  if (typeof customHeader === 'string' && customHeader.trim()) {
    return { token: customHeader.trim(), source: 'bearer' };
  }
  const cookieToken = cookies[SESSION_COOKIE_NAME] || '';
  if (cookieToken) {
    return { token: cookieToken, source: 'cookie' };
  }
  return { token: '', source: 'none' };
}

function extractSessionToken(req: Request): string {
  return extractSessionAuth(req).token;
}

function isHttpsRequest(req: Request): boolean {
  if (req.secure) return true;
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').toLowerCase();
  if (forwardedProto.includes('https')) return true;

  const origin = String(req.headers.origin || '').trim().toLowerCase();
  if (origin.startsWith('https://')) return true;

  const referer = String(req.headers.referer || '').trim().toLowerCase();
  if (referer.startsWith('https://')) return true;

  const host = String(req.headers['x-forwarded-host'] || req.get('host') || '')
    .toLowerCase()
    .split(':')[0]
    .trim();
  if (
    host === 'sama-stock.com' ||
    host === 'www.sama-stock.com' ||
    host.endsWith('.sama-stock.com') ||
    host.endsWith('.run.app') ||
    host.endsWith('.ai.studio') ||
    host.endsWith('.web.app') ||
    host.endsWith('.firebaseapp.com') ||
    host.endsWith('.googleusercontent.com') ||
    host.endsWith('.usercontent.goog')
  ) {
    return true;
  }

  return false;
}

function resolveCookieAttributes(req: Request): string {
  const isHttps = isHttpsRequest(req);
  const host = String(req.headers['x-forwarded-host'] || req.get('host') || '')
    .toLowerCase()
    .split(':')[0]
    .trim();
  const isEmbeddedHost =
    host.endsWith('.run.app') ||
    host.endsWith('.ai.studio') ||
    host.endsWith('.googleusercontent.com') ||
    host.endsWith('.usercontent.goog');
  const isCrossSite = req.headers['sec-fetch-site'] === 'cross-site' || isEmbeddedHost;
  const sameSite = isHttps && isCrossSite ? 'None' : 'Lax';
  const securePart = isHttps ? '; Secure' : '';
  const partitionedPart = isHttps && sameSite === 'None' ? '; Partitioned' : '';
  return `Path=/; HttpOnly; SameSite=${sameSite}${securePart}${partitionedPart}`;
}

function isTrustedPublicHost(hostname: string): boolean {
  const host = hostname.toLowerCase().split(':')[0];
  if (!host) return false;
  if (
    host === 'sama-stock.com' ||
    host === 'www.sama-stock.com' ||
    host.endsWith('.sama-stock.com') ||
    host.endsWith('.run.app') ||
    host.endsWith('.ai.studio') ||
    host.endsWith('.web.app') ||
    host.endsWith('.firebaseapp.com') ||
    host.endsWith('.googleusercontent.com') ||
    host.endsWith('.usercontent.goog')
  ) {
    return true;
  }
  if (process.env.NODE_ENV !== 'production' && (host === 'localhost' || host === '127.0.0.1')) {
    return true;
  }
  return false;
}

function resolveAppBaseUrl(req: Request): string {
  const envUrl = (process.env.APP_URL || '').trim().replace(/\/+$/, '');
  if (envUrl && /^https?:\/\//i.test(envUrl)) {
    try {
      const parsedEnv = new URL(envUrl);
      const envHost = parsedEnv.hostname.toLowerCase();
      if (
        envHost === 'sama-stock.com' ||
        envHost === 'www.sama-stock.com' ||
        envHost.endsWith('.sama-stock.com')
      ) {
        return envUrl;
      }
    } catch {
      // ignore invalid APP_URL
    }
  }
  const reqHost = String(req.headers['x-forwarded-host'] || req.get('host') || '').trim();
  const reqProto = isHttpsRequest(req) ? 'https' : 'http';
  if (reqHost && isTrustedPublicHost(reqHost)) {
    return `${reqProto}://${reqHost}`;
  }
  if (envUrl && /^https?:\/\//i.test(envUrl)) {
    return envUrl;
  }
  return 'https://sama-stock.com';
}

function maskEmailSafe(email: string): string {
  const clean = String(email || '').trim().toLowerCase();
  const idx = clean.indexOf('@');
  if (idx <= 0) return '***';
  return `${clean.slice(0, Math.min(2, idx))}***@${clean.slice(idx + 1)}`;
}

function setSessionCookie(req: Request, res: Response, token: string): string {
  const sessionAttrs = resolveCookieAttributes(req);
  const csrfToken = computeSessionCsrfToken(token);
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; ${sessionAttrs}; Max-Age=${SESSION_COOKIE_MAX_AGE_SECONDS}`
  );
  res.setHeader('X-CSRF-Token', csrfToken);
  return csrfToken;
}

function clearSessionCookie(req: Request, res: Response): void {
  const sessionAttrs = resolveCookieAttributes(req);
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE_NAME}=; ${sessionAttrs}; Max-Age=0`
  );
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const { token, source } = extractSessionAuth(req);
  if (!token) {
    console.info('[AUTH REQUIRED] Missing session token', {
      method: req.method,
      path: req.path,
      hasCookieHeader: Boolean(req.headers.cookie),
      isHttps: isHttpsRequest(req),
      forwardedHost: String(req.headers['x-forwarded-host'] || ''),
      forwardedProto: String(req.headers['x-forwarded-proto'] || ''),
      secFetchSite: String(req.headers['sec-fetch-site'] || ''),
    });
    res.status(401).json({
      success: false,
      code: 'AUTH_REQUIRED',
      error: 'Authentification requise. Veuillez vous connecter.',
    });
    return;
  }
  const ctx = samaDb.verifySessionContext(token);
  if (!ctx) {
    console.info('[AUTH REQUIRED] Expired or revoked session token', {
      method: req.method,
      path: req.path,
      source,
    });
    res.status(401).json({
      success: false,
      code: 'SESSION_EXPIRED',
      error: 'Session expirée ou invalide. Veuillez vous reconnecter.',
    });
    return;
  }
  const method = req.method.toUpperCase();
  const expectedCsrf = computeSessionCsrfToken(token);
  if (source === 'cookie' && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const csrfHeader = String(req.headers['x-csrf-token'] || '');
    if (!csrfHeader || !safeTimingEqual(expectedCsrf, csrfHeader)) {
      console.warn('[AUTH CSRF] Invalid or missing CSRF token', {
        method: req.method,
        path: req.path,
        accountId: ctx.account.id,
        hasCsrfHeader: Boolean(csrfHeader),
      });
      res.status(403).json({
        success: false,
        code: 'CSRF_TOKEN_INVALID',
        error: 'Jeton CSRF manquant ou invalide. Veuillez actualiser la page.',
      });
      return;
    }
  }
  req.account = ctx.account;
  req.activeEmployee = ctx.activeEmployee;
  req.sessionToken = token;
  next();
}

function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.account || req.account.role !== 'administrateur') {
    res.status(403).json({
      success: false,
      error: 'Accès refusé. Cette section est réservée exclusivement à l’administrateur principal.',
    });
    return;
  }
  next();
}

function handleMerchantMutationError(res: Response, err: any, fallbackMessage: string) {
  if (err instanceof QuotaExceededError || err?.code === 'QUOTA_EXCEEDED') {
    return res.status(403).json({
      success: false,
      code: 'QUOTA_EXCEEDED',
      quotaType: err.quotaType,
      limit: err.limit,
      current: err.current,
      planId: err.planId,
      planName: err.planName,
      upgradeSuggestedPlan: err.upgradeSuggestedPlan,
      error: err.message,
    });
  }
  if (err instanceof ForbiddenError || err?.code === 'FORBIDDEN_PERMISSION') {
    return res.status(403).json({
      success: false,
      code: 'FORBIDDEN_PERMISSION',
      error: err.message || 'Action non autorisée pour ce profil opérateur.',
    });
  }
  return res.status(400).json({
    success: false,
    error: err?.message || fallbackMessage,
  });
}

function getEffectiveUnitechApiUrl(): string {
  const envUrl = (process.env.UNITECHPAY_API_URL || '').trim();
  const dbCfg = samaDb.getUnitechPayConfig();
  return envUrl || (dbCfg.apiUrl || '').trim() || 'https://api.unitech.sn/api.php';
}

function getEffectiveUnitechApiKey(): string {
  const envKey = (process.env.UNITECHPAY_API_KEY || '').trim();
  if (envKey) return envKey;
  const dbCfg = samaDb.getUnitechPayConfig();
  return (dbCfg.apiKey || '').trim();
}

function maskPhoneForLog(phone?: string): string {
  const raw = String(phone || '').trim();
  if (raw.length <= 4) return '****';
  return `${'*'.repeat(Math.max(4, raw.length - 2))}${raw.slice(-2)}`;
}

function maskUrlForLog(rawUrl?: string): { host?: string; pathname?: string; hasQuery?: boolean } {
  if (!rawUrl || typeof rawUrl !== 'string') return {};
  try {
    const parsed = new URL(rawUrl);
    return {
      host: parsed.hostname,
      pathname: parsed.pathname,
      hasQuery: Boolean(parsed.search),
    };
  } catch {
    return {};
  }
}

function validateUnitechPaymentUrl(
  rawUrl: unknown,
  forbiddenValues: string[]
): { valid: true; hostname: string } | { valid: false; reason: string } {
  if (typeof rawUrl !== 'string' || rawUrl.length === 0) {
    return { valid: false, reason: 'data.payment_url est absent ou vide.' };
  }
  if (rawUrl !== rawUrl.trim()) {
    return { valid: false, reason: 'data.payment_url contient des espaces invalides.' };
  }
  const cleanForbidden = forbiddenValues.filter((v) => typeof v === 'string' && v.trim().length > 0);
  if (cleanForbidden.includes(rawUrl)) {
    return { valid: false, reason: 'data.payment_url correspond à une référence ou un identifiant, pas à une URL.' };
  }
  if (!/^https:\/\//i.test(rawUrl)) {
    return { valid: false, reason: 'data.payment_url doit utiliser le protocole HTTPS.' };
  }
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:') {
      return { valid: false, reason: 'Protocole non HTTPS détecté dans data.payment_url.' };
    }
    if (
      !parsed.hostname ||
      !parsed.hostname.includes('.') ||
      parsed.hostname === 'localhost' ||
      parsed.hostname === '127.0.0.1'
    ) {
      return { valid: false, reason: `Domaine invalide dans data.payment_url (${parsed.hostname || 'vide'}).` };
    }
    return { valid: true, hostname: parsed.hostname };
  } catch {
    return { valid: false, reason: 'Format URL invalide pour data.payment_url.' };
  }
}

function safeTimingEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const cleanA = a.trim().toLowerCase();
  const cleanB = b.trim().toLowerCase();
  const bufA = Buffer.from(cleanA, 'utf-8');
  const bufB = Buffer.from(cleanB, 'utf-8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function verifyUnitechPaySignature(
  req: any,
  apiKey: string,
  payload: any,
  preferredMethod: 'auto' | 'raw_body' | 'canonical_pipe' = 'auto'
): {
  valid: boolean;
  methodUsed: 'raw_body' | 'canonical_pipe' | 'none';
} {
  const headerSig = (
    req.headers['x-unitechpay-signature'] ||
    req.headers['x-signature'] ||
    ''
  ).toString();
  const payloadSig = (payload && payload.signature ? String(payload.signature) : '').toString();
  const receivedSig = headerSig || payloadSig;

  if (!receivedSig || !apiKey) {
    return { valid: false, methodUsed: 'none' };
  }

  const allowRawBody = preferredMethod === 'auto' || preferredMethod === 'raw_body';
  const allowCanonicalPipe = preferredMethod === 'auto' || preferredMethod === 'canonical_pipe';

  if (allowRawBody) {
    let rawBodyBuf: Buffer;
    if (req.rawBody && Buffer.isBuffer(req.rawBody)) {
      rawBodyBuf = req.rawBody;
    } else if (typeof req.rawBody === 'string') {
      rawBodyBuf = Buffer.from(req.rawBody, 'utf-8');
    } else {
      rawBodyBuf = Buffer.from(JSON.stringify(payload), 'utf-8');
    }
    const hmacRawHex = crypto.createHmac('sha256', apiKey).update(rawBodyBuf).digest('hex');

    if (
      safeTimingEqual(hmacRawHex, receivedSig) ||
      safeTimingEqual(hmacRawHex, headerSig) ||
      safeTimingEqual(hmacRawHex, payloadSig)
    ) {
      return { valid: true, methodUsed: 'raw_body' };
    }
  }

  if (allowCanonicalPipe) {
    const event = payload?.event || '';
    const ref = payload?.reference || '';
    const amt = payload?.amount !== undefined ? String(payload.amount) : '';
    const stat = payload?.status || '';
    const signedAt = payload?.signed_at !== undefined ? String(payload.signed_at) : '';
    const canonicalString = `${event}|${ref}|${amt}|${stat}|${signedAt}`;
    const hmacCanonicalHex = crypto.createHmac('sha256', apiKey).update(canonicalString).digest('hex');

    if (
      safeTimingEqual(hmacCanonicalHex, receivedSig) ||
      safeTimingEqual(hmacCanonicalHex, payloadSig) ||
      safeTimingEqual(hmacCanonicalHex, headerSig)
    ) {
      return { valid: true, methodUsed: 'canonical_pipe' };
    }
  }

  return { valid: false, methodUsed: 'none' };
}

function isAllowedOrigin(originHeader: string, reqHostHeader?: string): boolean {
  try {
    const parsed = new URL(originHeader);
    const hostname = parsed.hostname.toLowerCase();
    if (reqHostHeader && parsed.host.toLowerCase() === reqHostHeader.toLowerCase()) {
      return true;
    }
    const appUrl = (process.env.APP_URL || '').trim();
    if (appUrl && /^https?:\/\//i.test(appUrl)) {
      try {
        if (new URL(appUrl).origin === parsed.origin) return true;
      } catch {
        // ignore invalid APP_URL
      }
    }
    if (
      hostname === 'sama-stock.com' ||
      hostname === 'www.sama-stock.com' ||
      hostname.endsWith('.sama-stock.com') ||
      hostname === 'aistudio.google.com' ||
      hostname.endsWith('.googleusercontent.com') ||
      hostname.endsWith('.usercontent.goog')
    ) {
      return parsed.protocol === 'https:';
    }
    if (process.env.NODE_ENV !== 'production') {
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

function resolveServerPort(): number {
  const portArgIdx = process.argv.findIndex((arg) => arg === '--port' || arg.startsWith('--port='));
  if (portArgIdx !== -1) {
    const arg = process.argv[portArgIdx];
    const val = arg.includes('=') ? arg.split('=')[1] : process.argv[portArgIdx + 1];
    const parsed = Number(val);
    if (!Number.isNaN(parsed) && parsed > 0) return parsed;
  }
  const envPort = Number(process.env.PORT);
  if (process.env.NODE_ENV === 'production' && !Number.isNaN(envPort) && envPort > 0) {
    return envPort;
  }
  if (!Number.isNaN(envPort) && envPort > 0 && envPort !== 8080) {
    return envPort;
  }
  return 3000;
}

async function startServer() {
  const app = express();
  const PORT = resolveServerPort();

  // Behind Cloud Run & Firebase Hosting reverse proxies
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  const isProd = process.env.NODE_ENV === 'production';

  // Security headers (compatible with AI Studio iframe, PWA camera barcode scanner & custom HTTPS domains)
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()');

    const scriptSrc = isProd ? "script-src 'self'" : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";
    const connectSrc = isProd ? "connect-src 'self' https:" : "connect-src 'self' https: ws: wss:";
    res.setHeader(
      'Content-Security-Policy',
      `default-src 'self'; ${scriptSrc}; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: https:; ${connectSrc}; frame-ancestors 'self' https://aistudio.google.com https://*.google.com https://*.googleusercontent.com https://*.usercontent.goog`
    );

    if (isProd && isHttpsRequest(req)) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  });

  // Strict CORS / Origin validation & CDN no-store on /api/*
  app.use('/api', (req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', 'private, no-store');
    if (req.path === '/webhooks/unitechpay' || req.path === '/health') {
      next();
      return;
    }
    const origin = req.headers.origin;
    if (typeof origin === 'string' && origin.trim()) {
      const hostHeader = String(req.headers['x-forwarded-host'] || req.get('host') || '');
      if (!isAllowedOrigin(origin.trim(), hostHeader)) {
        res.status(403).json({
          success: false,
          error: 'Origine non autorisée.',
        });
        return;
      }
      res.setHeader('Access-Control-Allow-Origin', origin.trim());
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Session-Token, X-CSRF-Token');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
      }
    }
    next();
  });

  // Custom body parser preserving rawBody for HMAC-SHA256 signature verification
  app.use(
    express.json({
      limit: '5mb',
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    })
  );
  app.use(
    express.urlencoded({
      extended: true,
      limit: '5mb',
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    })
  );

  // Request logger for API calls
  app.use((req, _res, next) => {
    if (req.path.startsWith('/api/')) {
      console.log(`[API ${req.method}] ${req.path}`);
    }
    next();
  });

  // -------------------------------------------------------------
  // Health Check
  // -------------------------------------------------------------
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
      service: 'SAMA STOCK API & UnitechPay Gateway',
    });
  });

  // =============================================================
  // AUTHENTICATION & INDEPENDENT MERCHANT ACCOUNTS
  // =============================================================

  app.post('/api/auth/register', (req: Request, res: Response) => {
    const ip = getClientIp(req);
    const limitCheck = registerLimiter.isBlocked(`reg:${ip}`, 8, 60 * 60 * 1000);
    if (limitCheck.blocked) {
      res.setHeader('Retry-After', String(limitCheck.retryAfterSec));
      return res.status(429).json({
        success: false,
        error: 'Trop de tentatives de création de compte. Veuillez réessayer ultérieurement.',
      });
    }
    registerLimiter.record(`reg:${ip}`, 60 * 60 * 1000);

    try {
      const { name, email, phone, businessName, storeName, password } = req.body || {};
      const session = samaDb.registerMerchant({
        name,
        email,
        phone,
        businessName,
        storeName,
        password,
      });
      const csrfToken = setSessionCookie(req, res, session.token);
      const workspace = samaDb.getMerchantWorkspace(session.account.id);
      const ctx = samaDb.verifySessionContext(session.token);
      return res.status(201).json({
        success: true,
        csrfToken,
        account: session.account,
        activeOperator: ctx?.activeEmployee || null,
        workspace,
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        error: err?.message || 'Impossible de créer le compte commerçant.',
      });
    }
  });

  app.post('/api/auth/login', (req: Request, res: Response) => {
    const ip = getClientIp(req);
    const identifier = String(req.body?.identifier || '').trim();
    const normId = identifier.toLowerCase();
    const failKey = `login_fail:${ip}:${normId}`;
    const ipKey = `login_ip:${ip}`;

    const ipCheck = loginIpLimiter.isBlocked(ipKey, 25, 15 * 60 * 1000);
    if (ipCheck.blocked) {
      console.warn('[AUTH LOGIN] IP rate limit reached', { ip });
      res.setHeader('Retry-After', String(ipCheck.retryAfterSec));
      return res.status(429).json({
        success: false,
        error: 'Trop de tentatives de connexion depuis cette adresse. Réessayez dans quelques minutes.',
      });
    }

    const failCheck = loginFailLimiter.isBlocked(failKey, 5, 15 * 60 * 1000);
    if (failCheck.blocked) {
      console.warn('[AUTH LOGIN] Account-IP lockout active', { ip });
      res.setHeader('Retry-After', String(failCheck.retryAfterSec));
      return res.status(429).json({
        success: false,
        error: `Compte temporairement protégé après plusieurs échecs. Réessayez dans ${Math.ceil(failCheck.retryAfterSec / 60)} minute(s).`,
      });
    }

    loginIpLimiter.record(ipKey, 15 * 60 * 1000);

    try {
      const { password } = req.body || {};
      const session = samaDb.loginWithPassword(identifier, String(password || ''), { ip });
      if (!session) {
        loginFailLimiter.record(failKey, 15 * 60 * 1000);
        return res.status(401).json({
          success: false,
          error: 'Identifiant ou mot de passe incorrect.',
        });
      }

      loginFailLimiter.reset(failKey);
      const csrfToken = setSessionCookie(req, res, session.token);
      const workspace = samaDb.getMerchantWorkspace(session.account.id);
      const ctx = samaDb.verifySessionContext(session.token);
      return res.json({
        success: true,
        csrfToken,
        account: session.account,
        activeOperator: ctx?.activeEmployee || null,
        workspace,
      });
    } catch (err) {
      console.error('[AUTH LOGIN ERROR]', err);
      return res.status(500).json({
        success: false,
        error: 'Erreur interne lors de la connexion.',
      });
    }
  });

  app.post('/api/auth/forgot-password', async (req: Request, res: Response) => {
    const ip = getClientIp(req);
    const ipCheck = forgotIpLimiter.isBlocked(`forgot_ip:${ip}`, 10, 15 * 60 * 1000);
    if (ipCheck.blocked) {
      console.warn('[AUTH FORGOT] IP rate limit reached', { ip });
      res.setHeader('Retry-After', String(ipCheck.retryAfterSec));
      return res.status(429).json({
        success: false,
        error: 'Trop de demandes de réinitialisation. Veuillez patienter quelques minutes avant de réessayer.',
      });
    }

    const rawEmail = String(req.body?.email || '')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .trim()
      .toLowerCase();

    if (!rawEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
      return res.status(400).json({
        success: false,
        error: 'Veuillez saisir une adresse e-mail valide.',
      });
    }

    const emailStatus = getEmailTransportStatus();
    if (!emailStatus.configured) {
      console.error('[AUTH FORGOT] Transport e-mail non configuré.', {
        ip,
        emailMasked: maskEmailSafe(rawEmail),
        missingVars: emailStatus.missingVars,
      });
      return res.status(422).json({
        success: false,
        code: 'EMAIL_SERVICE_UNCONFIGURED',
        error:
          "Le service d'envoi d'e-mails (support@sama-stock.com) n'est pas encore configuré sur le serveur. Renseignez BREVO_API_KEY, RESEND_API_KEY ou les identifiants SMTP dans l'environnement.",
      });
    }

    forgotIpLimiter.record(`forgot_ip:${ip}`, 15 * 60 * 1000);

    const genericSuccessMessage =
      "Si un compte actif est associé à cette adresse e-mail, un lien de réinitialisation valable 15 minutes vient d'être envoyé.";

    const emailKey = `forgot_email:${rawEmail}`;
    const emailLimit = forgotEmailLimiter.isBlocked(emailKey, 3, 15 * 60 * 1000);
    if (emailLimit.blocked) {
      console.warn('[AUTH FORGOT] Email rate limit reached (returning neutral response)', {
        emailMasked: maskEmailSafe(rawEmail),
        ip,
      });
      return res.json({
        success: true,
        message: genericSuccessMessage,
      });
    }
    forgotEmailLimiter.record(emailKey, 15 * 60 * 1000);

    try {
      const account = samaDb.findActiveAccountByEmail(rawEmail);
      if (!account || !account.email) {
        console.info('[AUTH FORGOT] Request received for unknown/inactive email', {
          emailMasked: maskEmailSafe(rawEmail),
          ip,
        });
        return res.json({
          success: true,
          message: genericSuccessMessage,
        });
      }

      const tokenRecord = samaDb.createPasswordResetToken(account.id, ip, 15);
      const baseUrl = resolveAppBaseUrl(req);
      const resetUrl = `${baseUrl}/?reset_token=${encodeURIComponent(tokenRecord.rawToken)}`;

      try {
        const delivery = await sendPasswordResetEmail({
          toEmail: account.email,
          userName: account.name,
          resetUrl,
          expiresMinutes: 15,
        });

        console.info('[AUTH FORGOT] Reset email dispatched', {
          accountId: account.id,
          role: account.role,
          emailMasked: maskEmailSafe(account.email),
          provider: delivery.provider,
          messageId: delivery.messageId,
          expiresAt: tokenRecord.expiresAt,
          ip,
        });
      } catch (mailErr: any) {
        samaDb.revokePasswordResetTokenById(tokenRecord.id);
        console.error('[AUTH FORGOT] Email delivery failed', {
          accountId: account.id,
          emailMasked: maskEmailSafe(account.email),
          provider: emailStatus.provider,
          error: mailErr?.message || 'Unknown mail error',
        });
        return res.status(500).json({
          success: false,
          code: 'EMAIL_DELIVERY_FAILED',
          error:
            "L'envoi de l'e-mail via le fournisseur configuré a échoué. Vérifiez la clé API / configuration SMTP et le domaine expéditeur support@sama-stock.com.",
        });
      }

      return res.json({
        success: true,
        message: genericSuccessMessage,
      });
    } catch (err: any) {
      console.error('[AUTH FORGOT ERROR]', err?.message || err);
      return res.status(500).json({
        success: false,
        error: 'Erreur interne lors du traitement de la demande.',
      });
    }
  });

  app.get('/api/auth/reset-password/validate', (req: Request, res: Response) => {
    const ip = getClientIp(req);
    const checkLimit = resetSubmitLimiter.isBlocked(`reset_val:${ip}`, 25, 15 * 60 * 1000);
    if (checkLimit.blocked) {
      res.setHeader('Retry-After', String(checkLimit.retryAfterSec));
      return res.status(429).json({
        valid: false,
        error: 'Trop de tentatives. Veuillez réessayer dans quelques minutes.',
      });
    }
    resetSubmitLimiter.record(`reset_val:${ip}`, 15 * 60 * 1000);

    const token = String(req.query?.token || '').trim();
    const validation = samaDb.validatePasswordResetToken(token);
    if (!validation.valid) {
      const errMsg =
        validation.reason === 'expired'
          ? 'Ce lien de réinitialisation a expiré (validité 15 minutes). Veuillez faire une nouvelle demande.'
          : validation.reason === 'used'
          ? 'Ce lien de réinitialisation a déjà été utilisé.'
          : 'Lien de réinitialisation invalide ou expiré.';
      return res.status(400).json({
        valid: false,
        reason: validation.reason,
        error: errMsg,
      });
    }
    return res.json({
      valid: true,
      expiresAt: validation.expiresAt,
    });
  });

  app.post('/api/auth/reset-password', (req: Request, res: Response) => {
    const ip = getClientIp(req);
    const limitCheck = resetSubmitLimiter.isBlocked(`reset_sub:${ip}`, 10, 15 * 60 * 1000);
    if (limitCheck.blocked) {
      res.setHeader('Retry-After', String(limitCheck.retryAfterSec));
      return res.status(429).json({
        success: false,
        error: 'Trop de tentatives de réinitialisation. Veuillez patienter quelques minutes.',
      });
    }
    resetSubmitLimiter.record(`reset_sub:${ip}`, 15 * 60 * 1000);

    try {
      const token = String(req.body?.token || '').trim();
      const newPassword = String(req.body?.newPassword || '');
      const confirmPassword = String(req.body?.confirmPassword || '');

      if (!newPassword || newPassword.length < 8) {
        return res.status(400).json({
          success: false,
          error: 'Le nouveau mot de passe doit contenir au moins 8 caractères.',
        });
      }
      if (newPassword !== confirmPassword) {
        return res.status(400).json({
          success: false,
          error: 'La confirmation ne correspond pas au nouveau mot de passe.',
        });
      }

      const result = samaDb.completePasswordReset(token, newPassword, ip);
      clearSessionCookie(req, res);

      // Clear failed login lockouts for that email/IP so user can immediately sign in
      if (result.email) {
        loginFailLimiter.reset(`login_fail:${ip}:${result.email.toLowerCase()}`);
      }

      return res.json({
        success: true,
        message:
          'Votre mot de passe a été réinitialisé avec succès. Toutes vos sessions précédentes ont été déconnectées. Vous pouvez maintenant vous connecter.',
      });
    } catch (err: any) {
      console.warn('[AUTH RESET FAILED]', {
        ip,
        reason: err?.message || 'Invalid reset token',
      });
      return res.status(400).json({
        success: false,
        error: err?.message || 'Impossible de réinitialiser le mot de passe avec ce lien.',
      });
    }
  });

  app.post('/api/auth/logout', (req: AuthenticatedRequest, res: Response) => {
    const auth = extractSessionAuth(req);
    if (auth.source === 'cookie' && auth.token) {
      const expectedCsrf = computeSessionCsrfToken(auth.token);
      const csrfHeader = String(req.headers['x-csrf-token'] || '');
      if (!csrfHeader || !safeTimingEqual(expectedCsrf, csrfHeader)) {
        return res.status(403).json({
          success: false,
          code: 'CSRF_TOKEN_INVALID',
          error: 'Jeton CSRF manquant ou invalide.',
        });
      }
    }
    if (auth.token) {
      samaDb.revokeSessionToken(auth.token);
    }
    clearSessionCookie(req, res);
    return res.json({ success: true });
  });

  app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const csrfToken = req.sessionToken ? computeSessionCsrfToken(req.sessionToken) : '';
    return res.json({
      success: true,
      csrfToken,
      account: req.account,
      activeOperator: req.activeEmployee || null,
    });
  });

  app.put('/api/auth/profile', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      const updated = samaDb.updateOwnProfile(req.account!.id, {
        name: req.body?.name,
        email: req.body?.email,
        phone: req.body?.phone,
      });
      return res.json({
        success: true,
        account: updated,
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        error: err?.message || 'Impossible de mettre à jour le profil.',
      });
    }
  });

  app.post('/api/auth/change-password', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const limitKey = `chpwd:${req.account!.id}`;
    const check = changePasswordLimiter.isBlocked(limitKey, 6, 15 * 60 * 1000);
    if (check.blocked) {
      res.setHeader('Retry-After', String(check.retryAfterSec));
      return res.status(429).json({
        success: false,
        error: 'Trop de tentatives de modification du mot de passe. Réessayez plus tard.',
      });
    }
    changePasswordLimiter.record(limitKey, 15 * 60 * 1000);

    try {
      const currentPassword = String(req.body?.currentPassword || '');
      const newPassword = String(req.body?.newPassword || '');
      const hasConfirmField = req.body && Object.prototype.hasOwnProperty.call(req.body, 'confirmPassword');
      const confirmPassword = hasConfirmField ? String(req.body.confirmPassword || '') : newPassword;

      if (!currentPassword) {
        return res.status(400).json({
          success: false,
          error: 'Veuillez saisir votre mot de passe actuel.',
        });
      }
      if (!newPassword || newPassword.length < 8) {
        return res.status(400).json({
          success: false,
          error: 'Le nouveau mot de passe doit contenir au moins 8 caractères.',
        });
      }
      if (newPassword.length > 128) {
        return res.status(400).json({
          success: false,
          error: 'Le nouveau mot de passe ne doit pas dépasser 128 caractères.',
        });
      }
      if (newPassword !== confirmPassword) {
        return res.status(400).json({
          success: false,
          error: 'La confirmation ne correspond pas au nouveau mot de passe.',
        });
      }
      if (newPassword === currentPassword) {
        return res.status(400).json({
          success: false,
          error: 'Le nouveau mot de passe doit être différent du mot de passe actuel.',
        });
      }

      const newSession = samaDb.changeOwnPassword(
        req.account!.id,
        currentPassword,
        newPassword,
        req.activeEmployee?.id || null
      );
      changePasswordLimiter.reset(limitKey);
      const csrfToken = setSessionCookie(req, res, newSession.token);

      console.info('[AUTH CHANGE PASSWORD] Success', {
        accountId: newSession.account.id,
        role: newSession.account.role,
        mustChangePassword: Boolean(newSession.account.mustChangePassword),
      });

      return res.json({
        success: true,
        csrfToken,
        account: newSession.account,
        message: 'Mot de passe mis à jour avec succès. Toutes vos anciennes sessions ont été invalidées.',
      });
    } catch (err: any) {
      console.warn('[AUTH CHANGE PASSWORD] Rejected', {
        accountId: req.account?.id,
        reason: err?.message || 'Unknown error',
      });
      return res.status(400).json({
        success: false,
        error: err?.message || 'Erreur lors du changement de mot de passe.',
      });
    }
  });

  // =============================================================
  // MERCHANT WORKSPACE (STRICT ISOLATION BY req.account.id & RBAC)
  // =============================================================

  app.get('/api/merchant/workspace', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspace = samaDb.getMerchantWorkspace(req.account!.id);
      return res.json({
        success: true,
        workspace,
        activeOperator: req.activeEmployee || null,
      });
    } catch (err) {
      console.error('[MERCHANT WORKSPACE GET ERROR]', err);
      return res.status(500).json({
        success: false,
        error: 'Erreur interne lors du chargement de votre espace commerçant.',
      });
    }
  });

  app.put('/api/merchant/workspace/sync', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      samaDb.syncMerchantWorkspace(req.account!.id, req.body, false, req.activeEmployee);
      return res.json({
        success: true,
        capabilities: samaDb.getAccountCapabilities(req.account!.id),
      });
    } catch (err: any) {
      return handleMerchantMutationError(res, err, 'Erreur lors de la synchronisation des données.');
    }
  });

  app.post('/api/merchant/sync/operations', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      const ops = Array.isArray(req.body?.operations) ? req.body.operations : [];
      const result = samaDb.processIncrementalSyncOperations(
        req.account!.id,
        ops,
        req.activeEmployee
      );
      return res.json({
        success: true,
        ...result,
      });
    } catch (err: any) {
      return handleMerchantMutationError(res, err, 'Erreur lors de la synchronisation incrémentale.');
    }
  });

  app.post('/api/merchant/products', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      const result = samaDb.createMerchantProduct(
        req.account!.id,
        req.body || {},
        req.activeEmployee
      );
      return res.status(201).json({
        success: true,
        ...result,
      });
    } catch (err: any) {
      return handleMerchantMutationError(res, err, 'Impossible de créer le produit.');
    }
  });

  app.post('/api/merchant/stores', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      const result = samaDb.createMerchantStore(
        req.account!.id,
        req.body || {},
        req.activeEmployee
      );
      return res.status(201).json({
        success: true,
        ...result,
      });
    } catch (err: any) {
      return handleMerchantMutationError(res, err, 'Impossible de créer la boutique.');
    }
  });

  app.post('/api/merchant/invoices', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      const result = samaDb.createMerchantInvoice(
        req.account!.id,
        req.body || {},
        req.activeEmployee
      );
      return res.status(201).json({
        success: true,
        ...result,
      });
    } catch (err: any) {
      return handleMerchantMutationError(res, err, 'Impossible de créer la facture.');
    }
  });

  app.post('/api/merchant/employees/verify-pin', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const ip = getClientIp(req);
    const { employeeId, pin } = req.body || {};
    const empIdStr = String(employeeId || '');
    const pinKey = `pin_fail:${req.account!.id}:${empIdStr}:${ip}`;

    const check = pinFailLimiter.isBlocked(pinKey, 5, 10 * 60 * 1000);
    if (check.blocked) {
      res.setHeader('Retry-After', String(check.retryAfterSec));
      return res.status(429).json({
        success: false,
        error: `Trop de codes PIN erronés. Réessayez dans ${Math.ceil(check.retryAfterSec / 60)} minute(s).`,
      });
    }

    try {
      const employee = samaDb.verifyEmployeePin(
        req.account!.id,
        empIdStr,
        String(pin || '')
      );
      if (!employee) {
        pinFailLimiter.record(pinKey, 10 * 60 * 1000);
        return res.status(401).json({
          success: false,
          error: 'Code PIN incorrect ou employé inactif.',
        });
      }
      pinFailLimiter.reset(pinKey);
      if (req.sessionToken) {
        samaDb.setSessionActiveEmployee(req.sessionToken, req.account!.id, employee.id);
      }
      return res.json({
        success: true,
        employee,
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        error: err?.message || 'Impossible de vérifier le code PIN.',
      });
    }
  });

  app.post('/api/merchant/employees', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      const employee = samaDb.upsertEmployee(
        req.account!.id,
        req.body || {},
        req.activeEmployee
      );
      return res.json({
        success: true,
        employee,
      });
    } catch (err: any) {
      return handleMerchantMutationError(res, err, 'Impossible d’enregistrer l’employé.');
    }
  });

  app.delete('/api/merchant/employees/:employeeId', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      samaDb.deleteEmployee(req.account!.id, req.params.employeeId, req.activeEmployee);
      return res.json({
        success: true,
      });
    } catch (err: any) {
      return handleMerchantMutationError(res, err, 'Impossible de supprimer cet employé.');
    }
  });

  app.post('/api/merchant/migrate-local', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      const migrated = samaDb.syncMerchantWorkspace(
        req.account!.id,
        req.body,
        true,
        req.activeEmployee
      );
      const workspace = samaDb.getMerchantWorkspace(req.account!.id);
      return res.json({
        success: true,
        migrated,
        workspace,
      });
    } catch (err: any) {
      return handleMerchantMutationError(res, err, 'Erreur lors de l’import initial des données.');
    }
  });

  // =============================================================
  // ADMINISTRATEUR-ONLY SUBSCRIPTION & ACCOUNT OVERVIEW ROUTES
  // =============================================================

  app.get('/api/admin/overview', requireAuth, requireAdmin, (_req: AuthenticatedRequest, res: Response) => {
    try {
      const overview = samaDb.getAdminOverview();
      return res.json({
        success: true,
        ...overview,
        unitechOrders: samaDb.getUnitechPayOrders(100),
        unitechWebhookLogs: samaDb.getUnitechPayWebhookLogs(200),
      });
    } catch (err) {
      console.error('[ADMIN OVERVIEW ERROR]', err);
      return res.status(500).json({
        success: false,
        error: 'Erreur interne lors du chargement du tableau de bord administrateur.',
      });
    }
  });

  app.put('/api/admin/plans/:planId', requireAuth, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    try {
      const plans = samaDb.updatePlan(req.params.planId, req.body || {});
      return res.json({
        success: true,
        plans,
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        error: err?.message || 'Impossible de modifier la formule.',
      });
    }
  });

  app.post('/api/admin/plans/reset', requireAuth, requireAdmin, (_req: AuthenticatedRequest, res: Response) => {
    try {
      const plans = samaDb.resetDefaultPlans();
      return res.json({
        success: true,
        plans,
      });
    } catch (err) {
      console.error('[ADMIN PLANS RESET ERROR]', err);
      return res.status(500).json({
        success: false,
        error: 'Erreur interne lors de la réinitialisation des formules.',
      });
    }
  });

  app.put('/api/admin/subscriptions/:accountId', requireAuth, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    try {
      samaDb.adminUpdateSubscription(req.params.accountId, req.account!.name, req.body || {});
      return res.json({
        success: true,
        overview: samaDb.getAdminOverview(),
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        error: err?.message || 'Erreur lors de la modification de l’abonnement.',
      });
    }
  });

  app.post('/api/admin/subscriptions/:accountId/payments', requireAuth, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    try {
      samaDb.adminRecordPayment(req.params.accountId, req.account!.name, req.body || {});
      return res.json({
        success: true,
        overview: samaDb.getAdminOverview(),
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        error: err?.message || 'Erreur lors de l’enregistrement du paiement.',
      });
    }
  });

  app.patch('/api/admin/accounts/:accountId/status', requireAuth, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    try {
      samaDb.setAccountActiveStatus(req.params.accountId, Boolean(req.body?.active));
      return res.json({
        success: true,
        overview: samaDb.getAdminOverview(),
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        error: err?.message || 'Erreur lors de la mise à jour du statut du compte.',
      });
    }
  });

  app.post('/api/admin/accounts/:accountId/reset-password', requireAuth, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    try {
      const result = samaDb.adminResetAccountPassword(req.params.accountId, req.account!.name);
      return res.json({
        success: true,
        temporaryPassword: result.temporaryPassword,
        account: result.account,
        overview: samaDb.getAdminOverview(),
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        error: err?.message || 'Impossible de réinitialiser le mot de passe du compte.',
      });
    }
  });

  // =============================================================
  // UNITECHPAY WEBHOOK MODULE & WAVE SUBSCRIPTION ACTIVATION
  // =============================================================

  const getUnitechWebhookUrl = (req: Request) => {
    const envWebhookUrl = (process.env.UNITECHPAY_WEBHOOK_URL || '').trim();
    if (envWebhookUrl) {
      return envWebhookUrl;
    }
    const appUrl = (process.env.APP_URL || '').trim().replace(/\/+$/, '');
    if (appUrl && appUrl !== 'MY_APP_URL' && /^https?:\/\//i.test(appUrl)) {
      return `${appUrl}/api/webhooks/unitechpay`;
    }
    const rawProto = String(req.headers['x-forwarded-proto'] || req.protocol || 'https');
    const protocol = rawProto.split(',')[0].trim() || 'https';
    const rawHost = String(req.headers['x-forwarded-host'] || req.get('host') || 'localhost:3000');
    const host = rawHost.split(',')[0].trim() || 'localhost:3000';
    return `${protocol}://${host}/api/webhooks/unitechpay`;
  };

  const generateHmac = (data: string | Buffer, secret: string) => {
    return crypto.createHmac('sha256', secret).update(data).digest('hex');
  };

  // GET /api/unitechpay/config - Admin only (never exposes raw API key)
  app.get('/api/unitechpay/config', requireAuth, requireAdmin, (req: Request, res: Response) => {
    const cfg = samaDb.getUnitechPayConfig();
    const envWebhookUrl = (process.env.UNITECHPAY_WEBHOOK_URL || '').trim();
    const currentWebhookUrl = envWebhookUrl || cfg.webhookUrl || getUnitechWebhookUrl(req);
    const effectiveApiUrl = getEffectiveUnitechApiUrl();
    const effectiveApiKey = getEffectiveUnitechApiKey();
    res.json({
      success: true,
      config: {
        apiUrl: effectiveApiUrl,
        apiKey: '',
        hasApiKey: Boolean(effectiveApiKey),
        isDemoKey: false,
        apiKeyMasked: effectiveApiKey
          ? `${effectiveApiKey.slice(0, 6)}••••••••${effectiveApiKey.slice(-4)}`
          : '',
        webhookUrl: currentWebhookUrl,
        events: cfg.events,
        isConfiguredWithUnitech: cfg.isConfiguredWithUnitech,
        lastConfiguredAt: cfg.lastConfiguredAt,
        signatureMethod: cfg.signatureMethod,
        autoActivate: cfg.autoActivate,
      },
    });
  });

  // POST /api/unitechpay/config - Admin only
  app.post('/api/unitechpay/config', requireAuth, requireAdmin, (req: Request, res: Response) => {
    const { apiKey, apiUrl, signatureMethod, autoActivate, webhookUrl } = req.body || {};
    const updates: any = {};

    if (typeof apiKey === 'string' && apiKey.trim() !== '' && !apiKey.includes('••••')) {
      updates.apiKey = apiKey.trim();
    }
    if (typeof apiUrl === 'string' && apiUrl.trim() !== '') {
      updates.apiUrl = apiUrl.trim();
    }
    if (signatureMethod === 'auto' || signatureMethod === 'raw_body' || signatureMethod === 'canonical_pipe') {
      updates.signatureMethod = signatureMethod;
    }
    if (autoActivate !== undefined) {
      updates.autoActivate = Boolean(autoActivate);
    }
    if (typeof webhookUrl === 'string') {
      updates.webhookUrl = webhookUrl.trim();
    }

    const updatedCfg = samaDb.updateUnitechPayConfig(updates);
    const effectiveApiKey = getEffectiveUnitechApiKey();

    res.json({
      success: true,
      message: 'Configuration UnitechPay mise à jour avec succès.',
      config: {
        ...updatedCfg,
        apiUrl: getEffectiveUnitechApiUrl(),
        apiKey: '',
        hasApiKey: Boolean(effectiveApiKey),
        isDemoKey: false,
        apiKeyMasked: effectiveApiKey
          ? `${effectiveApiKey.slice(0, 6)}••••••••${effectiveApiKey.slice(-4)}`
          : '',
      },
    });
  });

  // POST /api/unitechpay/configure-remote - Admin only
  app.post('/api/unitechpay/configure-remote', requireAuth, requireAdmin, async (req: Request, res: Response) => {
    const cfg = samaDb.getUnitechPayConfig();
    const envWebhookUrl = (process.env.UNITECHPAY_WEBHOOK_URL || '').trim();
    const targetWebhookUrl =
      req.body?.webhookUrl || envWebhookUrl || cfg.webhookUrl || getUnitechWebhookUrl(req);
    const events = ['payment_completed', 'payment_failed', 'payment_expired'];
    const baseApiUrl = getEffectiveUnitechApiUrl();
    const effectiveApiKey = getEffectiveUnitechApiKey();
    if (!effectiveApiKey) {
      return res.status(400).json({
        success: false,
        error: 'Clé API UnitechPay requise avant de configurer le webhook distant.',
      });
    }

    const unitechApiEndpoint = baseApiUrl.includes('?')
      ? `${baseApiUrl}&action=configure_webhook`
      : `${baseApiUrl}?action=configure_webhook`;

    console.log(`[UNITECHPAY] Configuring remote webhook on: ${unitechApiEndpoint} -> ${targetWebhookUrl}`);

    let remoteResponseData: any = null;
    let statusMsg = '';

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const resp = await fetch(unitechApiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${effectiveApiKey}`,
          'X-API-KEY': effectiveApiKey,
        },
        body: JSON.stringify({
          webhook_url: targetWebhookUrl,
          events,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      remoteResponseData = await resp.json().catch(() => null);
      if (resp.ok) {
        statusMsg = 'Webhook configuré avec succès auprès de l’API UnitechPay.';
      } else {
        statusMsg = `Réponse API UnitechPay (${resp.status}): ${remoteResponseData?.message || 'Erreur retournée par le serveur distant'}`;
      }
    } catch (err: any) {
      console.warn('[UNITECHPAY] Remote API endpoint call failed:', err?.message);
      statusMsg = `URL du webhook enregistrée localement (${targetWebhookUrl}). L'API UnitechPay (${baseApiUrl}) est prête à router vers cet endpoint.`;
      remoteResponseData = { simulated: true, endpoint: targetWebhookUrl };
    }

    samaDb.updateUnitechPayConfig({
      isConfiguredWithUnitech: true,
      lastConfiguredAt: new Date().toISOString(),
      webhookUrl: targetWebhookUrl,
      events,
    });

    samaDb.appendUnitechPayWebhookLog({
      id: `wh-cfg-${Date.now()}`,
      receivedAt: new Date().toISOString(),
      event: 'webhook.configured',
      reference: 'unitech_webhook_setup',
      status: 'completed',
      signatureValid: true,
      verificationMethodUsed: 'none',
      resultStatus: 'success',
      summary: `Configuration du Webhook UnitechPay validée pour l’URL ${targetWebhookUrl}`,
      rawPayload: { webhook_url: targetWebhookUrl, events, remoteResponse: remoteResponseData },
      ipAddress: getClientIp(req),
    });

    return res.json({
      success: true,
      message: statusMsg,
      configuredUrl: targetWebhookUrl,
      remoteResponse: remoteResponseData,
    });
  });

  // POST /api/unitechpay/create-order - Admin only (server-authoritative plan price & account check)
  app.post('/api/unitechpay/create-order', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    const {
      planId,
      billingCycle = 'mensuel',
      customerName,
      customerPhone,
      customerEmail,
      description,
      samaStockUserId,
      samaStockSubscriptionId,
    } = req.body || {};

    const cleanPhone = String(customerPhone || '').trim().replace(/\s+/g, '');
    const normalizedCycle: 'mensuel' | 'annuel' = billingCycle === 'annuel' ? 'annuel' : 'mensuel';
    const targetPlan = planId ? samaDb.getPlanById(String(planId)) : null;

    if (!targetPlan || targetPlan.id === 'plan-gratuit') {
      return res.status(400).json({
        success: false,
        error: 'Formule payante invalide pour la création d’un paiement Wave.',
      });
    }

    const authoritativeAmount =
      normalizedCycle === 'annuel' ? targetPlan.annualPrice : targetPlan.monthlyPrice;

    if (!authoritativeAmount || authoritativeAmount <= 0 || !cleanPhone) {
      return res.status(400).json({
        success: false,
        error: 'Champs requis manquants ou montant invalide pour cette formule.',
      });
    }

    const targetAccountId = String(samaStockUserId || '').trim();
    if (!targetAccountId || !samaDb.accountExists(targetAccountId)) {
      return res.status(400).json({
        success: false,
        error: 'Compte commerçant cible introuvable.',
      });
    }

    const effectiveApiKey = getEffectiveUnitechApiKey();
    const baseApiUrl = getEffectiveUnitechApiUrl();

    if (!effectiveApiKey) {
      console.error('[UNITECHPAY CREATE_WAVE_PAYMENT] Missing UNITECHPAY_API_KEY');
      return res.status(500).json({
        success: false,
        errorCode: 'MISSING_API_KEY',
        error: 'Clé API UnitechPay non configurée côté serveur. Impossible de générer le lien de paiement Wave.',
      });
    }

    const resolvedDescription =
      typeof description === 'string' && description.trim()
        ? description.trim()
        : `Abonnement SAMA STOCK - Formule ${targetPlan.name} (${normalizedCycle})`;

    const timestampSec = Math.floor(Date.now() / 1000);
    const randomHex = crypto.randomBytes(3).toString('hex');
    const clientReference = `wave_${randomHex}_${timestampSec}`;

    const createWaveEndpoint = baseApiUrl.includes('?')
      ? `${baseApiUrl}&action=create_wave_payment`
      : `${baseApiUrl}?action=create_wave_payment`;

    const unitechRequestPayload = {
      amount: authoritativeAmount,
      customer_number: cleanPhone,
      description: resolvedDescription,
      reference: clientReference,
    };

    console.log('[UNITECHPAY CREATE_WAVE_PAYMENT] Outgoing request', {
      endpoint: createWaveEndpoint,
      planId: targetPlan.id,
      billingCycle: normalizedCycle,
      amount: authoritativeAmount,
      phoneMasked: maskPhoneForLog(cleanPhone),
      localReference: clientReference,
      hasApiKey: true,
    });

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const resp = await fetch(createWaveEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${effectiveApiKey}`,
        },
        body: JSON.stringify(unitechRequestPayload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const httpStatus = resp.status;
      const rawResponseText = await resp.text();
      let apiJson: any = null;
      try {
        apiJson = rawResponseText ? JSON.parse(rawResponseText) : null;
      } catch {
        apiJson = null;
      }

      if (!resp.ok || !apiJson || apiJson.success !== true) {
        const apiErrMsg =
          apiJson?.message ||
          (httpStatus === 401
            ? 'Authentification refusée par UnitechPay (clé API invalide ou manquante).'
            : `Erreur UnitechPay (HTTP ${httpStatus}).`);

        samaDb.appendUnitechPayWebhookLog({
          id: `wh-create-err-${Date.now()}`,
          receivedAt: new Date().toISOString(),
          event: 'create_wave_payment.error',
          reference: clientReference,
          amount: authoritativeAmount,
          status: 'rejected',
          signatureValid: true,
          verificationMethodUsed: 'none',
          resultStatus: 'error',
          summary: `Échec création lien Wave UnitechPay (HTTP ${httpStatus}) : ${apiErrMsg}`,
          rejectionReason: `HTTP ${httpStatus} - error_code=${apiJson?.error_code ?? 'unknown'}`,
          subscriptionActivated: false,
          rawPayload: {
            httpStatus,
            success: apiJson?.success ?? false,
            error_code: apiJson?.error_code ?? null,
            message: apiErrMsg,
          },
          ipAddress: getClientIp(req),
        });

        return res.status(httpStatus === 401 ? 401 : 502).json({
          success: false,
          errorCode: apiJson?.error_code || `UNITECHPAY_HTTP_${httpStatus}`,
          error:
            httpStatus === 401
              ? 'Authentification UnitechPay refusée (401 Unauthorized). Vérifiez la clé UNITECHPAY_API_KEY configurée côté serveur.'
              : `Impossible de créer le lien de paiement Wave auprès d’UnitechPay (${apiErrMsg}). Aucun abonnement n’a été activé.`,
        });
      }

      const rawPaymentUrl: unknown = apiJson?.data?.payment_url;
      const providerReference =
        typeof apiJson?.data?.reference === 'string' && apiJson.data.reference.trim()
          ? apiJson.data.reference.trim()
          : undefined;
      const providerTxId =
        apiJson?.data?.transaction_id !== undefined && apiJson?.data?.transaction_id !== null
          ? apiJson.data.transaction_id
          : undefined;

      const urlCheck = validateUnitechPaymentUrl(rawPaymentUrl, [
        clientReference,
        providerReference || '',
        providerTxId !== undefined ? String(providerTxId) : '',
      ]);

      if (!urlCheck.valid) {
        samaDb.appendUnitechPayWebhookLog({
          id: `wh-url-err-${Date.now()}`,
          receivedAt: new Date().toISOString(),
          event: 'create_wave_payment.invalid_url',
          reference: providerReference || clientReference,
          transactionId: providerTxId,
          amount: authoritativeAmount,
          status: 'rejected',
          signatureValid: true,
          verificationMethodUsed: 'none',
          resultStatus: 'error',
          summary: `Lien Wave retourné par UnitechPay invalide ou manquant : ${urlCheck.reason}`,
          rejectionReason: urlCheck.reason,
          subscriptionActivated: false,
          ipAddress: getClientIp(req),
        });

        return res.status(502).json({
          success: false,
          errorCode: 'INVALID_PAYMENT_URL',
          error:
            'Le lien de paiement Wave retourné par UnitechPay est absent ou invalide. Aucun paiement ni abonnement n’a été activé.',
        });
      }

      const exactPaymentUrl = rawPaymentUrl as string;
      const finalReference = providerReference || clientReference;

      const newOrder = {
        id: `ord-unitech-${Date.now()}`,
        reference: finalReference,
        localReference: clientReference,
        providerReference,
        transactionId: providerTxId,
        samaStockUserId: targetAccountId,
        samaStockSubscriptionId: samaStockSubscriptionId || `sub-${targetAccountId}`,
        customerName: customerName || 'Client SAMA STOCK',
        customerEmail: customerEmail || '',
        customerPhone: String(customerPhone).trim(),
        planId: targetPlan.id,
        planName: targetPlan.name,
        billingCycle: normalizedCycle,
        amount: authoritativeAmount,
        currency: 'FCFA',
        status: 'pending',
        method: 'wave',
        wavePaymentUrl: exactPaymentUrl,
        paymentUrlDomain: urlCheck.hostname,
        dateCreated: new Date().toISOString(),
        webhookVerified: false,
      };

      samaDb.saveUnitechPayOrder(newOrder);

      samaDb.adminRecordPayment(targetAccountId, req.account!.name, {
        planId: targetPlan.id,
        billingCycle: normalizedCycle,
        amount: authoritativeAmount,
        paymentMethod: 'unitechpay_wave',
        status: 'en_attente',
        reference: finalReference,
        phoneNumber: String(customerPhone).trim(),
        waveCheckoutUrl: exactPaymentUrl,
        providerTransactionId: providerTxId !== undefined ? String(providerTxId) : undefined,
      });

      return res.json({
        success: true,
        order: newOrder,
        reference: finalReference,
        transactionId: providerTxId,
        wavePaymentUrl: exactPaymentUrl,
        paymentUrlDomain: urlCheck.hostname,
        message: 'Lien de paiement Wave généré avec succès via UnitechPay.',
      });
    } catch (err: any) {
      const isTimeout = err?.name === 'AbortError';
      console.error('[UNITECHPAY CREATE_WAVE_PAYMENT] Network/Request failure', {
        endpoint: createWaveEndpoint,
        isTimeout,
        message: err?.message || 'Unknown error',
      });

      return res.status(502).json({
        success: false,
        errorCode: isTimeout ? 'UNITECHPAY_TIMEOUT' : 'UNITECHPAY_NETWORK_ERROR',
        error: isTimeout
          ? 'Le serveur UnitechPay n’a pas répondu à temps. Veuillez réessayer.'
          : 'Impossible de contacter la passerelle UnitechPay pour générer le lien de paiement Wave.',
      });
    }
  });

  // GET /api/unitechpay/orders - Admin only
  app.get('/api/unitechpay/orders', requireAuth, requireAdmin, (_req: Request, res: Response) => {
    const orders = samaDb.getUnitechPayOrders(100);
    res.json({
      success: true,
      orders,
      total: orders.length,
    });
  });

  // GET /api/unitechpay/webhook-logs - Admin only
  app.get('/api/unitechpay/webhook-logs', requireAuth, requireAdmin, (_req: Request, res: Response) => {
    const logs = samaDb.getUnitechPayWebhookLogs(200);
    res.json({
      success: true,
      logs,
      total: logs.length,
    });
  });

  // GET /api/unitechpay/order-status/:reference - Admin only
  app.get('/api/unitechpay/order-status/:reference', requireAuth, requireAdmin, (req: Request, res: Response) => {
    const { reference } = req.params;
    const order = samaDb.findUnitechPayOrderByReference(reference);

    if (!order) {
      return res.status(404).json({
        success: false,
        reference,
        status: 'pending',
        isPaid: false,
        webhookVerified: false,
        message: 'Commande UnitechPay introuvable.',
      });
    }

    const isPaid = order.status === 'completed';

    return res.json({
      success: true,
      reference: order.reference,
      status: order.status,
      isPaid,
      webhookVerified: Boolean(order.webhookVerified),
      transactionId: order.transactionId,
      receiptNumber: order.receiptNumber,
      paidAt: order.dateCompleted,
      message: isPaid
        ? 'Paiement Wave vérifié par webhook UnitechPay.'
        : order.status === 'failed'
        ? 'Paiement échoué.'
        : order.status === 'expired'
        ? 'Paiement expiré.'
        : 'En attente de confirmation Wave par webhook UnitechPay.',
    });
  });

  // =============================================================
  // OFFICIAL UNITECHPAY WEBHOOK RECEIVER (POST /api/webhooks/unitechpay)
  // =============================================================
  const handleUnitechPayWebhook = (req: any, res: Response) => {
    const payload = req.body || {};
    const apiKey = getEffectiveUnitechApiKey();
    const clientIp = getClientIp(req);

    console.log('[UNITECHPAY WEBHOOK RECEIVED]', {
      event: payload.event,
      transaction_id: payload.transaction_id,
      reference: payload.reference,
      amount: payload.amount,
      status: payload.status,
      method: payload.method,
    });

    // 1. Signature Verification (never log expected HMAC secrets)
    const configuredMethod = samaDb.getUnitechPayConfig().signatureMethod || 'auto';
    const sigCheck = verifyUnitechPaySignature(req, apiKey, payload, configuredMethod);

    if (!sigCheck.valid) {
      console.warn('[UNITECHPAY WEBHOOK] Rejected: Invalid HMAC-SHA256 signature');
      samaDb.appendUnitechPayWebhookLog({
        id: `wh-reject-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
        receivedAt: new Date().toISOString(),
        event: payload.event || 'unknown',
        reference: payload.reference || 'unknown',
        transactionId: payload.transaction_id,
        amount: payload.amount,
        status: 'rejected',
        signatureValid: false,
        verificationMethodUsed: 'none',
        resultStatus: 'error',
        summary: 'Notification rejetée : Signature HMAC-SHA256 absente ou non concordante.',
        rejectionReason: 'Signature invalide (Erreur 401 Unauthorized)',
        subscriptionActivated: false,
        rawPayload: payload,
        ipAddress: clientIp,
      });

      return res.status(401).json({
        success: false,
        error: 'Invalid HMAC-SHA256 signature',
        message: 'La signature HMAC transmise ne correspond pas à la clé API UnitechPay.',
      });
    }

    const {
      event,
      transaction_id,
      reference,
      amount,
      status,
      method,
      commission = 0,
      net_amount = amount ? Number(amount) - Number(commission) : 0,
      timestamp,
      signed_at,
    } = payload;

    // 2. Supported event check
    if (!['payment_completed', 'payment_failed', 'payment_expired'].includes(event)) {
      return res.status(400).json({
        success: false,
        error: `Événement non pris en charge: ${String(event || '')}`,
      });
    }

    // 3. Anti-replay timestamp window validation
    // En mode canonical_pipe, seul `signed_at` est couvert par le HMAC : interdiction de retomber sur `timestamp` non signé.
    const hasValidSignedAt = signed_at !== undefined && signed_at !== null && String(signed_at).trim() !== '';
    const rawTs =
      sigCheck.methodUsed === 'canonical_pipe'
        ? hasValidSignedAt
          ? signed_at
          : NaN
        : hasValidSignedAt
        ? signed_at
        : timestamp;
    const numericTs = Number(rawTs);
    const maxAgeSec = Math.max(
      60,
      Number(process.env.UNITECHPAY_WEBHOOK_MAX_AGE_SECONDS || 86400) || 86400
    );
    const nowSec = Math.floor(Date.now() / 1000);
    if (!Number.isFinite(numericTs) || numericTs > nowSec + 300 || numericTs < nowSec - maxAgeSec) {
      samaDb.appendUnitechPayWebhookLog({
        id: `wh-ts-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
        receivedAt: new Date().toISOString(),
        event,
        reference: reference || 'unknown',
        transactionId: transaction_id,
        amount,
        status: 'rejected',
        signatureValid: true,
        verificationMethodUsed: sigCheck.methodUsed,
        resultStatus: 'error',
        summary: 'Notification rejetée : horodatage expiré ou hors fenêtre de validité anti-rejeu.',
        rejectionReason: 'Horodatage hors fenêtre (TIMESTAMP_OUT_OF_WINDOW)',
        subscriptionActivated: false,
        rawPayload: payload,
        ipAddress: clientIp,
      });
      return res.status(401).json({
        success: false,
        error: 'TIMESTAMP_OUT_OF_WINDOW',
        message: 'Horodatage du webhook expiré ou invalide.',
      });
    }

    // 4. Duplicate & Idempotency protection
    const strTxId = transaction_id !== undefined ? String(transaction_id) : '';
    const refStr = String(reference || '').trim();
    if (samaDb.isUnitechEventProcessed(strTxId, refStr)) {
      console.log(`[UNITECHPAY WEBHOOK] Idempotent hit: Reference ${refStr} (tx ${strTxId}) already processed`);
      samaDb.appendUnitechPayWebhookLog({
        id: `wh-dup-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
        receivedAt: new Date().toISOString(),
        event,
        reference: refStr || 'unknown',
        transactionId: transaction_id,
        amount,
        status,
        signatureValid: true,
        verificationMethodUsed: sigCheck.methodUsed,
        resultStatus: 'duplicate',
        summary: `Notification répétée reçue pour la référence ${refStr}. Aucun doublon d'abonnement créé (Idempotence respectée).`,
        subscriptionActivated: false,
        rawPayload: payload,
        ipAddress: clientIp,
      });

      return res.status(200).json({
        received: true,
        status: 'already_processed',
        message: 'Notification répétée acceptée et ignorée (déjà traitée précédemment).',
        reference: refStr,
        transaction_id,
      });
    }

    // 5. Find pre-registered SAMA STOCK order strictly by reference
    const matchedOrder = samaDb.findUnitechPayOrderByReference(refStr);
    if (!matchedOrder) {
      samaDb.appendUnitechPayWebhookLog({
        id: `wh-unknown-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
        receivedAt: new Date().toISOString(),
        event,
        reference: refStr || 'unknown',
        transactionId: transaction_id,
        amount,
        status: 'rejected',
        signatureValid: true,
        verificationMethodUsed: sigCheck.methodUsed,
        resultStatus: 'warning',
        summary: `Référence inconnue (${refStr || 'vide'}) : aucune commande SAMA STOCK pré-enregistrée correspondante. Aucun abonnement activé.`,
        rejectionReason: 'Référence commande introuvable (UNKNOWN_REFERENCE)',
        subscriptionActivated: false,
        rawPayload: payload,
        ipAddress: clientIp,
      });

      return res.status(404).json({
        success: false,
        received: true,
        status: 'unknown_reference',
        subscriptionActivated: false,
        error: 'UNKNOWN_REFERENCE',
        message: 'Aucune commande SAMA STOCK ne correspond à cette référence. Aucun abonnement n’a été activé.',
      });
    }

    // CASE A: payment_completed + completed -> Atomic Verification & Activation
    if (event === 'payment_completed' && status === 'completed') {
      if (method && String(method).toLowerCase() !== 'wave') {
        console.warn(`[UNITECHPAY WEBHOOK] Method is '${method}', expected 'wave'`);
      }

      if (Number(matchedOrder.amount) !== Number(amount)) {
        samaDb.appendUnitechPayWebhookLog({
          id: `wh-err-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
          receivedAt: new Date().toISOString(),
          event,
          reference: refStr,
          transactionId: transaction_id,
          amount,
          status: 'rejected',
          signatureValid: true,
          verificationMethodUsed: sigCheck.methodUsed,
          resultStatus: 'error',
          summary: `Écart de montant détecté pour la référence ${refStr} : Attendu ${matchedOrder.amount} FCFA, Reçu ${amount} FCFA.`,
          rejectionReason: 'Montant non conforme à la commande',
          subscriptionActivated: false,
          rawPayload: payload,
          ipAddress: clientIp,
        });

        return res.status(400).json({
          success: false,
          subscriptionActivated: false,
          error: 'Montant incorrect',
          message: `Le montant payé (${amount} FCFA) ne correspond pas au montant de la formule (${matchedOrder.amount} FCFA).`,
        });
      }

      if (!samaDb.accountExists(String(matchedOrder.samaStockUserId || ''))) {
        return res.status(400).json({
          success: false,
          subscriptionActivated: false,
          error: 'Compte commerçant associé à cette commande introuvable.',
        });
      }

      const receiptNumber = `REC-UNITECH-${transaction_id || crypto.randomInt(100000, 999999)}`;
      const successLog = {
        id: `wh-succ-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
        receivedAt: new Date().toISOString(),
        event,
        reference: refStr,
        transactionId: transaction_id,
        amount,
        status: 'completed',
        signatureValid: true,
        verificationMethodUsed: sigCheck.methodUsed,
        resultStatus: 'success',
        summary: `Paiement Wave de ${amount} FCFA confirmé avec succès par UnitechPay (Réf: ${refStr}, TransID: ${transaction_id}). Formule « ${matchedOrder.planName} » activée immédiatement. Reçu: ${receiptNumber}.`,
        subscriptionActivated: true,
        receiptNumber,
        rawPayload: payload,
        ipAddress: clientIp,
      };

      const atomicRes = samaDb.processUnitechCompletedWebhookAtomic({
        order: matchedOrder,
        reference: refStr,
        transactionId: transaction_id,
        commission: Number(commission),
        netAmount: Number(net_amount),
        receiptNumber,
        successLog,
      });

      if (atomicRes.alreadyProcessed) {
        return res.status(200).json({
          received: true,
          status: 'already_processed',
          message: 'Notification répétée acceptée et ignorée (déjà traitée précédemment).',
          reference: refStr,
          transaction_id,
        });
      }

      console.log(`[UNITECHPAY WEBHOOK] Subscription Activated for plan ${matchedOrder.planId}! Receipt: ${receiptNumber}`);

      return res.status(200).json({
        received: true,
        status: 'processed',
        message: 'Paiement Wave vérifié et abonnement SAMA STOCK activé avec succès.',
        reference: refStr,
        transaction_id,
        subscriptionActivated: true,
        planId: matchedOrder.planId,
        billingCycle: matchedOrder.billingCycle,
        receiptNumber,
      });
    }

    // CASE B: payment_failed
    if (event === 'payment_failed') {
      matchedOrder.status = 'failed';
      samaDb.saveUnitechPayOrder(matchedOrder);
      samaDb.appendUnitechPayWebhookLog({
        id: `wh-fail-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
        receivedAt: new Date().toISOString(),
        event,
        reference: refStr,
        transactionId: transaction_id,
        amount,
        status: 'failed',
        signatureValid: true,
        verificationMethodUsed: sigCheck.methodUsed,
        resultStatus: 'warning',
        summary: `Notification d'échec de paiement Wave reçue pour la référence ${refStr}. Abonnement non activé.`,
        rejectionReason: 'Paiement échoué côté Wave / UnitechPay',
        subscriptionActivated: false,
        rawPayload: payload,
        ipAddress: clientIp,
      });

      return res.status(200).json({
        received: true,
        status: 'recorded_failed',
        message: 'Événement d’échec enregistré dans l’historique. Aucun abonnement activé.',
        reference: refStr,
        transaction_id,
      });
    }

    // CASE C: payment_expired
    if (event === 'payment_expired') {
      matchedOrder.status = 'expired';
      samaDb.saveUnitechPayOrder(matchedOrder);
      samaDb.appendUnitechPayWebhookLog({
        id: `wh-exp-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
        receivedAt: new Date().toISOString(),
        event,
        reference: refStr,
        transactionId: transaction_id,
        amount,
        status: 'expired',
        signatureValid: true,
        verificationMethodUsed: sigCheck.methodUsed,
        resultStatus: 'warning',
        summary: `Notification d'expiration de session de paiement Wave reçue pour la référence ${refStr}.`,
        rejectionReason: 'Session de paiement Wave expirée',
        subscriptionActivated: false,
        rawPayload: payload,
        ipAddress: clientIp,
      });

      return res.status(200).json({
        received: true,
        status: 'recorded_expired',
        message: 'Session expirée enregistrée. Aucun abonnement activé.',
        reference: refStr,
        transaction_id,
      });
    }

    return res.status(200).json({ received: true, status: 'unhandled_event' });
  };

  app.post('/api/webhooks/unitechpay', (req: any, res: Response) => {
    const ip = getClientIp(req);
    const key = `wh:${ip}`;
    const check = webhookLimiter.isBlocked(key, 60, 60 * 1000);
    if (check.blocked) {
      res.setHeader('Retry-After', String(check.retryAfterSec));
      return res.status(429).json({
        success: false,
        error: 'Trop de requêtes webhook. Ralentissez.',
      });
    }
    webhookLimiter.record(key, 60 * 1000);
    return handleUnitechPayWebhook(req, res);
  });

  // =============================================================
  // INTERACTIVE TEST & SIMULATION SUITE (Disabled in Production unless ENABLE_UNITECHPAY_SANDBOX=true)
  // =============================================================
  app.post('/api/unitechpay/simulate-test', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    if (isProd && process.env.ENABLE_UNITECHPAY_SANDBOX !== 'true') {
      return res.status(403).json({
        success: false,
        error: 'Le banc d’essai sandbox UnitechPay est désactivé en environnement de production.',
      });
    }

    const {
      type = 'payment_completed',
      reference: customRef,
      amount: customAmount,
      planId = 'plan-pro',
      billingCycle = 'mensuel',
      customPayload = {},
    } = req.body || {};

    const apiKey = getEffectiveUnitechApiKey();
    if (!apiKey) {
      return res.status(400).json({
        success: false,
        error: 'Clé API UnitechPay requise pour signer les tests HMAC.',
      });
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const amount = customAmount || (planId === 'plan-entreprise' ? 12000 : 5000);

    let reference = customRef;
    if (!reference) {
      if (type === 'unknown_reference') {
        reference = `wave_unknown_${Date.now()}`;
      } else {
        const randomHex = crypto.randomBytes(3).toString('hex');
        reference = `wave_${randomHex}_${nowSec}`;
        const testOrder = {
          id: `ord-unitech-test-${Date.now()}`,
          reference,
          samaStockUserId: req.account!.id,
          samaStockSubscriptionId: `sub-${req.account!.id}`,
          customerName: 'Testeur Sandbox SAMA STOCK',
          customerEmail: 'testeur@samastock.sn',
          customerPhone: '+221 77 999 88 77',
          planId,
          planName: planId === 'plan-entreprise' ? 'Entreprise' : 'Professionnel',
          billingCycle,
          amount: Number(amount),
          currency: 'FCFA',
          status: 'pending',
          method: 'wave',
          dateCreated: new Date().toISOString(),
          webhookVerified: false,
        };
        samaDb.saveUnitechPayOrder(testOrder);
      }
    }

    const txId = crypto.randomInt(10000, 99999);
    const commission = Math.round(Number(amount) * 0.015);
    const netAmount = Number(amount) - commission;

    let payloadEvent = 'payment_completed';
    let payloadStatus = 'completed';
    let payloadAmount = amount;
    let signedAt = nowSec;

    if (type === 'payment_failed') {
      payloadEvent = 'payment_failed';
      payloadStatus = 'failed';
    } else if (type === 'payment_expired') {
      payloadEvent = 'payment_expired';
      payloadStatus = 'expired';
    } else if (type === 'amount_mismatch') {
      payloadAmount = 500;
    } else if (type === 'delayed_notification') {
      signedAt = nowSec - 7200; // 2 hours ago (within 24h window)
    }

    const canonicalString = `${payloadEvent}|${reference}|${payloadAmount}|${payloadStatus}|${signedAt}`;
    let signature = generateHmac(canonicalString, apiKey);

    if (type === 'invalid_signature') {
      signature = 'CORRUPTED_HMAC_SIGNATURE_' + crypto.randomBytes(8).toString('hex');
    }

    const testPayload = {
      event: payloadEvent,
      transaction_id: txId,
      reference,
      amount: payloadAmount,
      status: payloadStatus,
      method: 'wave',
      commission,
      net_amount: netAmount,
      timestamp: nowSec,
      signed_at: signedAt,
      signature,
      ...customPayload,
    };

    try {
      if (type === 'duplicate_notification') {
        samaDb.markUnitechEventProcessed(String(txId), String(reference));
      }

      const fakeReq: any = {
        body: testPayload,
        rawBody: Buffer.from(JSON.stringify(testPayload), 'utf-8'),
        headers: {
          'x-unitechpay-signature': signature,
          'content-type': 'application/json',
        },
        ip: getClientIp(req),
      };

      let capturedStatus = 200;
      let capturedBody: any = null;

      const fakeRes: any = {
        status: (code: number) => {
          capturedStatus = code;
          return fakeRes;
        },
        json: (data: any) => {
          capturedBody = data;
          return fakeRes;
        },
      };

      handleUnitechPayWebhook(fakeReq, fakeRes);

      const latestLogs = samaDb.getUnitechPayWebhookLogs(1);
      const latestLog = latestLogs[0] || null;

      return res.status(capturedStatus).json({
        success: capturedStatus === 200,
        httpStatus: capturedStatus,
        scenario: type,
        testedPayload: testPayload,
        response: capturedBody,
        log: latestLog,
        message:
          capturedStatus === 200
            ? capturedBody?.message || 'Scénario exécuté avec succès (Code 200)'
            : `Scénario rejeté conformément aux spécifications (Code ${capturedStatus} : ${capturedBody?.error || 'Erreur'})`,
      });
    } catch (err) {
      console.error('[SIMULATION ERROR]', err);
      return res.status(500).json({
        success: false,
        error: 'Erreur interne lors de la simulation.',
      });
    }
  });

  // Return clean JSON 404 for unknown API routes before SPA fallback
  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: 'Endpoint API introuvable.',
    });
  });

  // -------------------------------------------------------------
  // Frontend Serving (Vite dev middleware vs static production)
  // -------------------------------------------------------------
  if (isProd) {
    const distPath = path.resolve(APP_ROOT, 'dist');
    app.use(
      '/assets',
      express.static(path.resolve(distPath, 'assets'), {
        maxAge: '1y',
        immutable: true,
      })
    );
    app.use(
      express.static(distPath, {
        index: false,
        maxAge: '1h',
      })
    );
    app.get('*', (_req: Request, res: Response) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vitePromise = createViteServer({
      server: { middlewareMode: true, allowedHosts: true },
      appType: 'spa',
    });
    vitePromise.catch((err) => {
      console.error('[SAMA STOCK] Vite dev server initialization failed:', err);
    });
    app.use(async (req: Request, res: Response, next: NextFunction) => {
      try {
        const vite = await vitePromise;
        vite.middlewares(req, res, next);
      } catch (err) {
        next(err);
      }
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SAMA STOCK] Server running on http://0.0.0.0:${PORT} (env=${process.env.NODE_ENV || 'development'})`);
  });

  const gracefulShutdown = (signal: string) => {
    console.log(`[SAMA STOCK] Received ${signal}, shutting down gracefully...`);
    server.close(() => {
      console.log('[SAMA STOCK] HTTP server closed.');
      process.exit(0);
    });
    setTimeout(() => {
      process.exit(1);
    }, 10000).unref();
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

startServer().catch((err) => {
  console.error('[SAMA STOCK] Server failed to start:', err);
  process.exit(1);
});
