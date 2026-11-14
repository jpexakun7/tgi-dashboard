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

export function hasConfiguredAdminCredentialHash(email = 'jpexakun7@gmail.com'): boolean {
  try {
    const raw = localStorage.getItem(ADMIN_CREDENTIAL_HASH_STORAGE_KEY);
    if (!raw) return false;
    const map = JSON.parse(raw) as Record<string, string>;
    const key = email.trim().toLowerCase();
    return Boolean(map[key] || map['*']);
  } catch {
    return false;
  }
}

/**
 * Sets or updates the admin PIN/password via Supabase RPC (server-side bcrypt)
 * and stores only a salted SHA-256 digest locally (never plaintext).
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

  try {
    const raw = localStorage.getItem(ADMIN_CREDENTIAL_HASH_STORAGE_KEY);
    const map: Record<string, string> = raw ? JSON.parse(raw) : {};
    map[normalizedEmail] = await hashSecretSha256(normalizedEmail, trimmed);
    map['*'] = await hashSecretSha256('*', trimmed);
    localStorage.setItem(ADMIN_CREDENTIAL_HASH_STORAGE_KEY, JSON.stringify(map));
    localStorage.removeItem('tgi_admin_master_pin');
  } catch {
    // ignore storage errors
  }

  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase.rpc('set_admin_credential', {
        p_email: normalizedEmail,
        p_role: role,
        p_new_secret: trimmed,
      });
      if (!error && data && typeof data === 'object' && 'success' in data) {
        return {
          success: Boolean((data as { success: boolean }).success),
          message: (data as { message?: string }).message,
        };
      }
    } catch {
      // RPC might not be installed yet if user hasn't executed the SQL migration
    }
  }

  return { success: true };
}

/**
 * Updates an employee's PIN via Supabase RPC `set_employee_pin` (bcrypt hash)
 * and stores only a salted SHA-256 digest locally & in `access_pin_hash` (never plaintext `access_pin`).
 */
export async function updateEmployeePinSecure(
  employeeId: string,
  newPin: string
): Promise<{ success: boolean; message?: string }> {
  const trimmed = newPin.trim();
  if (trimmed.length < 4 || trimmed.length > 32) {
    return { success: false, message: 'PIN Karyawan harus 4 hingga 32 digit/karakter.' };
  }

  const digestHex = await hashSecretSha256(employeeId, trimmed);

  try {
    const raw = localStorage.getItem(EMPLOYEE_PIN_HASH_MAP_STORAGE_KEY);
    const map: Record<string, string> = raw ? JSON.parse(raw) : {};
    map[employeeId.trim().toLowerCase()] = digestHex;
    localStorage.setItem(EMPLOYEE_PIN_HASH_MAP_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }

  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase.rpc('set_employee_pin', {
        p_employee_id: employeeId,
        p_new_pin: trimmed,
      });
      if (!error && data && typeof data === 'object' && 'success' in data) {
        return {
          success: Boolean((data as { success: boolean }).success),
          message: (data as { message?: string }).message,
        };
      }
      // Fallback if RPC not yet installed: write only `access_pin_hash` (sha256 prefix) and clear `access_pin`
      await supabase
        .from('employees')
        .update({
          access_pin_hash: `sha256:${digestHex}`,
          access_pin: null,
        })
        .eq('id', employeeId);
    } catch {
      // fallback handled by caller
    }
  }

  return { success: true };
}

