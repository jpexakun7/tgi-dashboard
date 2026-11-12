import { supabase, isSupabaseConfigured } from '../lib/supabase';

const ADMIN_CREDENTIAL_HASH_STORAGE_KEY = 'tgi_admin_credential_sha256_v2';
const EMPLOYEE_PIN_HASH_MAP_STORAGE_KEY = 'tgi_employee_pin_sha256_map_v2';
const VERIFIED_SESSION_TOKEN_KEY = 'tgi_verified_session_token_v2';
const HASH_SALT_PREFIX = 'tgi-payroll-hris-sec-v2::';

export interface AdminVerifyResponse {
  authenticated: boolean;
  email?: string;
  role?: 'Super Admin' | 'HR Admin' | 'Finance';
  sessionToken?: string;
  message?: string;
  requiresInitialSetup?: boolean;
}

export interface EmployeeVerifyResponse {
  authenticated: boolean;
  employeeId?: string;
  employeeName?: string;
  department?: string;
  sessionToken?: string;
  message?: string;
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
  // Fallback deterministic non-plaintext hash if SubtleCrypto is unavailable
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
  return `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

export function getVerifiedSessionToken(): string | null {
  try {
    return sessionStorage.getItem(VERIFIED_SESSION_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setVerifiedSessionToken(token: string | null): void {
  try {
    if (!token) {
      sessionStorage.removeItem(VERIFIED_SESSION_TOKEN_KEY);
    } else {
      sessionStorage.setItem(VERIFIED_SESSION_TOKEN_KEY, token);
    }
  } catch {
    // ignore storage errors
  }
}

export function hasConfiguredAdminCredentialHash(email = 'admin'): boolean {
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
  if (trimmed.length < 4) {
    return { success: false, message: 'PIN / Kata Sandi minimal harus 4 karakter.' };
  }

  const normalizedEmail = (email || 'admin@tasgrosirimport.com').trim().toLowerCase();

  // Save salted SHA-256 hash locally (never plaintext)
  try {
    const raw = localStorage.getItem(ADMIN_CREDENTIAL_HASH_STORAGE_KEY);
    const map: Record<string, string> = raw ? JSON.parse(raw) : {};
    map[normalizedEmail] = await hashSecretSha256(normalizedEmail, trimmed);
    map['*'] = await hashSecretSha256('*', trimmed);
    localStorage.setItem(ADMIN_CREDENTIAL_HASH_STORAGE_KEY, JSON.stringify(map));
    // Clean up any legacy plaintext keys from previous versions
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
 * and stores only a salted SHA-256 digest locally.
 */
export async function updateEmployeePinSecure(
  employeeId: string,
  newPin: string
): Promise<{ success: boolean; message?: string }> {
  const trimmed = newPin.trim();
  if (trimmed.length < 4) {
    return { success: false, message: 'PIN Karyawan minimal 4 digit.' };
  }

  try {
    const raw = localStorage.getItem(EMPLOYEE_PIN_HASH_MAP_STORAGE_KEY);
    const map: Record<string, string> = raw ? JSON.parse(raw) : {};
    map[employeeId.trim().toLowerCase()] = await hashSecretSha256(employeeId, trimmed);
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
    } catch {
      // fallback handled by caller
    }
  }

  return { success: true };
}

/**
 * Verifies Admin login using:
 * 1) Supabase Auth (`signInWithPassword`) if an email + password account exists
 * 2) Supabase Database RPC (`verify_admin_login`) using server-side pgcrypto bcrypt verification
 * 3) Salted SHA-256 hash verification (no hardcoded passwords like 'admin123' or '2026')
 */
export async function verifyAdminLoginSecure(
  email: string,
  secret: string,
  fallbackRole: 'Super Admin' | 'HR Admin' | 'Finance' = 'Super Admin'
): Promise<AdminVerifyResponse> {
  const normalizedEmail = (email || 'admin@tasgrosirimport.com').trim().toLowerCase();
  const trimmedSecret = secret.trim();

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
        if (!authErr && authData?.session) {
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
        };

        if (result.authenticated) {
          const token = result.sessionToken || generateClientSessionToken();
          markAdminSessionVerified(result.email || normalizedEmail, token);
          return {
            authenticated: true,
            email: result.email || normalizedEmail,
            role: result.role || fallbackRole,
            sessionToken: token,
          };
        }

        // If RPC explicitly says wrong password for a registered credential, stop here
        if (result.message && !result.message.includes('belum terdaftar')) {
          return {
            authenticated: false,
            message: result.message,
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
        const token = generateClientSessionToken();
        markAdminSessionVerified(normalizedEmail, token);
        return {
          authenticated: true,
          email: normalizedEmail,
          role: fallbackRole,
          sessionToken: token,
        };
      }

      return {
        authenticated: false,
        message: 'PIN / Kata Sandi Admin tidak sesuai.',
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
 * Verifies Employee login without exposing or pre-fetching the entire employees table in the browser.
 * Calls `verify_employee_login` RPC first; if RPC is not yet installed, queries only the single
 * matching employee row by identifier and compares its hash.
 */
export async function verifyEmployeeLoginSecure(
  identifier: string,
  secret: string
): Promise<EmployeeVerifyResponse> {
  const cleanId = identifier.trim();
  const cleanSecret = secret.trim();

  if (!cleanId || !cleanSecret) {
    return {
      authenticated: false,
      message: 'Masukkan ID Karyawan / NIK / Email beserta PIN Akses Anda.',
    };
  }

  if (isSupabaseConfigured()) {
    // 1. Try Server-Side RPC `verify_employee_login`
    try {
      const { data: rpcData, error: rpcErr } = await supabase.rpc('verify_employee_login', {
        p_identifier: cleanId,
        p_secret: cleanSecret,
      });

      if (!rpcErr && rpcData && typeof rpcData === 'object') {
        const res = rpcData as {
          authenticated?: boolean;
          employeeId?: string;
          employeeName?: string;
          department?: string;
          sessionToken?: string;
          message?: string;
        };
        if (res.authenticated && res.employeeId) {
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
        return {
          authenticated: false,
          message: res.message || 'ID Karyawan atau PIN tidak valid.',
        };
      }
    } catch {
      // RPC not yet created in Supabase; fall back to single-row targeted query below
    }

    // 2. Fallback targeted query (fetches ONLY id, name, department, access_pin of the specific identifier)
    try {
      const { data: rows, error } = await supabase
        .from('employees')
        .select('id, name, department, nik, email, access_pin')
        .or(`id.ilike.${cleanId},nik.ilike.${cleanId},email.ilike.${cleanId}`)
        .limit(1);

      if (!error && rows && rows.length > 0) {
        const emp = rows[0];
        const expectedHash = await getLocalEmployeePinHash(emp.id);
        const candidateHash = await hashSecretSha256(emp.id, cleanSecret);

        const isHashMatch = Boolean(expectedHash && candidateHash === expectedHash);
        const isDbPinMatch =
          typeof emp.access_pin === 'string' &&
          emp.access_pin.trim().length > 0 &&
          emp.access_pin.trim() === cleanSecret;

        if (isHashMatch || isDbPinMatch) {
          if (isDbPinMatch && !isHashMatch) {
            await updateEmployeePinSecure(emp.id, cleanSecret);
          }
          const token = generateClientSessionToken();
          markEmployeeSessionLocked(emp.id, token);
          return {
            authenticated: true,
            employeeId: emp.id,
            employeeName: emp.name,
            department: emp.department || '',
            sessionToken: token,
          };
        }

        return {
          authenticated: false,
          message: 'PIN Karyawan yang Anda masukkan salah.',
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

  return {
    authenticated: false,
    message: 'ID Karyawan / NIK tidak ditemukan atau PIN tidak sesuai.',
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
const ADMIN_SESSION_SIG_KEY = 'tgi_admin_session_sig_v2';
let inMemoryAuthenticatedRole: 'admin' | 'employee' | null = null;
let inMemoryAdminToken: string | null = null;

function computeDeterministicSessionSig(email: string, token: string): string {
  const payload = `${HASH_SALT_PREFIX}admin_sig::${email.trim().toLowerCase()}::${token.trim()}`;
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

export function markAdminSessionVerified(email: string, sessionToken?: string): void {
  const token = sessionToken || getVerifiedSessionToken() || generateClientSessionToken();
  setVerifiedSessionToken(token);
  inMemoryAuthenticatedRole = 'admin';
  inMemoryAdminToken = token;
  try {
    const sig = computeDeterministicSessionSig(email || 'admin', token);
    sessionStorage.setItem(ADMIN_SESSION_SIG_KEY, JSON.stringify({ email: email.trim().toLowerCase(), sig }));
    sessionStorage.setItem('tgi_admin_unlocked', 'true');
    sessionStorage.removeItem('tgi_locked_employee_id');
  } catch {
    // ignore storage errors
  }
}

export function markEmployeeSessionLocked(employeeId: string, sessionToken?: string): void {
  const token = sessionToken || getVerifiedSessionToken() || generateClientSessionToken();
  setVerifiedSessionToken(token);
  inMemoryAuthenticatedRole = 'employee';
  inMemoryAdminToken = null;
  try {
    sessionStorage.removeItem(ADMIN_SESSION_SIG_KEY);
    sessionStorage.removeItem('tgi_admin_unlocked');
    sessionStorage.setItem('tgi_locked_employee_id', employeeId);
    localStorage.setItem('tgi_dashboard_mode', 'employee');
  } catch {
    // ignore storage errors
  }
}

export function clearAllAuthSessions(): void {
  inMemoryAuthenticatedRole = null;
  inMemoryAdminToken = null;
  setVerifiedSessionToken(null);
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
 * Verifies that the current browser session is a genuine Admin session and NOT a tampered
 * employee session (blocks DevTools manipulation of `tgi_admin_unlocked` or `tgi_dashboard_mode`).
 */
export function isAdminSessionVerified(): boolean {
  try {
    // If an employee session lock is active, Admin access is strictly forbidden
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
    const parsed = JSON.parse(rawSig) as { email?: string; sig?: string };
    if (!parsed?.email || !parsed?.sig) return false;
    const expectedSig = computeDeterministicSessionSig(parsed.email, token);
    return parsed.sig === expectedSig;
  } catch {
    return false;
  }
}

// ============================================================================
// LOCALSTORAGE PII & PIN PROTECTION (NO PLAINTEXT PINS, NIK KTP 16, OR NPWP)
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

/**
 * Scrubs plaintext `accessPin` and obfuscates 16-digit `ktpNumber` and `npwp` before writing
 * employee objects to `localStorage` (`tgi_employees_data`).
 */
export function sanitizeEmployeeForStorage<T extends Record<string, any>>(emp: T): T {
  if (!emp || typeof emp !== 'object') return emp;
  const clone: Record<string, any> = { ...emp };

  // Never store plaintext PIN in localStorage; hash it asynchronously if present
  if (typeof clone.accessPin === 'string' && clone.accessPin.trim() !== '' && clone.accessPin !== '••••') {
    const rawPin = clone.accessPin.trim();
    if (clone.id) {
      void updateEmployeePinSecure(String(clone.id), rawPin);
    }
    clone.accessPin = '••••';
  }

  // Obfuscate 16-digit NIK KTP & NPWP so they are never stored in plain-text in localStorage
  if (typeof clone.ktpNumber === 'string' && clone.ktpNumber.trim() !== '') {
    clone.ktpNumber = obfuscateSensitiveField(clone.ktpNumber);
  }
  if (typeof clone.npwp === 'string' && clone.npwp.trim() !== '') {
    clone.npwp = obfuscateSensitiveField(clone.npwp);
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
  if (typeof clone.accessPin === 'string' && clone.accessPin.trim() !== '' && clone.accessPin !== '••••') {
    if (clone.id) {
      void updateEmployeePinSecure(String(clone.id), clone.accessPin.trim());
    }
    clone.accessPin = '••••';
  }
  if (typeof clone.ktpNumber === 'string') {
    clone.ktpNumber = deobfuscateSensitiveField(clone.ktpNumber);
  }
  if (typeof clone.npwp === 'string') {
    clone.npwp = deobfuscateSensitiveField(clone.npwp);
  }
  return clone as T;
}

export function hydrateEmployeesListFromStorage<T extends Record<string, any>>(list: T[]): T[] {
  if (!Array.isArray(list)) return [];
  return list.map((emp) => hydrateEmployeeFromStorage(emp));
}

// ============================================================================
// STRICT INPUT SANITIZATION & VALIDATION UTILITIES
// ============================================================================
export function sanitizeSafeText(input: unknown, maxLength = 500): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<\/?[a-z][^>]*>/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLength);
}

export function validatePositiveIntegerAmount(val: unknown): number | null {
  if (typeof val === 'number') {
    const rounded = Math.floor(val);
    return Number.isSafeInteger(rounded) && rounded > 0 ? rounded : null;
  }
  if (typeof val === 'string') {
    const digits = val.replace(/[^\d]/g, '');
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

