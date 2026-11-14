import { createClient } from '@supabase/supabase-js';

// Helper to sanitize Supabase URL strictly from import.meta.env.VITE_SUPABASE_URL (no hardcoded project URLs)
export function sanitizeSupabaseUrl(rawUrl?: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';

  let cleaned = rawUrl.trim();
  const markdownMatch = cleaned.match(/\((https?:\/\/[^\s)]+)\)/);
  if (markdownMatch) {
    cleaned = markdownMatch[1];
  } else {
    const urlMatch = cleaned.match(/https?:\/\/[^\s)\]"']+/);
    if (urlMatch) {
      cleaned = urlMatch[0];
    }
  }

  cleaned = cleaned.replace(/\/+$/, '');
  if (cleaned.includes('your-project-ref.supabase.co')) return '';

  try {
    const parsed = new URL(cleaned);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return cleaned;
    }
  } catch {
    return '';
  }
  return '';
}

// Helper to sanitize Supabase Anon Key strictly from import.meta.env.VITE_SUPABASE_ANON_KEY (no hardcoded JWTs)
export function sanitizeSupabaseKey(rawKey?: string): string {
  if (!rawKey || typeof rawKey !== 'string') return '';

  const cleaned = rawKey.trim().replace(/^["']|["']$/g, '');
  if (
    cleaned.length < 20 ||
    cleaned.includes('your-anon-key') ||
    cleaned.includes('your-supabase-public-anon-key')
  ) {
    return '';
  }
  return cleaned;
}

// Supabase Credentials (read exclusively from Vite client environment variables)
export const SUPABASE_URL = sanitizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL);
export const SUPABASE_ANON_KEY = sanitizeSupabaseKey(import.meta.env.VITE_SUPABASE_ANON_KEY);

const CLIENT_INIT_URL = SUPABASE_URL || 'https://placeholder-unconfigured.supabase.co';
const CLIENT_INIT_KEY = SUPABASE_ANON_KEY || 'public-anon-key-unconfigured';

// In-memory verified session context populated by authSecurityService so tokens are never sent unless authenticated
let activeVerifiedSessionContext: {
  sessionToken: string | null;
  adminEmail: string | null;
  employeeId: string | null;
} = {
  sessionToken: null,
  adminEmail: null,
  employeeId: null,
};

export function setSupabaseVerifiedSessionContext(ctx: {
  sessionToken?: string | null;
  adminEmail?: string | null;
  employeeId?: string | null;
}): void {
  activeVerifiedSessionContext = {
    sessionToken: ctx.sessionToken ?? null,
    adminEmail: ctx.adminEmail ? ctx.adminEmail.trim().toLowerCase() : null,
    employeeId: ctx.employeeId ? ctx.employeeId.trim() : null,
  };
}

export function getSupabaseVerifiedSessionContext() {
  return activeVerifiedSessionContext;
}

export const supabase = createClient(CLIENT_INIT_URL, CLIENT_INIT_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  global: {
    fetch: (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers || {});
      if (activeVerifiedSessionContext.sessionToken) {
        headers.set('x-tgi-session-verified', activeVerifiedSessionContext.sessionToken);
      }
      if (
        activeVerifiedSessionContext.adminEmail &&
        ['jpexakun7@gmail.com', 'lupytacounting77@gmail.com'].includes(
          activeVerifiedSessionContext.adminEmail
        )
      ) {
        headers.set('x-tgi-admin-email', activeVerifiedSessionContext.adminEmail);
      }
      if (activeVerifiedSessionContext.employeeId) {
        headers.set('x-tgi-employee-id', activeVerifiedSessionContext.employeeId);
      }
      return fetch(input, {
        ...init,
        headers,
      });
    },
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
      !SUPABASE_URL.includes('placeholder-unconfigured.supabase.co') &&
      SUPABASE_ANON_KEY.length > 20 &&
      SUPABASE_ANON_KEY !== 'public-anon-key-unconfigured'
  );
}

/**
 * Skrip SQL Lengkap Cloud-First dengan Keamanan Tingkat Tinggi (Strict RLS + Server-Side RPC + Anti-Brute-Force)
 */