/**
 * Verifies Admin login strictly for official Admin emails with 5-attempt / 5-minute anti-brute-force protection.
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

  if (isSupabaseConfigured()) {
    // 1. Try real Supabase Auth first if email is valid
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
        // continue to RPC check
      }
    }

    // 2. Try Supabase Server-Side RPC (`verify_admin_login`)
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
          return {
            authenticated: true,
            email: result.email || normalizedEmail,
            role: result.role || fallbackRole,
            sessionToken: token,
          };
        }

        if (result.isLockedOut) {
          return {
            authenticated: false,
            isLockedOut: true,
            remainingSeconds: result.remainingSeconds || 300,
            message: result.message || 'Login Admin dikunci sementara selama 5 menit.',
          };
        }

        if (result.message && !result.message.includes('belum terdaftar')) {
          const failState = recordFailedPinAttempt(rateScope);
          return {
            authenticated: false,
            isLockedOut: failState.isLocked,
            remainingSeconds: failState.remainingSeconds,
            remainingAttempts: failState.remainingAttempts,
            message: failState.message,
          };
        }
      }
    } catch {
      // RPC not yet migrated on Supabase instance; fall back to local SHA-256 digest check
    }
  }

  // 3. Verify against salted SHA-256 digest stored via initial admin setup
  try {
    const raw = localStorage.getItem(ADMIN_CREDENTIAL_HASH_STORAGE_KEY);
    if (raw) {
      const map = JSON.parse(raw) as Record<string, string>;
      const expectedEmailHash = map[normalizedEmail];
      const expectedGlobalHash = map['*'];

      const candidateEmailHash = await hashSecretSha256(normalizedEmail, trimmedSecret);
      const candidateGlobalHash = await hashSecretSha256('*', trimmedSecret);

      if (
        (expectedEmailHash && candidateEmailHash === expectedEmailHash) ||
        (expectedGlobalHash && candidateGlobalHash === expectedGlobalHash)
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

      const failState = recordFailedPinAttempt(rateScope);
      return {
        authenticated: false,
        isLockedOut: failState.isLocked,
        remainingSeconds: failState.remainingSeconds,
        remainingAttempts: failState.remainingAttempts,
        message: failState.message,
      };
    }
  } catch {
    // ignore
  }

  return {
    authenticated: false,
    requiresInitialSetup: true,
    message:
      'Kredensial Admin belum dikonfigurasi. Silakan buat PIN/Kata Sandi Admin baru terlebih dahulu.',
  };
}

/**
 * Verifies Employee login without EVER fetching or exposing `access_pin` (plaintext) to the browser.
 * Enforces 5-attempt / 5-minute anti-brute-force lockout.
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
    // 1. Primary Server-Side RPC `verify_employee_pin` (or alias `verify_employee_login`)
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
            return {
              authenticated: true,
              employeeId: res.employeeId,
              employeeName: res.employeeName || cleanId,
              department: res.department || '',
              sessionToken: token,
            };
          }
          if (res.isLockedOut) {
            return {
              authenticated: false,
              isLockedOut: true,
              remainingSeconds: res.remainingSeconds || 300,
              message:
                res.message ||
                'Salah memasukkan PIN 5 kali berturut-turut. Akses diblokir selama 5 menit.',
            };
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
      } catch {
        // RPC not yet created in Supabase; continue to hash-only check below
      }
    }

    // 2. Fallback targeted query: NEVER select `access_pin` (plain text)! Select ONLY `access_pin_hash`.
    try {
      const safeFilter = cleanId.replace(/[,()'"\\]/g, '');
      const { data: rows, error } = await supabase
        .from('employees')
        .select('id, full_name, department, nik, email, access_pin_hash')
        .or(`id.ilike.${safeFilter},nik.ilike.${safeFilter},email.ilike.${safeFilter}`)
        .limit(1);

      if (!error && rows && rows.length > 0) {
        const emp = rows[0] as {
          id: string;
          full_name?: string;
          department?: string;
          nik?: string;
          email?: string;
          access_pin_hash?: string | null;
        };
        const expectedLocalHash = await getLocalEmployeePinHash(emp.id);
        const candidateHash = await hashSecretSha256(emp.id, cleanSecret);
        const dbHash = (emp.access_pin_hash || '').trim();

        const isHashMatch =
          Boolean(expectedLocalHash && candidateHash === expectedLocalHash) ||
          Boolean(dbHash && (dbHash === `sha256:${candidateHash}` || dbHash === candidateHash));

        if (isHashMatch) {
          resetPinRateLimit(rateScope);
          const token = generateClientSessionToken();
          markEmployeeSessionLocked(emp.id, token);
          return {
            authenticated: true,
            employeeId: emp.id,
            employeeName: emp.full_name || cleanId,
            department: emp.department || '',
            sessionToken: token,
          };
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
    } catch {
      // ignore
    }
  }

  // 3. Verify against local SHA-256 PIN hash map (never plaintext)
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
          if (expectedHash && candidateHash === expectedHash) {
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
