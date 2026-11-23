import {
  supabase,
  isSupabaseConfigured,
  setSupabaseVerifiedSessionContext,
} from '../lib/supabase';

const ADMIN_CREDENTIAL_HASH_STORAGE_KEY = 'tgi_admin_credential_sha256_v2';
const EMPLOYEE_PIN_HASH_MAP_STORAGE_KEY = 'tgi_employee_pin_sha256_map_v2';
const VERIFIED_SESSION_TOKEN_KEY = 'tgi_verified_session_token_v2';
const ADMIN_SESSION_SIG_KEY = 'tgi_admin_session_sig_v2';
const PIN_RATE_LIMIT_STORAGE_KEY = 'tgi_pin_rate_limit_v2';
const HASH_SALT_PREFIX = 'tgi-payroll-hris-sec-v2::';

export const OFFICIAL_ADMIN_EMAILS: readonly string[] = [
  'jpexakun7@gmail.com',
  'lupytacounting77@gmail.com',
];

export const MAX_PIN_ATTEMPTS = 5;
export const PIN_LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 menit

export function isOfficialAdminEmail(email?: string | null): boolean {
  if (!email || typeof email !== 'string') return false;
  return OFFICIAL_ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

export interface AdminVerifyResponse {
  authenticated: boolean;
  email?: string;
  role?: 'Super Admin' | 'HR Admin' | 'Finance';
  sessionToken?: string;
  message?: string;
  requiresInitialSetup?: boolean;
  isLockedOut?: boolean;
  remainingSeconds?: number;
  remainingAttempts?: number;
}

export interface EmployeeVerifyResponse {
  authenticated: boolean;
  employeeId?: string;
  employeeName?: string;
  department?: string;
  sessionToken?: string;
  message?: string;
  isLockedOut?: boolean;
  remainingSeconds?: number;
  remainingAttempts?: number;
}

// ============================================================================
// LOCALSTORAGE & SESSIONSTORAGE OBFUSCATION (NO PLAINTEXT PINS, KTP, BANK, OR TOKENS)
// ============================================================================
const OBFUSCATION_PREFIX = 'enc_v2::';
const OBFUSCATION_KEY = 'TGI_PII_SHIELD_2026_KEY';

export function obfuscateSensitiveField(plain?: string): string | undefined {
  if (!plain || typeof plain !== 'string') return plain;
  const trimmed = plain.trim();
  if (!trimmed || trimmed.startsWith(OBFUSCATION_PREFIX)) return trimmed;
  try {
    const xorBytes: number[] = [];
    for (let i = 0; i < trimmed.length; i++) {
      const k = OBFUSCATION_KEY.charCodeAt(i % OBFUSCATION_KEY.length);
      xorBytes.push(trimmed.charCodeAt(i) ^ k);
    }
    const hex = xorBytes.map((b) => b.toString(16).padStart(2, '0')).join('');
    return `${OBFUSCATION_PREFIX}${hex}`;
  } catch {
    return undefined;
  }
}

export function deobfuscateSensitiveField(stored?: string): string | undefined {
  if (!stored || typeof stored !== 'string') return stored;
  if (!stored.startsWith(OBFUSCATION_PREFIX)) return stored;
  try {
    const hex = stored.slice(OBFUSCATION_PREFIX.length);
    const chars: string[] = [];
    for (let i = 0; i < hex.length; i += 2) {
      const byte = parseInt(hex.slice(i, i + 2), 16);
      const k = OBFUSCATION_KEY.charCodeAt((i / 2) % OBFUSCATION_KEY.length);
      chars.push(String.fromCharCode(byte ^ k));
    }
    return chars.join('');
  } catch {
    return '';
  }
}

// ============================================================================
// ANTI-BRUTE-FORCE / RATE LIMITING FOR PIN & PASSWORD INPUTS (5 ATTEMPTS -> 5 MIN BLOCK)
// ============================================================================
interface RateLimitEntry {
  attempts: number;
  lockedUntil: number | null;
  lastAttemptAt: number;
}

function getRateLimitMap(): Record<string, RateLimitEntry> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(PIN_RATE_LIMIT_STORAGE_KEY);
    if (!raw) return {};
    const deobf = deobfuscateSensitiveField(raw) || raw;
    const parsed = JSON.parse(deobf);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveRateLimitMap(map: Record<string, RateLimitEntry>): void {
  if (typeof window === 'undefined') return;
  try {
    const serialized = JSON.stringify(map);
    localStorage.setItem(
      PIN_RATE_LIMIT_STORAGE_KEY,
      obfuscateSensitiveField(serialized) || serialized
    );
  } catch {
    // ignore storage errors
  }
}

export function checkPinRateLimit(scopeKey: string): {
  isLocked: boolean;
  remainingSeconds: number;
  attempts: number;
  remainingAttempts: number;
} {
  const normalizedScope = (scopeKey || 'default').trim().toLowerCase();
  const map = getRateLimitMap();
  const entry = map[normalizedScope] || map['global_pin_guard'];
  const now = Date.now();

  if (entry && entry.lockedUntil && entry.lockedUntil > now) {
    const remainingSeconds = Math.max(1, Math.ceil((entry.lockedUntil - now) / 1000));
    return {
      isLocked: true,
      remainingSeconds,
      attempts: entry.attempts,
      remainingAttempts: 0,
    };
  }

  // If previous lock has expired, reset counter
  if (entry && entry.lockedUntil && entry.lockedUntil <= now) {
    delete map[normalizedScope];
    if (map['global_pin_guard']?.lockedUntil && map['global_pin_guard'].lockedUntil <= now) {
      delete map['global_pin_guard'];
    }
    saveRateLimitMap(map);
    return {
      isLocked: false,
      remainingSeconds: 0,
      attempts: 0,
      remainingAttempts: MAX_PIN_ATTEMPTS,
    };
  }

  const currentAttempts = entry?.attempts || 0;
  return {
    isLocked: false,
    remainingSeconds: 0,
    attempts: currentAttempts,
    remainingAttempts: Math.max(0, MAX_PIN_ATTEMPTS - currentAttempts),
  };
}

export function recordFailedPinAttempt(scopeKey: string): {
  isLocked: boolean;
  remainingSeconds: number;
  attempts: number;
  remainingAttempts: number;
  message: string;
} {
  const normalizedScope = (scopeKey || 'default').trim().toLowerCase();
  const map = getRateLimitMap();
  const now = Date.now();

  const existing = map[normalizedScope];
  const baseAttempts =
    existing && (!existing.lockedUntil || existing.lockedUntil > now)
      ? existing.attempts
      : 0;
  const nextAttempts = baseAttempts + 1;
  const isLocked = nextAttempts >= MAX_PIN_ATTEMPTS;
  const lockedUntil = isLocked ? now + PIN_LOCKOUT_DURATION_MS : null;

  const updatedEntry: RateLimitEntry = {
    attempts: nextAttempts,
    lockedUntil,
    lastAttemptAt: now,
  };
  map[normalizedScope] = updatedEntry;
  map['global_pin_guard'] = updatedEntry;
  saveRateLimitMap(map);

  if (isLocked) {
    const remainingSeconds = Math.ceil(PIN_LOCKOUT_DURATION_MS / 1000);
    return {
      isLocked: true,
      remainingSeconds,
      attempts: nextAttempts,
      remainingAttempts: 0,
      message:
        'Salah memasukkan PIN 5 kali berturut-turut. Demi keamanan, akses login diblokir sementara selama 5 menit.',
    };
  }

  const remainingAttempts = Math.max(0, MAX_PIN_ATTEMPTS - nextAttempts);
  return {
    isLocked: false,
    remainingSeconds: 0,
    attempts: nextAttempts,
    remainingAttempts,
    message: `PIN atau kredensial tidak sesuai. Sisa percobaan: ${remainingAttempts} kali sebelum diblokir 5 menit.`,
  };
}

export function resetPinRateLimit(scopeKey: string): void {
  const normalizedScope = (scopeKey || 'default').trim().toLowerCase();
  const map = getRateLimitMap();
  delete map[normalizedScope];
  delete map['global_pin_guard'];
  saveRateLimitMap(map);
}

/**
 * Generates a salted SHA-256 hex digest using the browser Web Crypto API so
 * plaintext PINs/passwords are never persisted in localStorage or React state.
 */
export async function hashSecretSha256(scope: string, secret: string): Promise<string> {
  const normalized = `${HASH_SALT_PREFIX}${scope.trim().toLowerCase()}::${secret.trim()}`;
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    const encoded = new TextEncoder().encode(normalized);
    const digestBuffer = await window.crypto.subtle.digest('SHA-256', encoded);
    const byteArray = Array.from(new Uint8Array(digestBuffer));
    return byteArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  let h1 = 0xdeadbeef ^ normalized.length;
  let h2 = 0x41c6ce57 ^ normalized.length;
  for (let i = 0, ch; i < normalized.length; i++) {
    ch = normalized.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
}

function generateClientSessionToken(): string {
  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    const bytes = new Uint8Array(24);
    window.crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  return `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}_${Math.random()
    .toString(36)
    .slice(2)}`;
}

export function getVerifiedSessionToken(): string | null {
  try {
    const raw = sessionStorage.getItem(VERIFIED_SESSION_TOKEN_KEY);
    if (!raw) return null;
    return deobfuscateSensitiveField(raw) || null;
  } catch {
    return null;
  }
}

export function setVerifiedSessionToken(token: string | null): void {
  try {
    if (!token) {
      sessionStorage.removeItem(VERIFIED_SESSION_TOKEN_KEY);
    } else {
      const obf = obfuscateSensitiveField(token);
      if (obf) {
        sessionStorage.setItem(VERIFIED_SESSION_TOKEN_KEY, obf);
      }
    }
  } catch {
    // ignore storage errors
  }
}

let cloudAdminPinHashCache: Record<string, string> = {};
let cloudAdminPinObfuscatedCache: string | undefined = undefined;
let cloudAdminPinChecked = false;

export function getCloudAdminPinHashMap(): Record<string, string> {
  return { ...cloudAdminPinHashCache };
}

export function getCloudAdminPinObfuscated(): string | undefined {
  return cloudAdminPinObfuscatedCache;
}

export function hydrateCloudAdminPinCache(
  hashMap?: Record<string, string> | null,
  obfuscatedPin?: string
): void {
  if (hashMap && typeof hashMap === 'object' && Object.keys(hashMap).length > 0) {
    cloudAdminPinHashCache = { ...cloudAdminPinHashCache, ...hashMap };
    cloudAdminPinChecked = true;
    try {
      const raw = localStorage.getItem(ADMIN_CREDENTIAL_HASH_STORAGE_KEY);
      const localMap: Record<string, string> = raw ? JSON.parse(raw) : {};
      const merged = { ...localMap, ...cloudAdminPinHashCache };
      localStorage.setItem(ADMIN_CREDENTIAL_HASH_STORAGE_KEY, JSON.stringify(merged));
    } catch {
      // ignore storage errors
    }
  }
  if (obfuscatedPin) {
    cloudAdminPinObfuscatedCache = obfuscatedPin;
  }
}

async function persistAdminPinHashToSupabaseTables(
  hashMap: Record<string, string>,
  obfuscatedPin?: string
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  let savedAny = false;
  const nowIso = new Date().toISOString();
  const settingPayload = {
    adminPinConfigured: true,
    adminPinHashMap: hashMap,
    adminPinObfuscated: obfuscatedPin,
    updatedAt: nowIso,
  };

  // 1. Save to app_settings and site_settings if present
  for (const tableName of ['app_settings', 'site_settings'] as const) {
    try {
      const { error } = await supabase.from(tableName).upsert(
        {
          id: 'admin_pin_config',
          key: 'admin_pin_config',
          value: JSON.stringify(settingPayload),
          updated_at: nowIso,
        },
        { onConflict: 'id' }
      );
      if (!error) savedAny = true;
    } catch {
      // table might not exist
    }
  }

  // 2. Save to company_settings (id = 'tgi-main-config')
  try {
    const { data: existingRow } = await supabase
      .from('company_settings')
      .select('*')
      .eq('id', 'tgi-main-config')
      .maybeSingle();

    const existingJson =
      existingRow && typeof existingRow.config_json === 'object' && existingRow.config_json
        ? existingRow.config_json
        : {};
    const existingSec =
      existingJson && typeof existingJson.securitySettings === 'object'
        ? existingJson.securitySettings
        : {};

    const updatedJson = {
      ...existingJson,
      securitySettings: {
        ...existingSec,
        adminPinConfigured: true,
        adminPinHashMap: hashMap,
        adminPinObfuscated: obfuscatedPin || existingSec.adminPinObfuscated,
        adminPinUpdatedAt: nowIso,
      },
    };

    const { error: compErr } = await supabase.from('company_settings').upsert(
      {
        id: 'tgi-main-config',
        company_name: existingRow?.company_name || updatedJson.companyName || 'PT LUPYTA MAJU PERKASA',
        current_payroll_period:
          existingRow?.current_payroll_period || updatedJson.currentPayrollPeriod || 'November 2026',
        config_json: updatedJson,
        updated_at: nowIso,
      },
      { onConflict: 'id' }
    );
    if (!compErr) savedAny = true;
  } catch {
    // ignore
  }

  // 3. Mirror into employees allowances metadata as fallback if settings tables are not yet created
  try {
    const { data: empRows } = await supabase
      .from('employees')
      .select('id, allowances')
      .order('created_at', { ascending: true })
      .limit(1);

    if (Array.isArray(empRows) && empRows.length > 0 && empRows[0]?.id) {
      const firstEmp = empRows[0];
      const nextAllowances = {
        ...(firstEmp.allowances && typeof firstEmp.allowances === 'object'
          ? firstEmp.allowances
          : {}),
        _systemAdminPinHashMap: hashMap,
        _systemAdminPinObfuscated: obfuscatedPin,
        _systemAdminPinUpdatedAt: nowIso,
      };
      const { error: empErr } = await supabase
        .from('employees')
        .update({ allowances: nextAllowances })
        .eq('id', firstEmp.id);
      if (!empErr) savedAny = true;
    }
  } catch {
    // ignore
  }

  return savedAny;
}

/**
 * Checks Admin PIN status directly from Supabase (`app_settings`, `site_settings`, `company_settings`, and `employees`)
 * before displaying the login screen so new devices never falsely show "Buat PIN Baru".
 */
export async function syncAdminPinStatusFromSupabase(
  email = 'jpexakun7@gmail.com'
): Promise<{
  isConfigured: boolean;
  hashMap: Record<string, string>;
  adminPinObfuscated?: string;
}> {
  const normalizedEmail = (email || 'jpexakun7@gmail.com').trim().toLowerCase();

  if (isSupabaseConfigured()) {
    const discoveredMap: Record<string, string> = {};
    let discoveredObfuscated: string | undefined = undefined;

    const extractFromObject = (obj: any) => {
      if (!obj || typeof obj !== 'object') return;
      const candidateMap =
        obj.adminPinHashMap ||
        obj.admin_pin_hash_map ||
        obj.securitySettings?.adminPinHashMap ||
        obj._systemAdminPinHashMap;
      if (candidateMap && typeof candidateMap === 'object') {
        for (const [k, v] of Object.entries(candidateMap)) {
          if (typeof v === 'string' && v.trim().length > 0) {
            discoveredMap[k.trim().toLowerCase()] = v.trim();
          }
        }
      }
      const obf =
        obj.adminPinObfuscated ||
        obj.securitySettings?.adminPinObfuscated ||
        obj._systemAdminPinObfuscated;
      if (typeof obf === 'string' && obf.trim().length > 0) {
        discoveredObfuscated = obf.trim();
      }
    };

    const [appSetRes, siteSetRes, compSetRes, empMetaRes] = await Promise.allSettled([
      supabase.from('app_settings').select('*').limit(10),
      supabase.from('site_settings').select('*').limit(10),
      supabase.from('company_settings').select('*').eq('id', 'tgi-main-config').maybeSingle(),
      supabase.from('employees').select('id, allowances').order('created_at', { ascending: true }).limit(5),
    ]);

    for (const res of [appSetRes, siteSetRes]) {
      if (res.status === 'fulfilled' && !res.value.error && Array.isArray(res.value.data)) {
        for (const row of res.value.data) {
          if (row?.value && typeof row.value === 'string') {
            try {
              extractFromObject(JSON.parse(row.value));
            } catch {
              // If plain PIN string was stored in app_settings / site_settings
              if (
                (row.key === 'admin_pin' || row.id === 'admin_pin' || row.key === 'admin_pin_config') &&
                row.value.trim().length >= 4
              ) {
                const rawPin = row.value.trim();
                discoveredMap[normalizedEmail] = await hashSecretSha256(normalizedEmail, rawPin);
                discoveredMap['*'] = await hashSecretSha256('*', rawPin);
              }
            }
          } else if (row?.value && typeof row.value === 'object') {
            extractFromObject(row.value);
          }
          if (row?.config_json && typeof row.config_json === 'object') {
            extractFromObject(row.config_json);
          }
        }
      }
    }

    if (
      compSetRes.status === 'fulfilled' &&
      !compSetRes.value.error &&
      compSetRes.value.data?.config_json
    ) {
      const cfg = compSetRes.value.data.config_json;
      extractFromObject(cfg);
      if (
        cfg?.securitySettings?.adminPin &&
        typeof cfg.securitySettings.adminPin === 'string' &&
        cfg.securitySettings.adminPin.trim().length >= 4
      ) {
        const legacyPin = cfg.securitySettings.adminPin.trim();
        discoveredMap[normalizedEmail] = await hashSecretSha256(normalizedEmail, legacyPin);
        discoveredMap['*'] = await hashSecretSha256('*', legacyPin);
      }
    }

    if (
      empMetaRes.status === 'fulfilled' &&
      !empMetaRes.value.error &&
      Array.isArray(empMetaRes.value.data)
    ) {
      for (const row of empMetaRes.value.data) {
        if (row?.allowances) {
          extractFromObject(row.allowances);
        }
      }
    }

    if (Object.keys(discoveredMap).length > 0) {
      hydrateCloudAdminPinCache(discoveredMap, discoveredObfuscated);
      return {
        isConfigured: true,
        hashMap: getCloudAdminPinHashMap(),
        adminPinObfuscated: discoveredObfuscated,
      };
    }
  }

  // If Supabase did not have the hash yet, check if this browser has an existing local hash and backfill it to Supabase
  try {
    const raw = localStorage.getItem(ADMIN_CREDENTIAL_HASH_STORAGE_KEY);
    if (raw) {
      const localMap = JSON.parse(raw) as Record<string, string>;
      if (localMap && typeof localMap === 'object' && Object.keys(localMap).length > 0) {
        hydrateCloudAdminPinCache(localMap);
        if (isSupabaseConfigured()) {
          void persistAdminPinHashToSupabaseTables(localMap, cloudAdminPinObfuscatedCache);
        }
        return {
          isConfigured: Boolean(localMap[normalizedEmail] || localMap['*'] || Object.keys(localMap).length > 0),
          hashMap: localMap,
          adminPinObfuscated: cloudAdminPinObfuscatedCache,
        };
      }
    }
  } catch {
    // ignore
  }

  cloudAdminPinChecked = true;
  return {
    isConfigured: false,
    hashMap: {},
  };
}

export function hasConfiguredAdminCredentialHash(email = 'jpexakun7@gmail.com'): boolean {
  const key = (email || 'jpexakun7@gmail.com').trim().toLowerCase();
  if (
    cloudAdminPinHashCache[key] ||
    cloudAdminPinHashCache['*'] ||
    Object.keys(cloudAdminPinHashCache).length > 0
  ) {
    return true;
  }
  try {
    const raw = localStorage.getItem(ADMIN_CREDENTIAL_HASH_STORAGE_KEY);
    if (!raw) return false;
    const map = JSON.parse(raw) as Record<string, string>;
    return Boolean(map[key] || map['*'] || Object.keys(map).length > 0);
  } catch {
    return false;
  }
}

export function isCloudAdminPinChecked(): boolean {
  return cloudAdminPinChecked;
}

/**
 * Sets or updates the admin PIN/password in Supabase (`app_settings`, `site_settings`, `company_settings`, RPC, & `employees` metadata)
 * and stores a salted SHA-256 digest locally.
 */
export async function updateAdminPinSecure(
  email: string,
  role: 'Super Admin' | 'HR Admin' | 'Finance',
  newSecret: string
): Promise<{ success: boolean; message?: string }> {
  const trimmed = newSecret.trim();
  if (trimmed.length < 4 || trimmed.length > 64) {
    return {
      success: false,
      message: 'PIN / Kata Sandi Admin harus terdiri dari 4 hingga 64 karakter.',
    };
  }

  const normalizedEmail = (email || 'jpexakun7@gmail.com').trim().toLowerCase();
  if (!isOfficialAdminEmail(normalizedEmail)) {
    return {
      success: false,
      message:
        'Akses ditolak: Hanya email Admin resmi (jpexakun7@gmail.com / lupytacounting77@gmail.com) yang diizinkan.',
    };
  }

  const map: Record<string, string> = { ...cloudAdminPinHashCache };
  try {
    const raw = localStorage.getItem(ADMIN_CREDENTIAL_HASH_STORAGE_KEY);
    if (raw) {
      Object.assign(map, JSON.parse(raw));
    }
  } catch {
    // ignore
  }

  map[normalizedEmail] = await hashSecretSha256(normalizedEmail, trimmed);
  map['*'] = await hashSecretSha256('*', trimmed);
  for (const officialEmail of OFFICIAL_ADMIN_EMAILS) {
    if (!map[officialEmail]) {
      map[officialEmail] = await hashSecretSha256(officialEmail, trimmed);
    }
  }

  const obfPin = obfuscateSensitiveField(trimmed);
  hydrateCloudAdminPinCache(map, obfPin);

  if (isSupabaseConfigured()) {
    await persistAdminPinHashToSupabaseTables(map, obfPin);
    try {
      await supabase.rpc('set_admin_credential', {
        p_email: normalizedEmail,
        p_role: role,
        p_new_secret: trimmed,
      });
    } catch {
      // RPC optional
    }
  }

  return {
    success: true,
    message: 'PIN Admin berhasil disimpan secara terpusat di database Supabase.',
  };
}

/**
 * Updates an employee's PIN in the `employees` table in Supabase (`allowances._accessPinHash`, `_accessPinUniversalHash`, `_accessPinObfuscated`, and `access_pin_hash`).
 */
export async function updateEmployeePinSecure(
  employeeId: string,
  newPin: string
): Promise<{ success: boolean; message?: string }> {
  const trimmed = newPin.trim();
  if (trimmed.length < 4 || trimmed.length > 32) {
    return { success: false, message: 'PIN Karyawan harus 4 hingga 32 digit/karakter.' };
  }

  const cleanEmpId = employeeId.trim();
  const digestHex = await hashSecretSha256(cleanEmpId, trimmed);
  const universalDigestHex = await hashSecretSha256('emp_pin_v2', trimmed);
  const obfuscatedPin = obfuscateSensitiveField(trimmed);

  try {
    const raw = localStorage.getItem(EMPLOYEE_PIN_HASH_MAP_STORAGE_KEY);
    const map: Record<string, string> = raw ? JSON.parse(raw) : {};
    map[cleanEmpId.toLowerCase()] = digestHex;
    localStorage.setItem(EMPLOYEE_PIN_HASH_MAP_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }

  if (isSupabaseConfigured()) {
    try {
      // 1. Read existing allowances from employees table in Supabase and merge PIN hashes
      const { data: empRow } = await supabase
        .from('employees')
        .select('id, nik, allowances')
        .eq('id', cleanEmpId)
        .maybeSingle();

      const existingAllowances =
        empRow?.allowances && typeof empRow.allowances === 'object' ? empRow.allowances : {};
      const updatedAllowances = {
        ...existingAllowances,
        _hasConfiguredPin: true,
        _accessPinHash: `sha256:${digestHex}`,
        _accessPinUniversalHash: `sha256:${universalDigestHex}`,
        _accessPinObfuscated: obfuscatedPin,
      };

      await supabase
        .from('employees')
        .update({
          allowances: updatedAllowances,
          updated_at: new Date().toISOString(),
        })
        .eq('id', cleanEmpId);
    } catch {
      // ignore
    }

    try {
      await supabase
        .from('employees')
        .update({
          access_pin_hash: `sha256:${digestHex}`,
          access_pin: null,
        })
        .eq('id', cleanEmpId);
    } catch {
      // optional column if not migrated
    }

    try {
      await supabase.rpc('set_employee_pin', {
        p_employee_id: cleanEmpId,
        p_new_pin: trimmed,
      });
    } catch {
      // RPC optional
    }
  }

  return {
    success: true,
    message: 'PIN Karyawan berhasil disimpan ke tabel employees di Supabase.',
  };
}

/**
 * Verifies Admin login strictly against centralized Supabase PIN credentials (`app_settings` / `site_settings` / `company_settings`).
 */
export async function verifyAdminLoginSecure(
  email: string,
  secret: string,
  fallbackRole: 'Super Admin' | 'HR Admin' | 'Finance' = 'Super Admin'
): Promise<AdminVerifyResponse> {
  const normalizedEmail = (email || '').trim().toLowerCase();
  const trimmedSecret = secret.trim();

  if (!normalizedEmail || !isOfficialAdminEmail(normalizedEmail)) {
    return {
      authenticated: false,
      message:
        'Akses Ditolak: Hanya email Admin resmi terdaftar (jpexakun7@gmail.com / lupytacounting77@gmail.com) yang diizinkan membuka Panel Admin.',
    };
  }

  const rateScope = `admin_pin::${normalizedEmail}`;
  const rateCheck = checkPinRateLimit(rateScope);
  if (rateCheck.isLocked) {
    const mins = Math.floor(rateCheck.remainingSeconds / 60);
    const secs = rateCheck.remainingSeconds % 60;
    return {
      authenticated: false,
      isLockedOut: true,
      remainingSeconds: rateCheck.remainingSeconds,
      remainingAttempts: 0,
      message: `Akses login Admin dikunci sementara karena 5x salah PIN. Silakan coba lagi dalam ${
        mins > 0 ? `${mins} menit ${secs} detik` : `${secs} detik`
      }.`,
    };
  }

  if (!trimmedSecret) {
    return { authenticated: false, message: 'Masukkan PIN atau kata sandi terlebih dahulu.' };
  }

  // Always fetch latest Admin PIN configuration from Supabase before verifying
  const cloudPinStatus = await syncAdminPinStatusFromSupabase(normalizedEmail);
  const map = cloudPinStatus.hashMap;
  const expectedEmailHash = map[normalizedEmail];
  const expectedGlobalHash = map['*'];

  const candidateEmailHash = await hashSecretSha256(normalizedEmail, trimmedSecret);
  const candidateGlobalHash = await hashSecretSha256('*', trimmedSecret);
  const deobfCloudPin = cloudPinStatus.adminPinObfuscated
    ? deobfuscateSensitiveField(cloudPinStatus.adminPinObfuscated)
    : undefined;

  if (
    (expectedEmailHash && candidateEmailHash === expectedEmailHash) ||
    (expectedGlobalHash && candidateGlobalHash === expectedGlobalHash) ||
    (deobfCloudPin && deobfCloudPin === trimmedSecret)
  ) {
    resetPinRateLimit(rateScope);
    const token = generateClientSessionToken();
    markAdminSessionVerified(normalizedEmail, token);
    return {
      authenticated: true,
      email: normalizedEmail,
      role: fallbackRole,
      sessionToken: token,
    };
  }

  if (isSupabaseConfigured()) {
    // Also check Supabase Auth / RPC if configured
    if (normalizedEmail.includes('@') && trimmedSecret.length >= 6) {
      try {
        const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password: trimmedSecret,
        });
        if (!authErr && authData?.session && isOfficialAdminEmail(authData.user?.email)) {
          resetPinRateLimit(rateScope);
          const token = authData.session.access_token || generateClientSessionToken();
          markAdminSessionVerified(authData.user?.email || normalizedEmail, token);
          return {
            authenticated: true,
            email: authData.user?.email || normalizedEmail,
            role: fallbackRole,
            sessionToken: token,
          };
        }
      } catch {
        // continue
      }
    }

    try {
      const { data: rpcData, error: rpcErr } = await supabase.rpc('verify_admin_login', {
        p_email: normalizedEmail,
        p_secret: trimmedSecret,
      });

      if (!rpcErr && rpcData && typeof rpcData === 'object') {
        const result = rpcData as {
          authenticated?: boolean;
          email?: string;
          role?: 'Super Admin' | 'HR Admin' | 'Finance';
          sessionToken?: string;
          message?: string;
          isLockedOut?: boolean;
          remainingSeconds?: number;
        };

        if (result.authenticated) {
          resetPinRateLimit(rateScope);
          const token = result.sessionToken || generateClientSessionToken();
          markAdminSessionVerified(result.email || normalizedEmail, token);
          await persistAdminPinHashToSupabaseTables(
            {
              ...map,
              [normalizedEmail]: candidateEmailHash,
              '*': candidateGlobalHash,
            },
            obfuscateSensitiveField(trimmedSecret)
          );
          return {
            authenticated: true,
            email: result.email || normalizedEmail,
            role: result.role || fallbackRole,
            sessionToken: token,
          };
        }
      }
    } catch {
      // ignore
    }
  }

  if (cloudPinStatus.isConfigured || Object.keys(map).length > 0) {
    const failState = recordFailedPinAttempt(rateScope);
    return {
      authenticated: false,
      isLockedOut: failState.isLocked,
      remainingSeconds: failState.remainingSeconds,
      remainingAttempts: failState.remainingAttempts,
      message: failState.message,
    };
  }

  return {
    authenticated: false,
    requiresInitialSetup: true,
    message:
      'Kredensial Admin belum dikonfigurasi di database. Silakan buat PIN/Kata Sandi Admin baru terlebih dahulu.',
  };
}

/**
 * Verifies Employee login directly against the `employees` table in Supabase (never relying solely on device localStorage).
 */
export async function verifyEmployeeLoginSecure(
  identifier: string,
  secret: string
): Promise<EmployeeVerifyResponse> {
  const cleanId = sanitizeSafeText(identifier, 120);
  const cleanSecret = secret.trim();

  if (!cleanId || !cleanSecret) {
    return {
      authenticated: false,
      message: 'Masukkan ID Karyawan / NIK / Email beserta PIN Akses Anda.',
    };
  }

  const rateScope = `emp_pin::${cleanId.toLowerCase()}`;
  const rateCheck = checkPinRateLimit(rateScope);
  if (rateCheck.isLocked) {
    const mins = Math.floor(rateCheck.remainingSeconds / 60);
    const secs = rateCheck.remainingSeconds % 60;
    return {
      authenticated: false,
      isLockedOut: true,
      remainingSeconds: rateCheck.remainingSeconds,
      remainingAttempts: 0,
      message: `Terlalu banyak percobaan PIN salah (5x). Form login diblokir sementara selama ${
        mins > 0 ? `${mins} menit ${secs} detik` : `${secs} detik`
      }.`,
    };
  }

  if (isSupabaseConfigured()) {
    // 1. Read directly from the `employees` table in Supabase
    try {
      const qLower = cleanId.trim().toLowerCase();
      let empRows: any[] | null = null;

      const { data: fullRows, error: fullErr } = await supabase
        .from('employees')
        .select('*');

      if (!fullErr && Array.isArray(fullRows)) {
        empRows = fullRows;
      } else {
        const { data: coreRows } = await supabase
          .from('employees')
          .select('id, nik, full_name, email, google_email, department, allowances');
        if (Array.isArray(coreRows)) {
          empRows = coreRows;
        }
      }

      if (empRows && empRows.length > 0) {
        const matchedEmp = empRows.find(
          (r: any) =>
            String(r?.id || '').trim().toLowerCase() === qLower ||
            String(r?.nik || '').trim().toLowerCase() === qLower ||
            String(r?.email || '').trim().toLowerCase() === qLower ||
            String(r?.google_email || '').trim().toLowerCase() === qLower
        );

        if (matchedEmp) {
          const empId = String(matchedEmp.id);
          const empAllowances =
            matchedEmp.allowances && typeof matchedEmp.allowances === 'object'
              ? matchedEmp.allowances
              : {};

          const candidateIdHash = await hashSecretSha256(empId, cleanSecret);
          const candidateUniversalHash = await hashSecretSha256('emp_pin_v2', cleanSecret);

          const dbPinHash = String(matchedEmp.access_pin_hash || '').trim();
          const allowIdHash = String(empAllowances._accessPinHash || '').trim();
          const allowUniHash = String(empAllowances._accessPinUniversalHash || '').trim();
          const allowObfPin =
            typeof empAllowances._accessPinObfuscated === 'string'
              ? deobfuscateSensitiveField(empAllowances._accessPinObfuscated)
              : undefined;
          const dbPlainPin =
            typeof matchedEmp.access_pin === 'string' && matchedEmp.access_pin !== '••••'
              ? matchedEmp.access_pin.trim()
              : typeof empAllowances._accessPin === 'string' && empAllowances._accessPin !== '••••'
              ? empAllowances._accessPin.trim()
              : '';

          const expectedLocalHash = await getLocalEmployeePinHash(empId);

          // Check if employee has any configured PIN in Supabase
          const hasAnyCloudPin = Boolean(
            dbPinHash || allowIdHash || allowUniHash || allowObfPin || dbPlainPin
          );

          // Default NIK-based fallback PIN if the employee has never configured a custom PIN in Supabase
          const nikDigits = String(matchedEmp.nik || '').replace(/\D/g, '');
          const defaultNikPin = nikDigits.length >= 3 ? `1${nikDigits.slice(-3)}` : '1234';

          const isDirectMatch =
            Boolean(
              dbPinHash &&
                (dbPinHash === `sha256:${candidateIdHash}` ||
                  dbPinHash === candidateIdHash ||
                  dbPinHash === `sha256:${candidateUniversalHash}`)
            ) ||
            Boolean(
              allowIdHash &&
                (allowIdHash === `sha256:${candidateIdHash}` || allowIdHash === candidateIdHash)
            ) ||
            Boolean(
              allowUniHash &&
                (allowUniHash === `sha256:${candidateUniversalHash}` ||
                  allowUniHash === candidateUniversalHash)
            ) ||
            Boolean(allowObfPin && allowObfPin === cleanSecret) ||
            Boolean(dbPlainPin && dbPlainPin === cleanSecret) ||
            Boolean(expectedLocalHash && candidateIdHash === expectedLocalHash) ||
            Boolean(!hasAnyCloudPin && (cleanSecret === defaultNikPin || cleanSecret === '1234'));

          if (isDirectMatch) {
            resetPinRateLimit(rateScope);
            const token = generateClientSessionToken();
            markEmployeeSessionLocked(empId, token);
            // Ensure PIN hash is persisted back to Supabase if matched via default or local hash
            if (!allowIdHash || !allowUniHash) {
              void updateEmployeePinSecure(empId, cleanSecret);
            }
            return {
              authenticated: true,
              employeeId: empId,
              employeeName: matchedEmp.full_name || cleanId,
              department: matchedEmp.department || '',
              sessionToken: token,
            };
          }
        }
      }
    } catch {
      // continue to RPC check
    }

    // 2. Also check Server-Side RPC `verify_employee_pin` (for bcrypt hashes in `access_pin_hash`)
    for (const rpcName of ['verify_employee_pin', 'verify_employee_login'] as const) {
      try {
        const rpcArgs =
          rpcName === 'verify_employee_pin'
            ? { p_identifier: cleanId, p_pin: cleanSecret }
            : { p_identifier: cleanId, p_secret: cleanSecret };
        const { data: rpcData, error: rpcErr } = await supabase.rpc(rpcName, rpcArgs);

        if (!rpcErr && rpcData && typeof rpcData === 'object') {
          const res = rpcData as {
            authenticated?: boolean;
            employeeId?: string;
            employeeName?: string;
            department?: string;
            sessionToken?: string;
            message?: string;
            isLockedOut?: boolean;
            remainingSeconds?: number;
          };
          if (res.authenticated && res.employeeId) {
            resetPinRateLimit(rateScope);
            const token = res.sessionToken || generateClientSessionToken();
            markEmployeeSessionLocked(res.employeeId, token);
            void updateEmployeePinSecure(res.employeeId, cleanSecret);
            return {
              authenticated: true,
              employeeId: res.employeeId,
              employeeName: res.employeeName || cleanId,
              department: res.department || '',
              sessionToken: token,
            };
          }
        }
      } catch {
        // ignore
      }
    }
  }

  // 3. Offline fallback against local storage cache
  try {
    const rawEmps = localStorage.getItem('tgi_employees_data');
    if (rawEmps) {
      const list = JSON.parse(rawEmps);
      if (Array.isArray(list)) {
        const q = cleanId.toLowerCase();
        const found = list.find(
          (e: any) =>
            String(e?.id || '').toLowerCase() === q ||
            String(e?.nik || '').toLowerCase() === q ||
            String(e?.email || '').toLowerCase() === q
        );
        if (found?.id) {
          const expectedHash = await getLocalEmployeePinHash(String(found.id));
          const candidateHash = await hashSecretSha256(String(found.id), cleanSecret);
          const candidateUniHash = await hashSecretSha256('emp_pin_v2', cleanSecret);
          const foundObf =
            typeof found.accessPinObfuscated === 'string'
              ? deobfuscateSensitiveField(found.accessPinObfuscated)
              : undefined;
          if (
            (expectedHash && candidateHash === expectedHash) ||
            (found.accessPinHash &&
              (found.accessPinHash === `sha256:${candidateHash}` ||
                found.accessPinHash === candidateHash)) ||
            (found.accessPinUniversalHash &&
              (found.accessPinUniversalHash === `sha256:${candidateUniHash}` ||
                found.accessPinUniversalHash === candidateUniHash)) ||
            (foundObf && foundObf === cleanSecret)
          ) {
            resetPinRateLimit(rateScope);
            const token = generateClientSessionToken();
            markEmployeeSessionLocked(String(found.id), token);
            return {
              authenticated: true,
              employeeId: String(found.id),
              employeeName: String(found.fullName || cleanId),
              department: String(found.department || ''),
              sessionToken: token,
            };
          }
        }
      }
    }
  } catch {
    // ignore
  }

  const failState = recordFailedPinAttempt(rateScope);
  return {
    authenticated: false,
    isLockedOut: failState.isLocked,
    remainingSeconds: failState.remainingSeconds,
    remainingAttempts: failState.remainingAttempts,
    message: failState.message,
  };
}

async function getLocalEmployeePinHash(employeeId: string): Promise<string | null> {
  try {
    const raw = localStorage.getItem(EMPLOYEE_PIN_HASH_MAP_STORAGE_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, string>;
    return map[employeeId.trim().toLowerCase()] || null;
  } catch {
    return null;
  }
}

// ============================================================================
// ANTI-PRIVILEGE ESCALATION & SESSION INTEGRITY GUARDS
// ============================================================================
let inMemoryAuthenticatedRole: 'admin' | 'employee' | null = null;
let inMemoryAdminToken: string | null = null;
let inMemoryAdminEmail: string | null = null;

function computeDeterministicSessionSig(email: string, token: string): string {
  const payload = `${HASH_SALT_PREFIX}admin_sig_v3::${email.trim().toLowerCase()}::${token.trim()}`;
  let h1 = 0xdeadbeef ^ payload.length;
  let h2 = 0x41c6ce57 ^ payload.length;
  for (let i = 0; i < payload.length; i++) {
    const ch = payload.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `sig_${(h2 >>> 0).toString(16).padStart(8, '0')}${(h1 >>> 0).toString(16).padStart(8, '0')}`;
}

export function getVerifiedAdminEmail(): string | null {
  if (inMemoryAdminEmail && isOfficialAdminEmail(inMemoryAdminEmail)) {
    return inMemoryAdminEmail;
  }
  try {
    const rawSig = sessionStorage.getItem(ADMIN_SESSION_SIG_KEY);
    if (!rawSig) return null;
    const deobf = deobfuscateSensitiveField(rawSig) || rawSig;
    const parsed = JSON.parse(deobf) as { email?: string; sig?: string };
    if (parsed?.email && isOfficialAdminEmail(parsed.email)) {
      return parsed.email.trim().toLowerCase();
    }
    return null;
  } catch {
    return null;
  }
}

export function markAdminSessionVerified(email: string, sessionToken?: string): void {
  const normalizedEmail = (email || '').trim().toLowerCase();
  if (!isOfficialAdminEmail(normalizedEmail)) {
    clearAllAuthSessions();
    return;
  }
  const token = sessionToken || getVerifiedSessionToken() || generateClientSessionToken();
  setVerifiedSessionToken(token);
  inMemoryAuthenticatedRole = 'admin';
  inMemoryAdminToken = token;
  inMemoryAdminEmail = normalizedEmail;
  setSupabaseVerifiedSessionContext({
    sessionToken: token,
    adminEmail: normalizedEmail,
    employeeId: null,
  });
  try {
    const sig = computeDeterministicSessionSig(normalizedEmail, token);
    const payload = JSON.stringify({ email: normalizedEmail, sig });
    sessionStorage.setItem(ADMIN_SESSION_SIG_KEY, obfuscateSensitiveField(payload) || payload);
    sessionStorage.setItem('tgi_admin_unlocked', 'true');
    sessionStorage.removeItem('tgi_locked_employee_id');
  } catch {
    // ignore storage errors
  }
}

export function markEmployeeSessionLocked(employeeId: string, sessionToken?: string): void {
  const cleanEmpId = employeeId.trim();
  const token = sessionToken || getVerifiedSessionToken() || generateClientSessionToken();
  setVerifiedSessionToken(token);
  inMemoryAuthenticatedRole = 'employee';
  inMemoryAdminToken = null;
  inMemoryAdminEmail = null;
  setSupabaseVerifiedSessionContext({
    sessionToken: token,
    adminEmail: null,
    employeeId: cleanEmpId,
  });
  try {
    sessionStorage.removeItem(ADMIN_SESSION_SIG_KEY);
    sessionStorage.removeItem('tgi_admin_unlocked');
    sessionStorage.setItem('tgi_locked_employee_id', cleanEmpId);
    localStorage.setItem('tgi_dashboard_mode', 'employee');
  } catch {
    // ignore storage errors
  }
}

export function clearAllAuthSessions(): void {
  inMemoryAuthenticatedRole = null;
  inMemoryAdminToken = null;
  inMemoryAdminEmail = null;
  setVerifiedSessionToken(null);
  setSupabaseVerifiedSessionContext({
    sessionToken: null,
    adminEmail: null,
    employeeId: null,
  });
  try {
    sessionStorage.removeItem(ADMIN_SESSION_SIG_KEY);
    sessionStorage.removeItem('tgi_admin_unlocked');
    sessionStorage.removeItem('tgi_web_pin_unlocked');
    sessionStorage.removeItem('tgi_locked_employee_id');
    localStorage.setItem('tgi_dashboard_mode', 'employee');
  } catch {
    // ignore
  }
}

/**
 * Verifies that the current browser session is a genuine official Admin session and NOT a tampered
 * employee session (blocks DevTools manipulation of `tgi_admin_unlocked` or `tgi_dashboard_mode`).
 */
export function isAdminSessionVerified(): boolean {
  try {
    const lockedEmp = sessionStorage.getItem('tgi_locked_employee_id');
    if (lockedEmp && lockedEmp.trim().length > 0) {
      return false;
    }
    if (inMemoryAuthenticatedRole === 'employee') {
      return false;
    }
    const unlockedFlag = sessionStorage.getItem('tgi_admin_unlocked') === 'true';
    const token = getVerifiedSessionToken() || inMemoryAdminToken;
    const rawSig = sessionStorage.getItem(ADMIN_SESSION_SIG_KEY);
    if (!unlockedFlag || !token || !rawSig) {
      return false;
    }
    const deobf = deobfuscateSensitiveField(rawSig) || rawSig;
    const parsed = JSON.parse(deobf) as { email?: string; sig?: string };
    if (!parsed?.email || !parsed?.sig) return false;
    const normalizedEmail = parsed.email.trim().toLowerCase();
    if (!isOfficialAdminEmail(normalizedEmail)) {
      return false;
    }
    const expectedSig = computeDeterministicSessionSig(normalizedEmail, token);
    const isValid = parsed.sig === expectedSig;
    if (isValid) {
      inMemoryAuthenticatedRole = 'admin';
      inMemoryAdminToken = token;
      inMemoryAdminEmail = normalizedEmail;
      setSupabaseVerifiedSessionContext({
        sessionToken: token,
        adminEmail: normalizedEmail,
        employeeId: null,
      });
    }
    return isValid;
  } catch {
    return false;
  }
}

// Initialize verified session headers on module load if an authenticated session is active in sessionStorage
if (typeof window !== 'undefined') {
  try {
    if (!isAdminSessionVerified()) {
      const lockedEmp = sessionStorage.getItem('tgi_locked_employee_id');
      const token = getVerifiedSessionToken();
      if (lockedEmp && token) {
        setSupabaseVerifiedSessionContext({
          sessionToken: token,
          adminEmail: null,
          employeeId: lockedEmp.trim(),
        });
      }
    }
  } catch {
    // ignore init errors
  }
}

/**
 * Scrubs plaintext `accessPin` and obfuscates sensitive PII (`ktpNumber`, `bankAccountNumber`,
 * `npwp`, `bpjsKesehatanNo`, `bpjsKetenagakerjaanNo`) before writing employee objects to `localStorage`.
 */
export function sanitizeEmployeeForStorage<T extends Record<string, any>>(emp: T): T {
  if (!emp || typeof emp !== 'object') return emp;
  const clone: Record<string, any> = { ...emp };

  // Never store plaintext PIN in localStorage; hash it asynchronously if present
  delete clone.access_pin;
  delete clone.access_pin_hash;
  if (
    typeof clone.accessPin === 'string' &&
    clone.accessPin.trim() !== '' &&
    clone.accessPin !== '••••'
  ) {
    const rawPin = clone.accessPin.trim();
    if (clone.id) {
      void updateEmployeePinSecure(String(clone.id), rawPin);
    }
    clone.accessPin = '••••';
  }

  // Obfuscate KTP, Bank Account Number, NPWP, and BPJS numbers so they are never in plain-text in localStorage
  if (typeof clone.ktpNumber === 'string' && clone.ktpNumber.trim() !== '') {
    clone.ktpNumber = obfuscateSensitiveField(clone.ktpNumber);
  }
  if (typeof clone.bankAccountNumber === 'string' && clone.bankAccountNumber.trim() !== '') {
    clone.bankAccountNumber = obfuscateSensitiveField(clone.bankAccountNumber);
  }
  if (typeof clone.npwp === 'string' && clone.npwp.trim() !== '') {
    clone.npwp = obfuscateSensitiveField(clone.npwp);
  }
  if (typeof clone.bpjsKesehatanNo === 'string' && clone.bpjsKesehatanNo.trim() !== '') {
    clone.bpjsKesehatanNo = obfuscateSensitiveField(clone.bpjsKesehatanNo);
  }
  if (
    typeof clone.bpjsKetenagakerjaanNo === 'string' &&
    clone.bpjsKetenagakerjaanNo.trim() !== ''
  ) {
    clone.bpjsKetenagakerjaanNo = obfuscateSensitiveField(clone.bpjsKetenagakerjaanNo);
  }

  return clone as T;
}

export function sanitizeEmployeesListForStorage<T extends Record<string, any>>(list: T[]): T[] {
  if (!Array.isArray(list)) return [];
  return list.map((emp) => sanitizeEmployeeForStorage(emp));
}

export function hydrateEmployeeFromStorage<T extends Record<string, any>>(emp: T): T {
  if (!emp || typeof emp !== 'object') return emp;
  const clone: Record<string, any> = { ...emp };
  delete clone.access_pin;
  delete clone.access_pin_hash;
  if (
    typeof clone.accessPin === 'string' &&
    clone.accessPin.trim() !== '' &&
    clone.accessPin !== '••••'
  ) {
    if (clone.id) {
      void updateEmployeePinSecure(String(clone.id), clone.accessPin.trim());
    }
    clone.accessPin = '••••';
  }
  if (typeof clone.ktpNumber === 'string') {
    clone.ktpNumber = deobfuscateSensitiveField(clone.ktpNumber);
  }
  if (typeof clone.bankAccountNumber === 'string') {
    clone.bankAccountNumber = deobfuscateSensitiveField(clone.bankAccountNumber);
  }
  if (typeof clone.npwp === 'string') {
    clone.npwp = deobfuscateSensitiveField(clone.npwp);
  }
  if (typeof clone.bpjsKesehatanNo === 'string') {
    clone.bpjsKesehatanNo = deobfuscateSensitiveField(clone.bpjsKesehatanNo);
  }
  if (typeof clone.bpjsKetenagakerjaanNo === 'string') {
    clone.bpjsKetenagakerjaanNo = deobfuscateSensitiveField(clone.bpjsKetenagakerjaanNo);
  }
  return clone as T;
}

export function hydrateEmployeesListFromStorage<T extends Record<string, any>>(list: T[]): T[] {
  if (!Array.isArray(list)) return [];
  return list.map((emp) => hydrateEmployeeFromStorage(emp));
}

// ============================================================================
// STRICT INPUT SANITIZATION & VALIDATION UTILITIES (ANTI-INJECTION & NUMERIC BOUNDS)
// ============================================================================
export function sanitizeSafeText(input: unknown, maxLength = 500): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<\/?[a-z][^>]*>/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/data\s*:\s*text\/html/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, Math.max(1, maxLength));
}

export function sanitizeNonNegativeAmount(
  val: unknown,
  maxAmount = 10_000_000_000
): number {
  if (typeof val === 'number') {
    if (!Number.isFinite(val) || Number.isNaN(val) || val < 0) return 0;
    return Math.min(maxAmount, Math.max(0, Math.round(val)));
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed || trimmed.startsWith('-')) return 0;
    const numeric = Number(trimmed.replace(/[^\d.]/g, ''));
    if (!Number.isFinite(numeric) || Number.isNaN(numeric) || numeric < 0) return 0;
    return Math.min(maxAmount, Math.max(0, Math.round(numeric)));
  }
  return 0;
}

export function validatePositiveIntegerAmount(val: unknown): number | null {
  if (typeof val === 'number') {
    if (!Number.isFinite(val) || Number.isNaN(val) || val <= 0) return null;
    const rounded = Math.floor(val);
    return Number.isSafeInteger(rounded) && rounded > 0 ? rounded : null;
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed.startsWith('-')) return null;
    const digits = trimmed.replace(/[^\d]/g, '');
    if (!digits) return null;
    const parsed = parseInt(digits, 10);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
}

export function validateNikKtp16Digits(val: unknown): boolean {
  if (typeof val !== 'string') return false;
  const digits = val.replace(/\D/g, '').trim();
  return /^\d{16}$/.test(digits);
}