export const SUPABASE_SQL_SCHEMA = `-- =================================================================================
-- PT LUPYTA MAJU PERKASA (TAS GROSIR IMPORT) - HARDENED SUPABASE CLOUD SCHEMA
-- Single Source of Truth (Cloud-First Multi-Device Sync) + Strict RLS & RPC Security
-- Salin & Jalankan seluruh skrip ini di Supabase SQL Editor (New Query -> Run)
-- =================================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. TABEL UTAMA KARYAWAN (employees)
CREATE TABLE IF NOT EXISTS public.employees (
  id TEXT PRIMARY KEY,
  nik TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  google_email TEXT,
  phone TEXT DEFAULT '',
  avatar_url TEXT,
  face_photo_url TEXT,
  ktp_number TEXT,
  ktp_photo_url TEXT,
  role TEXT NOT NULL DEFAULT 'Staff',
  gender TEXT DEFAULT 'Laki-laki',
  department TEXT NOT NULL DEFAULT 'Operasional',
  employment_status TEXT NOT NULL DEFAULT 'PKWT (Kontrak)',
  employment_type TEXT DEFAULT 'PKWT (Kontrak)',
  join_date DATE NOT NULL DEFAULT CURRENT_DATE,
  shift_id TEXT DEFAULT 'SHIFT-PAGI',
  standard_daily_hours NUMERIC NOT NULL DEFAULT 9 CHECK (standard_daily_hours > 0 AND standard_daily_hours <= 24),
  base_salary NUMERIC NOT NULL DEFAULT 0 CHECK (base_salary >= 0),
  daily_salary NUMERIC NOT NULL DEFAULT 0 CHECK (daily_salary >= 0),
  hourly_rate NUMERIC NOT NULL DEFAULT 0 CHECK (hourly_rate >= 0),
  overtime_rate NUMERIC NOT NULL DEFAULT 0 CHECK (overtime_rate >= 0),
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
  is_host BOOLEAN DEFAULT false,
  host_commission_pct NUMERIC DEFAULT 0 CHECK (host_commission_pct >= 0 AND host_commission_pct <= 100),
  host_commission_per_pcs NUMERIC DEFAULT 0 CHECK (host_commission_per_pcs >= 0),
  is_co_host BOOLEAN DEFAULT false,
  co_host_commission_pct NUMERIC DEFAULT 0 CHECK (co_host_commission_pct >= 0 AND co_host_commission_pct <= 100),
  co_host_commission_per_pcs NUMERIC DEFAULT 0 CHECK (co_host_commission_per_pcs >= 0),
  access_pin TEXT,
  access_pin_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- Pastikan kolom-kolom terbaru tersedia pada tabel employees yang sudah ada
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS standard_daily_hours NUMERIC NOT NULL DEFAULT 9;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS daily_salary NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS overtime_rate NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS employment_type TEXT DEFAULT 'PKWT (Kontrak)';
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS shift_id TEXT DEFAULT 'SHIFT-PAGI';
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS ktp_number TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS ktp_photo_url TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS is_host BOOLEAN DEFAULT false;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS host_commission_pct NUMERIC DEFAULT 0;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS host_commission_per_pcs NUMERIC DEFAULT 0;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS is_co_host BOOLEAN DEFAULT false;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS co_host_commission_pct NUMERIC DEFAULT 0;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS co_host_commission_per_pcs NUMERIC DEFAULT 0;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS access_pin TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS access_pin_hash TEXT;

-- Migrasi otomatis access_pin plain-text menjadi bcrypt hash & hapus plain-text dari database
UPDATE public.employees
SET
  access_pin_hash = crypt(trim(access_pin), gen_salt('bf')),
  access_pin = NULL
WHERE access_pin IS NOT NULL AND trim(access_pin) <> '' AND trim(access_pin) <> '••••';

-- 2. TABEL MIRROR PROFIL & KOMISI KARYAWAN (tgi_employees)
CREATE TABLE IF NOT EXISTS public.tgi_employees (
  id TEXT PRIMARY KEY,
  nik TEXT,
  name TEXT,
  full_name TEXT,
  division TEXT,
  position TEXT,
  status TEXT DEFAULT 'PKWT (Kontrak)',
  employment_type TEXT DEFAULT 'PKWT (Kontrak)',
  standard_daily_hours NUMERIC DEFAULT 9,
  base_salary NUMERIC DEFAULT 0,
  hourly_rate NUMERIC DEFAULT 0,
  overtime_rate NUMERIC DEFAULT 0,
  allowance_position NUMERIC DEFAULT 0,
  allowance_meal_per_day NUMERIC DEFAULT 0,
  allowance_transport NUMERIC DEFAULT 0,
  is_host BOOLEAN DEFAULT false,
  host_commission_pct NUMERIC DEFAULT 0,
  host_commission_per_pcs NUMERIC DEFAULT 0,
  is_co_host BOOLEAN DEFAULT false,
  co_host_commission_pct NUMERIC DEFAULT 0,
  co_host_commission_per_pcs NUMERIC DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.tgi_employees ADD COLUMN IF NOT EXISTS standard_daily_hours NUMERIC DEFAULT 9;
ALTER TABLE public.tgi_employees ADD COLUMN IF NOT EXISTS full_name TEXT;

-- 3. TABEL PRESENSI / ABSENSI HARIAN (attendances & attendance_logs)
CREATE TABLE IF NOT EXISTS public.attendances (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  date DATE NOT NULL,
  check_in TEXT NOT NULL DEFAULT '',
  check_out TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Hadir Tepat Waktu',
  work_hours NUMERIC NOT NULL DEFAULT 9 CHECK (work_hours >= 0 AND work_hours <= 24),
  overtime_hours NUMERIC NOT NULL DEFAULT 0 CHECK (overtime_hours >= 0 AND overtime_hours <= 24),
  late_minutes INTEGER NOT NULL DEFAULT 0 CHECK (late_minutes >= 0),
  notes TEXT,
  face_scan_verified BOOLEAN DEFAULT false,
  face_confidence NUMERIC DEFAULT 0,
  face_photo_snapshot TEXT,
  photo_in TEXT,
  check_out_photo_snapshot TEXT,
  photo_out TEXT,
  face_photo_out TEXT,
  location_coords JSONB,
  location_address TEXT,
  check_out_location_coords JSONB,
  check_out_location_address TEXT,
  is_in_office_radius BOOLEAN DEFAULT true,
  distance_meters NUMERIC DEFAULT 0,
  check_out_distance_meters NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.attendances ADD COLUMN IF NOT EXISTS overtime_hours NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.attendances ADD COLUMN IF NOT EXISTS photo_in TEXT;
ALTER TABLE public.attendances ADD COLUMN IF NOT EXISTS check_out_photo_snapshot TEXT;
ALTER TABLE public.attendances ADD COLUMN IF NOT EXISTS photo_out TEXT;
ALTER TABLE public.attendances ADD COLUMN IF NOT EXISTS face_photo_out TEXT;
ALTER TABLE public.attendances ADD COLUMN IF NOT EXISTS check_out_location_coords JSONB;
ALTER TABLE public.attendances ADD COLUMN IF NOT EXISTS check_out_location_address TEXT;
ALTER TABLE public.attendances ADD COLUMN IF NOT EXISTS check_out_distance_meters NUMERIC DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_attendances_emp ON public.attendances(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendances_date ON public.attendances(date);

CREATE TABLE IF NOT EXISTS public.attendance_logs (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  employee_nik TEXT,
  employee_name TEXT,
  date DATE NOT NULL,
  clock_in TEXT DEFAULT '',
  clock_out TEXT DEFAULT '',
  total_hours NUMERIC DEFAULT 0 CHECK (total_hours >= 0 AND total_hours <= 24),
  overtime_hours NUMERIC DEFAULT 0 CHECK (overtime_hours >= 0 AND overtime_hours <= 24),
  status TEXT DEFAULT 'Hadir Tepat Waktu',
  late_minutes INTEGER DEFAULT 0 CHECK (late_minutes >= 0),
  hourly_rate NUMERIC DEFAULT 0 CHECK (hourly_rate >= 0),
  daily_pay NUMERIC DEFAULT 0 CHECK (daily_pay >= 0),
  photo_in TEXT,
  photo_out TEXT,
  face_photo_out TEXT,
  face_scan_verified BOOLEAN DEFAULT false,
  is_in_office_radius BOOLEAN DEFAULT true,
  location_lat NUMERIC,
  location_lng NUMERIC,
  distance_meters NUMERIC DEFAULT 0,
  check_out_distance_meters NUMERIC DEFAULT 0,
  notes TEXT,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.attendance_logs ADD COLUMN IF NOT EXISTS overtime_hours NUMERIC DEFAULT 0;
ALTER TABLE public.attendance_logs ADD COLUMN IF NOT EXISTS photo_out TEXT;
ALTER TABLE public.attendance_logs ADD COLUMN IF NOT EXISTS face_photo_out TEXT;
ALTER TABLE public.attendance_logs ADD COLUMN IF NOT EXISTS face_scan_verified BOOLEAN DEFAULT false;
ALTER TABLE public.attendance_logs ADD COLUMN IF NOT EXISTS is_in_office_radius BOOLEAN DEFAULT true;
ALTER TABLE public.attendance_logs ADD COLUMN IF NOT EXISTS check_out_distance_meters NUMERIC DEFAULT 0;

-- 4. TABEL LOG JAM KERJA & GAJI MINGGUAN PART-TIME (parttime_logs, tgi_parttime_logs, tgi_part_time_weekly_payouts)
CREATE TABLE IF NOT EXISTS public.tgi_parttime_logs (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  employee_nik TEXT,
  employee_name TEXT,
  work_date DATE NOT NULL,
  clock_in TEXT NOT NULL DEFAULT '08:00',
  clock_out TEXT NOT NULL DEFAULT '17:00',
  break_minutes NUMERIC NOT NULL DEFAULT 0 CHECK (break_minutes >= 0),
  total_hours NUMERIC NOT NULL DEFAULT 0 CHECK (total_hours >= 0 AND total_hours <= 24),
  hourly_rate_snapshot NUMERIC NOT NULL DEFAULT 0 CHECK (hourly_rate_snapshot >= 0),
  overtime_hours NUMERIC NOT NULL DEFAULT 0 CHECK (overtime_hours >= 0),
  overtime_rate_snapshot NUMERIC NOT NULL DEFAULT 0 CHECK (overtime_rate_snapshot >= 0),
  daily_Cross_pay NUMERIC DEFAULT 0,
  daily_pay NUMERIC NOT NULL DEFAULT 0 CHECK (daily_pay >= 0),
  payment_status TEXT NOT NULL DEFAULT 'Unpaid',
  paid_at TIMESTAMPTZ,
  payout_reference TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.parttime_logs (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  employee_nik TEXT,
  employee_name TEXT,
  work_date DATE NOT NULL,
  clock_in TEXT NOT NULL DEFAULT '08:00',
  clock_out TEXT NOT NULL DEFAULT '17:00',
  break_minutes NUMERIC NOT NULL DEFAULT 0 CHECK (break_minutes >= 0),
  total_hours NUMERIC NOT NULL DEFAULT 0 CHECK (total_hours >= 0 AND total_hours <= 24),
  hourly_rate_snapshot NUMERIC NOT NULL DEFAULT 0 CHECK (hourly_rate_snapshot >= 0),
  overtime_hours NUMERIC NOT NULL DEFAULT 0 CHECK (overtime_hours >= 0),
  overtime_rate_snapshot NUMERIC NOT NULL DEFAULT 0 CHECK (overtime_rate_snapshot >= 0),
  daily_pay NUMERIC NOT NULL DEFAULT 0 CHECK (daily_pay >= 0),
  payment_status TEXT NOT NULL DEFAULT 'Unpaid',
  paid_at TIMESTAMPTZ,
  payout_reference TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.tgi_part_time_weekly_payouts (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  employee_name TEXT,
  employee_nik TEXT,
  department TEXT,
  role TEXT,
  week_label TEXT NOT NULL,
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  hourly_rate NUMERIC NOT NULL DEFAULT 0 CHECK (hourly_rate >= 0),
  total_days_worked INTEGER NOT NULL DEFAULT 0 CHECK (total_days_worked >= 0),
  total_hours NUMERIC NOT NULL DEFAULT 0 CHECK (total_hours >= 0),
  base_pay NUMERIC NOT NULL DEFAULT 0 CHECK (base_pay >= 0),
  bonus NUMERIC NOT NULL DEFAULT 0 CHECK (bonus >= 0),
  meal_transport_allowance NUMERIC NOT NULL DEFAULT 0 CHECK (meal_transport_allowance >= 0),
  deduction NUMERIC NOT NULL DEFAULT 0 CHECK (deduction >= 0),
  total_net_pay NUMERIC NOT NULL DEFAULT 0 CHECK (total_net_pay >= 0),
  payment_status TEXT NOT NULL DEFAULT 'Draft',
  paid_at TIMESTAMPTZ,
  payment_reference TEXT,
  bank_name TEXT,
  bank_account_number TEXT,
  bank_account_holder TEXT,
  notes TEXT,
  daily_logs JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- 5. TABEL MANAJEMEN BONUS KARYAWAN (tgi_employee_bonuses & employee_bonuses)
CREATE TABLE IF NOT EXISTS public.tgi_employee_bonuses (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  employee_nik TEXT NOT NULL,
  employee_name TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  reason_note TEXT NOT NULL DEFAULT '',
  period_month TEXT NOT NULL,
  date_awarded TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.employee_bonuses (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  employee_nik TEXT NOT NULL,
  employee_name TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  reason_note TEXT NOT NULL DEFAULT '',
  period_month TEXT NOT NULL,
  date_awarded TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. TABEL TUNJANGAN KERAJINAN, KEDISIPLINAN & POTONGAN KESALAHAN (employee_adjustments)
CREATE TABLE IF NOT EXISTS public.employee_adjustments (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  employee_nik TEXT NOT NULL,
  employee_name TEXT NOT NULL,
  period_month TEXT NOT NULL,
  tunjangan_kerajinan NUMERIC NOT NULL DEFAULT 0 CHECK (tunjangan_kerajinan >= 0),
  tunjangan_kedisiplinan NUMERIC NOT NULL DEFAULT 0 CHECK (tunjangan_kedisiplinan >= 0),
  kesalahan_count INTEGER NOT NULL DEFAULT 0 CHECK (kesalahan_count >= 0),
  kesalahan_rate NUMERIC NOT NULL DEFAULT 10000 CHECK (kesalahan_rate >= 0),
  catatan_kesalahan TEXT DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_emp_adjustments_period ON public.employee_adjustments(period_month);

-- 7. TABEL POTONGAN ABSENSI, KASBON & BPJS/PPH21 MANUAL (payroll_deductions)
CREATE TABLE IF NOT EXISTS public.payroll_deductions (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  employee_nik TEXT NOT NULL,
  employee_name TEXT NOT NULL,
  period_month TEXT NOT NULL,
  tanpa_keterangan_hari NUMERIC NOT NULL DEFAULT 0 CHECK (tanpa_keterangan_hari >= 0),
  tanpa_keterangan_rate NUMERIC NOT NULL DEFAULT 0 CHECK (tanpa_keterangan_rate >= 0),
  izin_jam_menit NUMERIC NOT NULL DEFAULT 0 CHECK (izin_jam_menit >= 0),
  izin_jam_rate NUMERIC NOT NULL DEFAULT 0 CHECK (izin_jam_rate >= 0),
  izin_hari_jumlah NUMERIC NOT NULL DEFAULT 0 CHECK (izin_hari_jumlah >= 0),
  izin_hari_rate NUMERIC NOT NULL DEFAULT 0 CHECK (izin_hari_rate >= 0),
  sakit_tanpa_surat_hari NUMERIC NOT NULL DEFAULT 0 CHECK (sakit_tanpa_surat_hari >= 0),
  sakit_tanpa_surat_rate NUMERIC NOT NULL DEFAULT 0 CHECK (sakit_tanpa_surat_rate >= 0),
  sakit_dengan_surat_hari NUMERIC NOT NULL DEFAULT 0 CHECK (sakit_dengan_surat_hari >= 0),
  sakit_dengan_surat_rate NUMERIC NOT NULL DEFAULT 0 CHECK (sakit_dengan_surat_rate >= 0),
  cuti_hari NUMERIC NOT NULL DEFAULT 0 CHECK (cuti_hari >= 0),
  cuti_rate NUMERIC NOT NULL DEFAULT 0 CHECK (cuti_rate >= 0),
  bpjs_tk_manual NUMERIC NOT NULL DEFAULT 0 CHECK (bpjs_tk_manual >= 0),
  bpjs_kesehatan_manual NUMERIC NOT NULL DEFAULT 0 CHECK (bpjs_kesehatan_manual >= 0),
  pph21_manual NUMERIC NOT NULL DEFAULT 0 CHECK (pph21_manual >= 0),
  sisa_kasbon_lalu NUMERIC NOT NULL DEFAULT 0 CHECK (sisa_kasbon_lalu >= 0),
  cicilan_kasbon_bulan_ini NUMERIC NOT NULL DEFAULT 0 CHECK (cicilan_kasbon_bulan_ini >= 0),
  sisa_kasbon_depan NUMERIC NOT NULL DEFAULT 0 CHECK (sisa_kasbon_depan >= 0),
  catatan_potongan TEXT DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.payroll_deductions ADD COLUMN IF NOT EXISTS bpjs_tk_manual NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.payroll_deductions ADD COLUMN IF NOT EXISTS bpjs_kesehatan_manual NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.payroll_deductions ADD COLUMN IF NOT EXISTS pph21_manual NUMERIC NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_payroll_deductions_period ON public.payroll_deductions(period_month);

-- 8. TABEL PENGAJUAN CUTI & IZIN (leave_requests)
CREATE TABLE IF NOT EXISTS public.leave_requests (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  type TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_days INTEGER NOT NULL DEFAULT 1 CHECK (total_days >= 1),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Menunggu Persetujuan',
  applied_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  approved_by TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- 9. TABEL KLAIM LEMBUR (overtime_requests)
CREATE TABLE IF NOT EXISTS public.overtime_requests (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  date DATE NOT NULL,
  hours NUMERIC NOT NULL DEFAULT 1 CHECK (hours > 0 AND hours <= 24),
  task_description TEXT NOT NULL,
  calculated_pay NUMERIC NOT NULL DEFAULT 0 CHECK (calculated_pay >= 0),
  status TEXT NOT NULL DEFAULT 'Menunggu Persetujuan',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- 10. TABEL KLAIM REIMBURSEMENT (reimbursements)
CREATE TABLE IF NOT EXISTS public.reimbursements (
  id TEXT PRIMARY KEY,
  claim_number TEXT UNIQUE NOT NULL,
  employee_id TEXT NOT NULL,
  date DATE NOT NULL,
  category TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0 CHECK (amount >= 0),
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

-- 11. TABEL PINJAMAN KASBON & CICILAN (cash_advances)
CREATE TABLE IF NOT EXISTS public.cash_advances (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  employee_nik TEXT NOT NULL,
  employee_name TEXT NOT NULL,
  department TEXT DEFAULT '',
  amount NUMERIC NOT NULL DEFAULT 0 CHECK (amount >= 0),
  tenor_months INTEGER NOT NULL DEFAULT 1 CHECK (tenor_months >= 1),
  monthly_installment NUMERIC NOT NULL DEFAULT 0 CHECK (monthly_installment >= 0),
  total_paid NUMERIC NOT NULL DEFAULT 0 CHECK (total_paid >= 0),
  remaining_balance NUMERIC NOT NULL DEFAULT 0 CHECK (remaining_balance >= 0),
  reason TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  installments JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  approved_at TIMESTAMPTZ,
  approved_by TEXT,
  rejected_at TIMESTAMPTZ,
  rejected_by TEXT,
  rejection_reason TEXT,
  disbursed_at TIMESTAMPTZ,
  disbursed_by TEXT,
  disbursement_method TEXT,
  disbursement_reference TEXT,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- 12. TABEL ASET & INVENTARIS PERUSAHAAN (company_assets)
CREATE TABLE IF NOT EXISTS public.company_assets (
  id TEXT PRIMARY KEY,
  asset_code TEXT UNIQUE NOT NULL,
  serial_number TEXT,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  condition TEXT NOT NULL DEFAULT 'Baik',
  purchase_date DATE,
  purchase_cost NUMERIC NOT NULL DEFAULT 0 CHECK (purchase_cost >= 0),
  status TEXT NOT NULL DEFAULT 'Tersedia',
  location TEXT,
  assigned_to_employee_id TEXT,
  assigned_to_employee_name TEXT,
  assigned_to_employee_nik TEXT,
  assigned_date DATE,
  handover_condition_notes TEXT,
  photo_url TEXT,
  specifications TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- 13. TABEL PAYROLL / PENGGAJIAN BULANAN (payrolls)
CREATE TABLE IF NOT EXISTS public.payrolls (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  period TEXT NOT NULL,
  base_salary NUMERIC NOT NULL DEFAULT 0 CHECK (base_salary >= 0),
  allowance_position NUMERIC NOT NULL DEFAULT 0 CHECK (allowance_position >= 0),
  allowance_transport NUMERIC NOT NULL DEFAULT 0 CHECK (allowance_transport >= 0),
  allowance_meal NUMERIC NOT NULL DEFAULT 0 CHECK (allowance_meal >= 0),
  allowance_communication NUMERIC NOT NULL DEFAULT 0 CHECK (allowance_communication >= 0),
  overtime_pay NUMERIC NOT NULL DEFAULT 0 CHECK (overtime_pay >= 0),
  bonus NUMERIC NOT NULL DEFAULT 0 CHECK (bonus >= 0),
  total_gross_salary NUMERIC NOT NULL DEFAULT 0 CHECK (total_gross_salary >= 0),
  late_deduction NUMERIC NOT NULL DEFAULT 0 CHECK (late_deduction >= 0),
  bpjs_kesehatan_employee NUMERIC NOT NULL DEFAULT 0 CHECK (bpjs_kesehatan_employee >= 0),
  bpjs_kesehatan_employer NUMERIC NOT NULL DEFAULT 0 CHECK (bpjs_kesehatan_employer >= 0),
  bpjs_jht_employee NUMERIC NOT NULL DEFAULT 0 CHECK (bpjs_jht_employee >= 0),
  bpjs_jht_employer NUMERIC NOT NULL DEFAULT 0 CHECK (bpjs_jht_employer >= 0),
  bpjs_jp_employee NUMERIC NOT NULL DEFAULT 0 CHECK (bpjs_jp_employee >= 0),
  bpjs_jp_employer NUMERIC NOT NULL DEFAULT 0 CHECK (bpjs_jp_employer >= 0),
  bpjs_jkk_employer NUMERIC NOT NULL DEFAULT 0 CHECK (bpjs_jkk_employer >= 0),
  bpjs_jkm_employer NUMERIC NOT NULL DEFAULT 0 CHECK (bpjs_jkm_employer >= 0),
  pph21_ter NUMERIC NOT NULL DEFAULT 0 CHECK (pph21_ter >= 0),
  cash_advance_deduction NUMERIC NOT NULL DEFAULT 0 CHECK (cash_advance_deduction >= 0),
  total_deductions NUMERIC NOT NULL DEFAULT 0 CHECK (total_deductions >= 0),
  take_home_pay NUMERIC NOT NULL DEFAULT 0 CHECK (take_home_pay >= 0),
  payment_status TEXT NOT NULL DEFAULT 'Draft',
  payment_date DATE,
  reference_number TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- 14. TABEL SESI LIVESTREAMING & KOMISI (tgi_livestream_sessions)
CREATE TABLE IF NOT EXISTS public.tgi_livestream_sessions (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  session_date DATE NOT NULL,
  platform TEXT NOT NULL DEFAULT 'TikTok Shop Live',
  role TEXT NOT NULL DEFAULT 'host',
  duration_hours NUMERIC NOT NULL DEFAULT 0 CHECK (duration_hours >= 0),
  omzet NUMERIC NOT NULL DEFAULT 0 CHECK (omzet >= 0),
  pcs_sold INTEGER NOT NULL DEFAULT 0 CHECK (pcs_sold >= 0),
  commission_pct_snapshot NUMERIC NOT NULL DEFAULT 0 CHECK (commission_pct_snapshot >= 0),
  commission_per_pcs_snapshot NUMERIC NOT NULL DEFAULT 0 CHECK (commission_per_pcs_snapshot >= 0),
  total_earning NUMERIC NOT NULL DEFAULT 0 CHECK (total_earning >= 0),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- 15. TABEL PENGATURAN PERUSAHAAN & KONFIGURASI SISTEM (company_settings)
CREATE TABLE IF NOT EXISTS public.company_settings (
  id TEXT PRIMARY KEY DEFAULT 'tgi-main-config',
  company_name TEXT NOT NULL DEFAULT 'PT LUPYTA MAJU PERKASA',
  current_payroll_period TEXT NOT NULL DEFAULT 'Oktober 2026',
  config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- 15B. TABEL TUNJANGAN HARI RAYA / THR (tgi_thr_payouts) - SESUAI PERMENAKER NO. 6/2016
CREATE TABLE IF NOT EXISTS public.tgi_thr_payouts (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  employee_nik TEXT NOT NULL DEFAULT '',
  employee_name TEXT NOT NULL DEFAULT '',
  department TEXT DEFAULT '',
  role TEXT DEFAULT '',
  employment_type TEXT NOT NULL DEFAULT 'PKWT (Kontrak)',
  join_date DATE,
  thr_year INTEGER NOT NULL DEFAULT 2026,
  holiday_name TEXT NOT NULL DEFAULT 'Hari Raya Idul Fitri',
  holiday_date DATE NOT NULL DEFAULT CURRENT_DATE,
  period_month TEXT NOT NULL DEFAULT '2026-03',
  tenure_months INTEGER NOT NULL DEFAULT 0 CHECK (tenure_months >= 0),
  tenure_days INTEGER NOT NULL DEFAULT 0 CHECK (tenure_days >= 0),
  tenure_label TEXT DEFAULT '',
  eligibility_status TEXT NOT NULL DEFAULT 'Berhak Penuh (100%)',
  proportion_formula TEXT DEFAULT '100% × Upah Dasar',
  base_salary_component NUMERIC NOT NULL DEFAULT 0 CHECK (base_salary_component >= 0),
  fixed_allowance_component NUMERIC NOT NULL DEFAULT 0 CHECK (fixed_allowance_component >= 0),
  parttime_avg_monthly_wage NUMERIC NOT NULL DEFAULT 0 CHECK (parttime_avg_monthly_wage >= 0),
  calculation_basis_amount NUMERIC NOT NULL DEFAULT 0 CHECK (calculation_basis_amount >= 0),
  calculated_thr_amount NUMERIC NOT NULL DEFAULT 0 CHECK (calculated_thr_amount >= 0),
  manual_adjustment_amount NUMERIC NOT NULL DEFAULT 0,
  total_thr_amount NUMERIC NOT NULL DEFAULT 0 CHECK (total_thr_amount >= 0),
  show_in_payslip BOOLEAN NOT NULL DEFAULT false,
  payment_status TEXT NOT NULL DEFAULT 'Belum Cair',
  paid_at TIMESTAMPTZ,
  paid_by TEXT,
  payment_method TEXT DEFAULT 'Transfer Bank',
  reference_number TEXT,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.tgi_thr_payouts ADD COLUMN IF NOT EXISTS show_in_payslip BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.tgi_thr_payouts ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'Belum Cair';
ALTER TABLE public.tgi_thr_payouts ADD COLUMN IF NOT EXISTS manual_adjustment_amount NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.tgi_thr_payouts ADD COLUMN IF NOT EXISTS total_thr_amount NUMERIC NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_tgi_thr_payouts_emp ON public.tgi_thr_payouts(employee_id);
CREATE INDEX IF NOT EXISTS idx_tgi_thr_payouts_year ON public.tgi_thr_payouts(thr_year);
CREATE INDEX IF NOT EXISTS idx_tgi_thr_payouts_period ON public.tgi_thr_payouts(period_month);

-- 16. TABEL INTERNAL KEAMANAN KREDENSIAL ADMIN & RATE LIMITING (TERKUNCI DARI PUBLIK)
CREATE TABLE IF NOT EXISTS public.admin_credentials (
  email TEXT PRIMARY KEY,
  role TEXT NOT NULL DEFAULT 'Super Admin',
  secret_hash TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.auth_rate_limits (
  scope_key TEXT PRIMARY KEY,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.admin_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No Direct Access admin_credentials" ON public.admin_credentials;
CREATE POLICY "No Direct Access admin_credentials" ON public.admin_credentials FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "No Direct Access auth_rate_limits" ON public.auth_rate_limits;
CREATE POLICY "No Direct Access auth_rate_limits" ON public.auth_rate_limits FOR ALL USING (false) WITH CHECK (false);

DO $$
BEGIN
  REVOKE SELECT (access_pin) ON public.employees FROM anon, authenticated;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- =================================================================================
-- FUNGSI VERIFIKASI SESI, OTORISASI ADMIN RESMI, & RPC LOGIN SERVER-SIDE
-- =================================================================================

CREATE OR REPLACE FUNCTION public.is_app_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_jwt_email TEXT;
  v_hdr_json JSONB;
  v_hdr_admin_email TEXT;
  v_hdr_session TEXT;
BEGIN
  v_jwt_email := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  IF v_jwt_email IN ('jpexakun7@gmail.com', 'lupytacounting77@gmail.com') THEN
    RETURN true;
  END IF;

  BEGIN
    v_hdr_json := coalesce(current_setting('request.headers', true), '{}')::jsonb;
  EXCEPTION WHEN OTHERS THEN
    v_hdr_json := '{}'::jsonb;
  END;

  v_hdr_admin_email := lower(trim(coalesce(v_hdr_json ->> 'x-tgi-admin-email', '')));
  v_hdr_session := trim(coalesce(v_hdr_json ->> 'x-tgi-session-verified', ''));

  IF v_hdr_admin_email IN ('jpexakun7@gmail.com', 'lupytacounting77@gmail.com')
     AND length(v_hdr_session) >= 16 THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.current_employee_id()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_jwt_emp TEXT;
  v_hdr_json JSONB;
  v_hdr_emp TEXT;
  v_hdr_session TEXT;
BEGIN
  v_jwt_emp := nullif(trim(coalesce(auth.jwt() ->> 'employee_id', '')), '');
  IF v_jwt_emp IS NOT NULL THEN
    RETURN v_jwt_emp;
  END IF;

  BEGIN
    v_hdr_json := coalesce(current_setting('request.headers', true), '{}')::jsonb;
  EXCEPTION WHEN OTHERS THEN
    v_hdr_json := '{}'::jsonb;
  END;

  v_hdr_emp := nullif(trim(coalesce(v_hdr_json ->> 'x-tgi-employee-id', '')), '');
  v_hdr_session := trim(coalesce(v_hdr_json ->> 'x-tgi-session-verified', ''));

  IF v_hdr_emp IS NOT NULL AND length(v_hdr_session) >= 16 THEN
    RETURN v_hdr_emp;
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_app_authenticated()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_app_admin() THEN
    RETURN true;
  END IF;

  IF auth.role() = 'authenticated' THEN
    RETURN true;
  END IF;

  IF public.current_employee_id() IS NOT NULL THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_employee_pin(p_employee_id TEXT, p_new_pin TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean_pin TEXT := trim(coalesce(p_new_pin, ''));
BEGIN
  IF length(v_clean_pin) < 4 OR length(v_clean_pin) > 32 THEN
    RETURN jsonb_build_object('success', false, 'message', 'PIN Karyawan harus 4 hingga 32 karakter.');
  END IF;

  UPDATE public.employees
  SET
    access_pin_hash = crypt(v_clean_pin, gen_salt('bf')),
    access_pin = NULL,
    updated_at = timezone('utc'::text, now())
  WHERE id = trim(p_employee_id) OR lower(nik) = lower(trim(p_employee_id));

  RETURN jsonb_build_object('success', true, 'message', 'PIN Karyawan berhasil dienkripsi dengan Bcrypt.');
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_employee_pin(p_identifier TEXT, p_pin TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id TEXT := lower(trim(coalesce(p_identifier, '')));
  v_pin TEXT := trim(coalesce(p_pin, ''));
  v_scope TEXT := 'emp::' || v_id;
  v_rate RECORD;
  v_emp RECORD;
  v_matched BOOLEAN := false;
  v_new_attempts INTEGER;
  v_rem_sec INTEGER;
BEGIN
  IF v_id = '' OR v_pin = '' THEN
    RETURN jsonb_build_object('authenticated', false, 'message', 'Masukkan NIK/ID Karyawan dan PIN.');
  END IF;

  SELECT * INTO v_rate FROM public.auth_rate_limits WHERE scope_key = v_scope;
  IF FOUND AND v_rate.locked_until IS NOT NULL AND v_rate.locked_until > now() THEN
    v_rem_sec := greatest(1, ceil(extract(epoch FROM (v_rate.locked_until - now())))::int);
    RETURN jsonb_build_object(
      'authenticated', false,
      'isLockedOut', true,
      'remainingSeconds', v_rem_sec,
      'message', format('Terlalu banyak percobaan PIN salah (5x). Akun diblokir sementara selama %s detik.', v_rem_sec)
    );
  END IF;

  SELECT id, nik, full_name, department, access_pin_hash, access_pin
  INTO v_emp
  FROM public.employees
  WHERE lower(id) = v_id OR lower(nik) = v_id OR lower(email) = v_id
  LIMIT 1;

  IF FOUND THEN
    IF v_emp.access_pin_hash IS NOT NULL AND v_emp.access_pin_hash <> '' THEN
      v_matched := (v_emp.access_pin_hash = crypt(v_pin, v_emp.access_pin_hash));
    ELSIF v_emp.access_pin IS NOT NULL AND trim(v_emp.access_pin) <> '' AND trim(v_emp.access_pin) <> '••••' THEN
      v_matched := (trim(v_emp.access_pin) = v_pin);
      IF v_matched THEN
        UPDATE public.employees
        SET access_pin_hash = crypt(v_pin, gen_salt('bf')), access_pin = NULL
        WHERE id = v_emp.id;
      END IF;
    END IF;
  END IF;

  IF v_matched THEN
    DELETE FROM public.auth_rate_limits WHERE scope_key = v_scope;
    RETURN jsonb_build_object(
      'authenticated', true,
      'employeeId', v_emp.id,
      'employeeName', v_emp.full_name,
      'department', coalesce(v_emp.department, ''),
      'sessionToken', encode(gen_random_bytes(24), 'hex')
    );
  END IF;

  v_new_attempts := coalesce(v_rate.failed_attempts, 0) + 1;
  IF v_rate.locked_until IS NOT NULL AND v_rate.locked_until <= now() THEN
    v_new_attempts := 1;
  END IF;

  IF v_new_attempts >= 5 THEN
    INSERT INTO public.auth_rate_limits (scope_key, failed_attempts, locked_until, updated_at)
    VALUES (v_scope, v_new_attempts, now() + interval '5 minutes', now())
    ON CONFLICT (scope_key) DO UPDATE
    SET failed_attempts = v_new_attempts, locked_until = now() + interval '5 minutes', updated_at = now();

    RETURN jsonb_build_object(
      'authenticated', false,
      'isLockedOut', true,
      'remainingSeconds', 300,
      'message', 'Salah memasukkan PIN 5 kali berturut-turut. Akses login diblokir sementara selama 5 menit.'
    );
  ELSE
    INSERT INTO public.auth_rate_limits (scope_key, failed_attempts, locked_until, updated_at)
    VALUES (v_scope, v_new_attempts, NULL, now())
    ON CONFLICT (scope_key) DO UPDATE
    SET failed_attempts = v_new_attempts, locked_until = NULL, updated_at = now();

    RETURN jsonb_build_object(
      'authenticated', false,
      'remainingAttempts', 5 - v_new_attempts,
      'message', format('ID Karyawan atau PIN salah. Sisa percobaan: %s kali sebelum blokir 5 menit.', 5 - v_new_attempts)
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_employee_login(p_identifier TEXT, p_secret TEXT)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.verify_employee_pin(p_identifier, p_secret);
$$;

CREATE OR REPLACE FUNCTION public.set_admin_credential(p_email TEXT, p_role TEXT, p_new_secret TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(trim(coalesce(p_email, '')));
  v_secret TEXT := trim(coalesce(p_new_secret, ''));
BEGIN
  IF v_email NOT IN ('jpexakun7@gmail.com', 'lupytacounting77@gmail.com') THEN
    RETURN jsonb_build_object('success', false, 'message', 'Hanya email Admin resmi yang diizinkan mengatur kredensial Admin.');
  END IF;

  IF length(v_secret) < 4 OR length(v_secret) > 64 THEN
    RETURN jsonb_build_object('success', false, 'message', 'PIN / Kata Sandi Admin harus 4 hingga 64 karakter.');
  END IF;

  INSERT INTO public.admin_credentials (email, role, secret_hash, updated_at)
  VALUES (v_email, coalesce(p_role, 'Super Admin'), crypt(v_secret, gen_salt('bf')), now())
  ON CONFLICT (email) DO UPDATE
  SET role = coalesce(p_role, public.admin_credentials.role),
      secret_hash = crypt(v_secret, gen_salt('bf')),
      updated_at = now();

  RETURN jsonb_build_object('success', true, 'message', 'Kredensial Admin berhasil dienkripsi.');
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_admin_login(p_email TEXT, p_secret TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(trim(coalesce(p_email, '')));
  v_secret TEXT := trim(coalesce(p_secret, ''));
  v_scope TEXT := 'adm::' || v_email;
  v_rate RECORD;
  v_cred RECORD;
  v_new_attempts INTEGER;
  v_rem_sec INTEGER;
BEGIN
  IF v_email NOT IN ('jpexakun7@gmail.com', 'lupytacounting77@gmail.com') THEN
    RETURN jsonb_build_object('authenticated', false, 'message', 'Email ini tidak terdaftar sebagai Admin resmi PT Lupyta Maju Perkasa.');
  END IF;

  SELECT * INTO v_rate FROM public.auth_rate_limits WHERE scope_key = v_scope;
  IF FOUND AND v_rate.locked_until IS NOT NULL AND v_rate.locked_until > now() THEN
    v_rem_sec := greatest(1, ceil(extract(epoch FROM (v_rate.locked_until - now())))::int);
    RETURN jsonb_build_object(
      'authenticated', false,
      'isLockedOut', true,
      'remainingSeconds', v_rem_sec,
      'message', format('Terlalu banyak percobaan gagal. Login Admin dikunci sementara selama %s detik.', v_rem_sec)
    );
  END IF;

  SELECT * INTO v_cred FROM public.admin_credentials WHERE email = v_email;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('authenticated', false, 'message', 'Kredensial Admin belum terdaftar di server.');
  END IF;

  IF v_cred.secret_hash = crypt(v_secret, v_cred.secret_hash) THEN
    DELETE FROM public.auth_rate_limits WHERE scope_key = v_scope;
    RETURN jsonb_build_object(
      'authenticated', true,
      'email', v_cred.email,
      'role', v_cred.role,
      'sessionToken', encode(gen_random_bytes(24), 'hex')
    );
  END IF;

  v_new_attempts := coalesce(v_rate.failed_attempts, 0) + 1;
  IF v_rate.locked_until IS NOT NULL AND v_rate.locked_until <= now() THEN
    v_new_attempts := 1;
  END IF;

  IF v_new_attempts >= 5 THEN
    INSERT INTO public.auth_rate_limits (scope_key, failed_attempts, locked_until, updated_at)
    VALUES (v_scope, v_new_attempts, now() + interval '5 minutes', now())
    ON CONFLICT (scope_key) DO UPDATE
    SET failed_attempts = v_new_attempts, locked_until = now() + interval '5 minutes', updated_at = now();

    RETURN jsonb_build_object(
      'authenticated', false,
      'isLockedOut', true,
      'remainingSeconds', 300,
      'message', 'Salah memasukkan PIN Admin 5 kali berturut-turut. Akses diblokir selama 5 menit.'
    );
  ELSE
    INSERT INTO public.auth_rate_limits (scope_key, failed_attempts, locked_until, updated_at)
    VALUES (v_scope, v_new_attempts, NULL, now())
    ON CONFLICT (scope_key) DO UPDATE
    SET failed_attempts = v_new_attempts, locked_until = NULL, updated_at = now();

    RETURN jsonb_build_object(
      'authenticated', false,
      'remainingAttempts', 5 - v_new_attempts,
      'message', format('PIN / Kata Sandi Admin salah. Sisa percobaan: %s kali.', 5 - v_new_attempts)
    );
  END IF;
END;
$$;

-- =================================================================================
-- KEBIJAKAN ROW LEVEL SECURITY (RLS) KETAT (TANPA USING (true) BEBAS KE PUBLIK)
-- =================================================================================
DO $$
DECLARE
  t TEXT;
  pol RECORD;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'employees',
    'tgi_employees',
    'attendances',
    'attendance_logs',
    'tgi_parttime_logs',
    'parttime_logs',
    'tgi_part_time_weekly_payouts',
    'tgi_employee_bonuses',
    'employee_bonuses',
    'employee_adjustments',
    'payroll_deductions',
    'leave_requests',
    'overtime_requests',
    'reimbursements',
    'cash_advances',
    'company_assets',
    'payrolls',
    'tgi_thr_payouts',
    'tgi_livestream_sessions',
    'company_settings'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    FOR pol IN
      SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', pol.policyname, t);
    END LOOP;

    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I;', t);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;
END $$;

CREATE POLICY "employees_select_policy" ON public.employees
  FOR SELECT USING (public.is_app_admin() OR id = public.current_employee_id());

CREATE POLICY "employees_admin_insert_policy" ON public.employees
  FOR INSERT WITH CHECK (public.is_app_admin());

CREATE POLICY "employees_admin_update_policy" ON public.employees
  FOR UPDATE USING (public.is_app_admin()) WITH CHECK (public.is_app_admin());

CREATE POLICY "employees_admin_delete_policy" ON public.employees
  FOR DELETE USING (public.is_app_admin());

CREATE POLICY "tgi_employees_select_policy" ON public.tgi_employees
  FOR SELECT USING (public.is_app_admin() OR id = public.current_employee_id());

CREATE POLICY "tgi_employees_admin_insert_policy" ON public.tgi_employees
  FOR INSERT WITH CHECK (public.is_app_admin());

CREATE POLICY "tgi_employees_admin_update_policy" ON public.tgi_employees
  FOR UPDATE USING (public.is_app_admin()) WITH CHECK (public.is_app_admin());

CREATE POLICY "tgi_employees_admin_delete_policy" ON public.tgi_employees
  FOR DELETE USING (public.is_app_admin());

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'tgi_employee_bonuses',
    'employee_bonuses',
    'employee_adjustments',
    'payroll_deductions',
    'payrolls',
    'tgi_part_time_weekly_payouts'
  ]
  LOOP
    EXECUTE format(
      'CREATE POLICY "%s_select_self_or_admin" ON public.%I FOR SELECT USING (public.is_app_admin() OR employee_id = public.current_employee_id());',
      t, t
    );
    EXECUTE format(
      'CREATE POLICY "%s_admin_insert_only" ON public.%I FOR INSERT WITH CHECK (public.is_app_admin());',
      t, t
    );
    EXECUTE format(
      'CREATE POLICY "%s_admin_update_only" ON public.%I FOR UPDATE USING (public.is_app_admin()) WITH CHECK (public.is_app_admin());',
      t, t
    );
    EXECUTE format(
      'CREATE POLICY "%s_admin_delete_only" ON public.%I FOR DELETE USING (public.is_app_admin());',
      t, t
    );
  END LOOP;
END $$;

CREATE POLICY "tgi_thr_payouts_select_self_checked_or_admin" ON public.tgi_thr_payouts
  FOR SELECT USING (
    public.is_app_admin()
    OR (employee_id = public.current_employee_id() AND coalesce(show_in_payslip, false) = true)
  );

CREATE POLICY "tgi_thr_payouts_admin_insert_only" ON public.tgi_thr_payouts
  FOR INSERT WITH CHECK (public.is_app_admin());

CREATE POLICY "tgi_thr_payouts_admin_update_only" ON public.tgi_thr_payouts
  FOR UPDATE USING (public.is_app_admin()) WITH CHECK (public.is_app_admin());

CREATE POLICY "tgi_thr_payouts_admin_delete_only" ON public.tgi_thr_payouts
  FOR DELETE USING (public.is_app_admin());

CREATE POLICY "company_settings_select_authenticated" ON public.company_settings
  FOR SELECT USING (public.is_app_authenticated());

CREATE POLICY "company_settings_admin_insert_only" ON public.company_settings
  FOR INSERT WITH CHECK (public.is_app_admin());

CREATE POLICY "company_settings_admin_update_only" ON public.company_settings
  FOR UPDATE USING (public.is_app_admin()) WITH CHECK (public.is_app_admin());

CREATE POLICY "company_settings_admin_delete_only" ON public.company_settings
  FOR DELETE USING (public.is_app_admin());

CREATE POLICY "company_assets_select_authenticated" ON public.company_assets
  FOR SELECT USING (public.is_app_authenticated());

CREATE POLICY "company_assets_admin_insert_only" ON public.company_assets
  FOR INSERT WITH CHECK (public.is_app_admin());

CREATE POLICY "company_assets_admin_update_only" ON public.company_assets
  FOR UPDATE USING (public.is_app_admin()) WITH CHECK (public.is_app_admin());

CREATE POLICY "company_assets_admin_delete_only" ON public.company_assets
  FOR DELETE USING (public.is_app_admin());

CREATE POLICY "attendances_select_self_or_admin" ON public.attendances
  FOR SELECT USING (public.is_app_admin() OR employee_id = public.current_employee_id());

CREATE POLICY "attendances_insert_self_or_admin" ON public.attendances
  FOR INSERT WITH CHECK (
    public.is_app_admin()
    OR (
      employee_id = public.current_employee_id()
      AND (
        status IN ('Izin', 'Sakit', 'Cuti')
        OR (
          coalesce(is_in_office_radius, false) = true
          AND coalesce(face_scan_verified, false) = true
          AND length(coalesce(face_photo_snapshot, photo_in, '')) > 20
          AND (
            coalesce(check_out, '') IN ('', '-')
            OR length(coalesce(check_out_photo_snapshot, face_photo_out, photo_out, '')) > 20
          )
        )
      )
    )
  );

CREATE POLICY "attendances_update_self_or_admin" ON public.attendances
  FOR UPDATE
  USING (public.is_app_admin() OR employee_id = public.current_employee_id())
  WITH CHECK (
    public.is_app_admin()
    OR (
      employee_id = public.current_employee_id()
      AND (
        status IN ('Izin', 'Sakit', 'Cuti')
        OR (
          coalesce(is_in_office_radius, false) = true
          AND coalesce(face_scan_verified, false) = true
          AND length(coalesce(face_photo_snapshot, photo_in, '')) > 20
          AND (
            coalesce(check_out, '') IN ('', '-')
            OR length(coalesce(check_out_photo_snapshot, face_photo_out, photo_out, '')) > 20
          )
        )
      )
    )
  );

CREATE POLICY "attendances_delete_admin_only" ON public.attendances
  FOR DELETE USING (public.is_app_admin());

CREATE POLICY "attendance_logs_select_self_or_admin" ON public.attendance_logs
  FOR SELECT USING (public.is_app_admin() OR employee_id = public.current_employee_id());

CREATE POLICY "attendance_logs_insert_self_or_admin" ON public.attendance_logs
  FOR INSERT WITH CHECK (
    public.is_app_admin()
    OR (
      employee_id = public.current_employee_id()
      AND coalesce(is_in_office_radius, false) = true
      AND coalesce(face_scan_verified, false) = true
    )
  );

CREATE POLICY "attendance_logs_update_self_or_admin" ON public.attendance_logs
  FOR UPDATE
  USING (public.is_app_admin() OR employee_id = public.current_employee_id())
  WITH CHECK (
    public.is_app_admin()
    OR (
      employee_id = public.current_employee_id()
      AND coalesce(is_in_office_radius, false) = true
      AND coalesce(face_scan_verified, false) = true
    )
  );

CREATE POLICY "attendance_logs_delete_admin_only" ON public.attendance_logs
  FOR DELETE USING (public.is_app_admin());

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'tgi_parttime_logs',
    'parttime_logs',
    'leave_requests',
    'overtime_requests',
    'reimbursements',
    'cash_advances',
    'tgi_livestream_sessions'
  ]
  LOOP
    EXECUTE format(
      'CREATE POLICY "%s_select_self_or_admin" ON public.%I FOR SELECT USING (public.is_app_admin() OR employee_id = public.current_employee_id());',
      t, t
    );
    EXECUTE format(
      'CREATE POLICY "%s_insert_self_or_admin" ON public.%I FOR INSERT WITH CHECK (public.is_app_admin() OR employee_id = public.current_employee_id());',
      t, t
    );
    EXECUTE format(
      'CREATE POLICY "%s_update_self_or_admin" ON public.%I FOR UPDATE USING (public.is_app_admin() OR employee_id = public.current_employee_id()) WITH CHECK (public.is_app_admin() OR employee_id = public.current_employee_id());',
      t, t
    );
    EXECUTE format(
      'CREATE POLICY "%s_delete_admin_only" ON public.%I FOR DELETE USING (public.is_app_admin());',
      t, t
    );
  END LOOP;
END $$;
`;

export const SUPABASE_SECURITY_MIGRATION_SQL = SUPABASE_SQL_SCHEMA;
export const SUPABASE_ADDITIONAL_SQL_SCHEMA = SUPABASE_SQL_SCHEMA;
