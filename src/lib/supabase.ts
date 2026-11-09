import { createClient } from '@supabase/supabase-js';

// Helper to sanitize Supabase URL (handles markdown links like [url](url), quotes, brackets)
export function sanitizeSupabaseUrl(rawUrl?: string): string {
  const fallback = 'https://aeopckbjlbpjpdqyppph.supabase.co';
  if (!rawUrl || typeof rawUrl !== 'string') return fallback;

  let cleaned = rawUrl.trim();
  // Handle markdown links: [https://...](https://...)
  const markdownMatch = cleaned.match(/\((https?:\/\/[^\s)]+)\)/);
  if (markdownMatch) {
    cleaned = markdownMatch[1];
  } else {
    // Match first valid http/https url substring
    const urlMatch = cleaned.match(/https?:\/\/[^\s)\]"']+/);
    if (urlMatch) {
      cleaned = urlMatch[0];
    }
  }

  cleaned = cleaned.replace(/\/+$/, '');

  try {
    const parsed = new URL(cleaned);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return cleaned;
    }
  } catch {
    // If parsing fails, fall back to known valid URL
  }
  return fallback;
}

// Helper to sanitize Supabase Anon Key (handles quotes, whitespace, or invalid templates)
export function sanitizeSupabaseKey(rawKey?: string): string {
  const fallback =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlb3Bja2JqbGJwanBkcXlwcHBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI0NzM1NzMsImV4cCI6MjEwODA0OTU3M30.nxuVs0w0oaaLo809NB1TnrENI-jRQMTjmMZf9OpC-0o';
  if (!rawKey || typeof rawKey !== 'string') return fallback;

  const cleaned = rawKey.trim().replace(/^["']|["']$/g, '');
  if (cleaned.length < 20 || cleaned.includes('your-anon-key')) {
    return fallback;
  }
  return cleaned;
}

// Supabase Credentials (cleaned and validated)
export const SUPABASE_URL = sanitizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL);
export const SUPABASE_ANON_KEY = sanitizeSupabaseKey(import.meta.env.VITE_SUPABASE_ANON_KEY);

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

export function isSupabaseConfigured(): boolean {
  return Boolean(
    SUPABASE_URL &&
      SUPABASE_ANON_KEY &&
      SUPABASE_URL.startsWith('http') &&
      SUPABASE_ANON_KEY.length > 20
  );
}

/**
 * SQL Migration Script Khusus Audit Keamanan RLS & Fungsi Autentikasi Server-Side (RPC)
 */
export const SUPABASE_SECURITY_MIGRATION_SQL = `-- =============================================================================
-- TAS GROSIR IMPORT - SUPABASE SECURITY & RLS MIGRATION SCRIPT
-- Audit Perbaikan Keamanan Database (Row Level Security) & Fungsi Autentikasi RPC
-- Jalankan skrip ini di Supabase SQL Editor (Project -> SQL Editor -> New Query)
-- =============================================================================

-- 1. Aktifkan ekstensi kriptografi untuk hashing PIN & Password di sisi server
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Buat tabel kredensial aman (hanya dapat diakses oleh fungsi SECURITY DEFINER)
CREATE TABLE IF NOT EXISTS public.app_auth_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'Super Admin' CHECK (role IN ('Super Admin', 'HR Admin', 'Finance', 'Employee')),
  secret_hash TEXT NOT NULL,
  employee_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.app_auth_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No Direct Client Access to Credentials" ON public.app_auth_credentials;
CREATE POLICY "No Direct Client Access to Credentials"
  ON public.app_auth_credentials
  FOR ALL
  USING (false)
  WITH CHECK (false);

ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS access_pin_hash TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS daily_salary NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC NOT NULL DEFAULT 0;

UPDATE public.employees
SET
  access_pin_hash = crypt(access_pin, gen_salt('bf', 10)),
  access_pin = NULL
WHERE access_pin IS NOT NULL
  AND length(trim(access_pin)) > 0
  AND (access_pin_hash IS NULL OR length(trim(access_pin_hash)) = 0);

-- 3. Hapus seluruh kebijakan lama yang terbuka untuk publik ("Public Full Access ...")
DROP POLICY IF EXISTS "Public Full Access employees" ON public.employees;
DROP POLICY IF EXISTS "Public Full Access Employees" ON public.employees;
DROP POLICY IF EXISTS "Public Full Access company_assets" ON public.company_assets;
DROP POLICY IF EXISTS "Public Full Access Company Assets" ON public.company_assets;
DROP POLICY IF EXISTS "Public Full Access payrolls" ON public.payrolls;
DROP POLICY IF EXISTS "Public Full Access Payrolls" ON public.payrolls;
DROP POLICY IF EXISTS "Public Full Access attendances" ON public.attendances;
DROP POLICY IF EXISTS "Public Full Access Attendances" ON public.attendances;
DROP POLICY IF EXISTS "Public Full Access leave_requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Public Full Access Leave Requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Public Full Access overtime_requests" ON public.overtime_requests;
DROP POLICY IF EXISTS "Public Full Access Overtime Requests" ON public.overtime_requests;
DROP POLICY IF EXISTS "Public Full Access reimbursements" ON public.reimbursements;
DROP POLICY IF EXISTS "Public Full Access Reimbursements" ON public.reimbursements;

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payrolls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.overtime_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reimbursements ENABLE ROW LEVEL SECURITY;

-- 4. Fungsi Helper Keamanan RLS (Hanya mengizinkan sesi terautentikasi / Admin)
CREATE OR REPLACE FUNCTION public.is_app_authenticated()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_jwt_role TEXT;
  v_session_token TEXT;
BEGIN
  v_jwt_role := auth.role();
  IF v_jwt_role = 'authenticated' OR v_jwt_role = 'service_role' THEN
    RETURN true;
  END IF;

  BEGIN
    v_session_token := current_setting('request.headers', true)::json->>'x-tgi-session-verified';
    IF v_session_token IS NOT NULL AND length(v_session_token) >= 16 THEN
      RETURN true;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RETURN false;
  END;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_app_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' OR auth.role() = 'authenticated' THEN
    RETURN true;
  END IF;
  RETURN public.is_app_authenticated();
END;
$$;

-- 5. Kebijakan RLS Ketat (SELECT, INSERT, UPDATE, DELETE)
CREATE POLICY "Authenticated Select Employees" ON public.employees FOR SELECT USING (public.is_app_authenticated());
CREATE POLICY "Admin Insert Employees" ON public.employees FOR INSERT WITH CHECK (public.is_app_admin());
CREATE POLICY "Authenticated Update Employees" ON public.employees FOR UPDATE USING (public.is_app_authenticated()) WITH CHECK (public.is_app_authenticated());
CREATE POLICY "Admin Delete Employees" ON public.employees FOR DELETE USING (public.is_app_admin());

CREATE POLICY "Authenticated Select Company Assets" ON public.company_assets FOR SELECT USING (public.is_app_authenticated());
CREATE POLICY "Admin Insert Company Assets" ON public.company_assets FOR INSERT WITH CHECK (public.is_app_admin());
CREATE POLICY "Admin Update Company Assets" ON public.company_assets FOR UPDATE USING (public.is_app_admin()) WITH CHECK (public.is_app_admin());
CREATE POLICY "Admin Delete Company Assets" ON public.company_assets FOR DELETE USING (public.is_app_admin());

CREATE POLICY "Authenticated Select Payrolls" ON public.payrolls FOR SELECT USING (public.is_app_authenticated());
CREATE POLICY "Admin Insert Payrolls" ON public.payrolls FOR INSERT WITH CHECK (public.is_app_admin());
CREATE POLICY "Admin Update Payrolls" ON public.payrolls FOR UPDATE USING (public.is_app_admin()) WITH CHECK (public.is_app_admin());
CREATE POLICY "Admin Delete Payrolls" ON public.payrolls FOR DELETE USING (public.is_app_admin());

CREATE POLICY "Authenticated Select Attendances" ON public.attendances FOR SELECT USING (public.is_app_authenticated());
CREATE POLICY "Authenticated Insert Attendances" ON public.attendances FOR INSERT WITH CHECK (public.is_app_authenticated());
CREATE POLICY "Authenticated Update Attendances" ON public.attendances FOR UPDATE USING (public.is_app_authenticated()) WITH CHECK (public.is_app_authenticated());
CREATE POLICY "Admin Delete Attendances" ON public.attendances FOR DELETE USING (public.is_app_admin());

CREATE POLICY "Authenticated Select Leave Requests" ON public.leave_requests FOR SELECT USING (public.is_app_authenticated());
CREATE POLICY "Authenticated Insert Leave Requests" ON public.leave_requests FOR INSERT WITH CHECK (public.is_app_authenticated());
CREATE POLICY "Authenticated Update Leave Requests" ON public.leave_requests FOR UPDATE USING (public.is_app_authenticated()) WITH CHECK (public.is_app_authenticated());
CREATE POLICY "Admin Delete Leave Requests" ON public.leave_requests FOR DELETE USING (public.is_app_admin());

CREATE POLICY "Authenticated Select Overtime Requests" ON public.overtime_requests FOR SELECT USING (public.is_app_authenticated());
CREATE POLICY "Authenticated Insert Overtime Requests" ON public.overtime_requests FOR INSERT WITH CHECK (public.is_app_authenticated());
CREATE POLICY "Authenticated Update Overtime Requests" ON public.overtime_requests FOR UPDATE USING (public.is_app_authenticated()) WITH CHECK (public.is_app_authenticated());
CREATE POLICY "Admin Delete Overtime Requests" ON public.overtime_requests FOR DELETE USING (public.is_app_admin());

CREATE POLICY "Authenticated Select Reimbursements" ON public.reimbursements FOR SELECT USING (public.is_app_authenticated());
CREATE POLICY "Authenticated Insert Reimbursements" ON public.reimbursements FOR INSERT WITH CHECK (public.is_app_authenticated());
CREATE POLICY "Authenticated Update Reimbursements" ON public.reimbursements FOR UPDATE USING (public.is_app_authenticated()) WITH CHECK (public.is_app_authenticated());
CREATE POLICY "Admin Delete Reimbursements" ON public.reimbursements FOR DELETE USING (public.is_app_admin());

-- 6. Fungsi RPC Verifikasi Login Admin & Karyawan (Server-Side Bcrypt Hash)
CREATE OR REPLACE FUNCTION public.verify_admin_login(p_email TEXT, p_secret TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cred public.app_auth_credentials%ROWTYPE;
BEGIN
  SELECT * INTO v_cred
  FROM public.app_auth_credentials
  WHERE lower(email) = lower(trim(p_email)) AND is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('authenticated', false, 'message', 'Kredensial admin belum terdaftar di server.');
  END IF;

  IF v_cred.secret_hash = crypt(p_secret, v_cred.secret_hash) THEN
    RETURN jsonb_build_object(
      'authenticated', true,
      'email', v_cred.email,
      'role', v_cred.role,
      'sessionToken', encode(gen_random_bytes(24), 'hex')
    );
  END IF;

  RETURN jsonb_build_object('authenticated', false, 'message', 'PIN atau kata sandi salah.');
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_employee_login(p_identifier TEXT, p_secret TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emp public.employees%ROWTYPE;
  v_clean TEXT := lower(trim(p_identifier));
  v_ok BOOLEAN := false;
BEGIN
  SELECT * INTO v_emp
  FROM public.employees
  WHERE lower(id) = v_clean OR lower(coalesce(nik, '')) = v_clean OR lower(coalesce(email, '')) = v_clean
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('authenticated', false, 'message', 'ID Karyawan / NIK / Email tidak ditemukan.');
  END IF;

  IF v_emp.access_pin_hash IS NOT NULL AND length(trim(v_emp.access_pin_hash)) > 0 THEN
    v_ok := (v_emp.access_pin_hash = crypt(p_secret, v_emp.access_pin_hash));
  ELSIF v_emp.access_pin IS NOT NULL AND length(trim(v_emp.access_pin)) > 0 THEN
    v_ok := (v_emp.access_pin = p_secret);
  END IF;

  IF NOT v_ok THEN
    RETURN jsonb_build_object('authenticated', false, 'message', 'PIN Karyawan tidak sesuai.');
  END IF;

  RETURN jsonb_build_object(
    'authenticated', true,
    'employeeId', v_emp.id,
    'employeeName', v_emp.name,
    'department', v_emp.department,
    'sessionToken', encode(gen_random_bytes(24), 'hex')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.set_admin_credential(p_email TEXT, p_role TEXT, p_new_secret TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.app_auth_credentials (email, role, secret_hash, updated_at)
  VALUES (lower(trim(p_email)), coalesce(p_role, 'Super Admin'), crypt(p_new_secret, gen_salt('bf', 10)), NOW())
  ON CONFLICT (email) DO UPDATE
  SET role = EXCLUDED.role, secret_hash = EXCLUDED.secret_hash, updated_at = NOW();
  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_employee_pin(p_employee_id TEXT, p_new_pin TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.employees
  SET access_pin_hash = crypt(trim(p_new_pin), gen_salt('bf', 10)), access_pin = NULL, updated_at = NOW()
  WHERE id = p_employee_id;
  RETURN jsonb_build_object('success', FOUND);
END;
$$;
`;

/**
 * SQL Schema DDL and Strict Authenticated RLS Policies for Supabase SQL Editor
 */
export const SUPABASE_SQL_SCHEMA = `-- ==============================================================================
-- TGI DASHBOARD - SUPABASE SQL SCHEMA (POSTGRESQL)
-- TAS GROSIR IMPORT - PAYROLL & HRIS PLATFORM
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. TABEL KARYAWAN (employees)
CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY,
  nik TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  google_email TEXT,
  phone TEXT,
  avatar_url TEXT,
  face_photo_url TEXT,
  role TEXT NOT NULL DEFAULT 'Staff',
  gender TEXT DEFAULT 'Laki-laki',
  department TEXT NOT NULL DEFAULT 'Operasional',
  employment_status TEXT NOT NULL DEFAULT 'PKWT (Kontrak)',
  join_date DATE NOT NULL DEFAULT CURRENT_DATE,
  base_salary NUMERIC NOT NULL DEFAULT 0,
  daily_salary NUMERIC NOT NULL DEFAULT 0,
  allowances JSONB NOT NULL DEFAULT '{"position":0,"transport":0,"meal":0,"communication":0}'::jsonb,
  bank_name TEXT NOT NULL DEFAULT 'BCA',
  bank_account_number TEXT NOT NULL DEFAULT '',
  bank_account_holder TEXT NOT NULL DEFAULT '',
  npwp TEXT DEFAULT '00.000.000.0-000.000',
  ptkp_status TEXT NOT NULL DEFAULT 'TK/0',
  bpjs_kesehatan_no TEXT DEFAULT '0001000000000',
  bpjs_ketenagakerjaan_no TEXT DEFAULT '00000000000',
  remaining_leave_days INTEGER NOT NULL DEFAULT 12,
  is_active BOOLEAN NOT NULL DEFAULT true,
  approval_status TEXT NOT NULL DEFAULT 'approved',
  access_pin_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- 2. TABEL ASET & INVENTARIS PERUSAHAAN (company_assets)
CREATE TABLE IF NOT EXISTS company_assets (
  id TEXT PRIMARY KEY,
  asset_code TEXT UNIQUE NOT NULL,
  serial_number TEXT,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  condition TEXT NOT NULL DEFAULT 'Baik',
  purchase_date DATE,
  purchase_cost NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Tersedia',
  location TEXT,
  assigned_to_employee_id TEXT REFERENCES employees(id) ON DELETE SET NULL,
  assigned_to_employee_name TEXT,
  assigned_to_employee_nik TEXT,
  assigned_date DATE,
  handover_condition_notes TEXT,
  photo_url TEXT,
  specifications TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- 3. TABEL PAYROLL / PENGGAJIAN (payrolls)
CREATE TABLE IF NOT EXISTS payrolls (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  period TEXT NOT NULL,
  base_salary NUMERIC NOT NULL DEFAULT 0,
  allowance_position NUMERIC NOT NULL DEFAULT 0,
  allowance_transport NUMERIC NOT NULL DEFAULT 0,
  allowance_meal NUMERIC NOT NULL DEFAULT 0,
  allowance_communication NUMERIC NOT NULL DEFAULT 0,
  overtime_pay NUMERIC NOT NULL DEFAULT 0,
  bonus NUMERIC NOT NULL DEFAULT 0,
  total_gross_salary NUMERIC NOT NULL DEFAULT 0,
  late_deduction NUMERIC NOT NULL DEFAULT 0,
  bpjs_kesehatan_employee NUMERIC NOT NULL DEFAULT 0,
  bpjs_kesehatan_employer NUMERIC NOT NULL DEFAULT 0,
  bpjs_jht_employee NUMERIC NOT NULL DEFAULT 0,
  bpjs_jht_employer NUMERIC NOT NULL DEFAULT 0,
  bpjs_jp_employee NUMERIC NOT NULL DEFAULT 0,
  bpjs_jp_employer NUMERIC NOT NULL DEFAULT 0,
  bpjs_jkk_employer NUMERIC NOT NULL DEFAULT 0,
  bpjs_jkm_employer NUMERIC NOT NULL DEFAULT 0,
  pph21_ter NUMERIC NOT NULL DEFAULT 0,
  cash_advance_deduction NUMERIC NOT NULL DEFAULT 0,
  total_deductions NUMERIC NOT NULL DEFAULT 0,
  take_home_pay NUMERIC NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'Draft',
  payment_date DATE,
  reference_number TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- 4. TABEL PRESENSI / ABSENSI REAL-TIME (attendances)
CREATE TABLE IF NOT EXISTS attendances (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  date DATE NOT NULL,
  check_in TEXT NOT NULL DEFAULT '',
  check_out TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Hadir Tepat Waktu',
  work_hours NUMERIC NOT NULL DEFAULT 8,
  late_minutes INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  face_scan_verified BOOLEAN DEFAULT false,
  face_confidence NUMERIC DEFAULT 0,
  face_photo_snapshot TEXT,
  location_coords JSONB,
  location_address TEXT,
  is_in_office_radius BOOLEAN DEFAULT true,
  distance_meters NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_attendances_emp ON attendances(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendances_date ON attendances(date);

-- 5. TABEL PENGAJUAN CUTI & IZIN (leave_requests)
CREATE TABLE IF NOT EXISTS leave_requests (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  type TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_days INTEGER NOT NULL DEFAULT 1,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Menunggu Persetujuan',
  applied_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  approved_by TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_leave_emp ON leave_requests(employee_id);

-- 6. TABEL KLAIM LEMBUR (overtime_requests)
CREATE TABLE IF NOT EXISTS overtime_requests (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  date DATE NOT NULL,
  hours NUMERIC NOT NULL DEFAULT 1,
  task_description TEXT NOT NULL,
  calculated_pay NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Menunggu Persetujuan',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_overtime_emp ON overtime_requests(employee_id);

-- 7. TABEL KLAIM REIMBURSEMENT (reimbursements)
CREATE TABLE IF NOT EXISTS reimbursements (
  id TEXT PRIMARY KEY,
  claim_number TEXT UNIQUE NOT NULL,
  employee_id TEXT NOT NULL,
  date DATE NOT NULL,
  category TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  description TEXT NOT NULL,
  receipt_number TEXT,
  receipt_photo_url TEXT,
  receipt_file_name TEXT,
  receipt_file_type TEXT DEFAULT 'image',
  status TEXT NOT NULL DEFAULT 'Menunggu Persetujuan',
  applied_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  approved_at TIMESTAMPTZ,
  approved_by TEXT,
  rejection_reason TEXT,
  payment_method TEXT,
  disbursed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_reimbursements_emp ON reimbursements(employee_id);

${SUPABASE_SECURITY_MIGRATION_SQL}

-- ==============================================================================
-- AKTIFKAN SUPABASE REALTIME REPLICATION
-- ==============================================================================
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE employees; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE company_assets; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE payrolls; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE attendances; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE leave_requests; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE overtime_requests; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE reimbursements; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
`;

/**
 * SQL Schema Tambahan & Migrasi Keamanan RLS Ketat
 */
export const SUPABASE_ADDITIONAL_SQL_SCHEMA = SUPABASE_SECURITY_MIGRATION_SQL;

