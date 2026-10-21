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

/**
 * SQL Schema DDL and Development RLS Policies for Supabase SQL Editor
 */
export const SUPABASE_SQL_SCHEMA = `-- ==============================================================================
-- TGI DASHBOARD - SUPABASE SQL SCHEMA (POSTGRESQL)
-- PT TAS GROSIR IMPORT - PAYROLL & HRIS PLATFORM
-- ==============================================================================

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

-- ==============================================================================
-- KEBIJAKAN ROW LEVEL SECURITY (RLS) - PUBLIC ACCESS TAHAP DEVELOPMENT
-- ==============================================================================

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE payrolls ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendances ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE overtime_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE reimbursements ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'employees' AND policyname = 'Public Full Access employees') THEN
    CREATE POLICY "Public Full Access employees" ON employees FOR ALL USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'company_assets' AND policyname = 'Public Full Access company_assets') THEN
    CREATE POLICY "Public Full Access company_assets" ON company_assets FOR ALL USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payrolls' AND policyname = 'Public Full Access payrolls') THEN
    CREATE POLICY "Public Full Access payrolls" ON payrolls FOR ALL USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'attendances' AND policyname = 'Public Full Access attendances') THEN
    CREATE POLICY "Public Full Access attendances" ON attendances FOR ALL USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'leave_requests' AND policyname = 'Public Full Access leave_requests') THEN
    CREATE POLICY "Public Full Access leave_requests" ON leave_requests FOR ALL USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'overtime_requests' AND policyname = 'Public Full Access overtime_requests') THEN
    CREATE POLICY "Public Full Access overtime_requests" ON overtime_requests FOR ALL USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'reimbursements' AND policyname = 'Public Full Access reimbursements') THEN
    CREATE POLICY "Public Full Access reimbursements" ON reimbursements FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

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
 * SQL Schema Tambahan (Khusus untuk tabel baru: Presensi, Cuti, Lembur, dan Reimbursement)
 * Bisa langsung dijalankan di SQL Editor Supabase jika tabel karyawan & aset sudah ada sebelumnya.
 */
export const SUPABASE_ADDITIONAL_SQL_SCHEMA = `-- ==============================================================================
-- TGI DASHBOARD - SKRIP SQL TABEL TAMBAHAN (PRESENSI, CUTI, LEMBUR, REIMBURSEMENT)
-- Jalankan skrip ini di SQL Editor dashboard Supabase Anda:
-- ==============================================================================

-- 1. TABEL PRESENSI / ABSENSI REAL-TIME (attendances)
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

-- 2. TABEL PENGAJUAN CUTI & IZIN (leave_requests)
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

-- 3. TABEL KLAIM LEMBUR (overtime_requests)
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

-- 4. TABEL KLAIM REIMBURSEMENT (reimbursements)
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

-- ==============================================================================
-- AKTIFKAN RLS & KEBIJAKAN PUBLIC ACCESS
-- ==============================================================================
ALTER TABLE attendances ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE overtime_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE reimbursements ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'attendances' AND policyname = 'Public Full Access attendances') THEN
    CREATE POLICY "Public Full Access attendances" ON attendances FOR ALL USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'leave_requests' AND policyname = 'Public Full Access leave_requests') THEN
    CREATE POLICY "Public Full Access leave_requests" ON leave_requests FOR ALL USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'overtime_requests' AND policyname = 'Public Full Access overtime_requests') THEN
    CREATE POLICY "Public Full Access overtime_requests" ON overtime_requests FOR ALL USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'reimbursements' AND policyname = 'Public Full Access reimbursements') THEN
    CREATE POLICY "Public Full Access reimbursements" ON reimbursements FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ==============================================================================
-- AKTIFKAN SUPABASE REALTIME REPLICATION (4 TABEL)
-- ==============================================================================
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE attendances; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE leave_requests; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE overtime_requests; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE reimbursements; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
`;
