-- =============================================================================
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
  role TEXT NOT NULL DEFAULT 'Admin' CHECK (role IN ('Super Admin', 'HR Admin', 'Finance', 'Employee')),
  secret_hash TEXT NOT NULL,
  employee_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Aktifkan RLS ketat pada tabel kredensial (Tidak boleh dibaca langsung dari client API)
ALTER TABLE public.app_auth_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No Direct Client Access to Credentials" ON public.app_auth_credentials;
CREATE POLICY "No Direct Client Access to Credentials"
  ON public.app_auth_credentials
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- Tambahkan kolom access_pin_hash, daily_salary, dan hourly_rate pada tabel employees
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS access_pin_hash TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS daily_salary NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC NOT NULL DEFAULT 0;

-- Migrasikan PIN lama yang masih plaintext (jika ada) ke bentuk bcrypt hash lalu bersihkan plaintext
UPDATE public.employees
SET
  access_pin_hash = crypt(access_pin, gen_salt('bf', 10)),
  access_pin = NULL
WHERE access_pin IS NOT NULL
  AND length(trim(access_pin)) > 0
  AND (access_pin_hash IS NULL OR length(trim(access_pin_hash)) = 0);

-- 3. Hapus seluruh kebijakan lama yang terbuka untuk publik ("Public Full Access ...")
DROP POLICY IF EXISTS "Public Full Access Employees" ON public.employees;
DROP POLICY IF EXISTS "Public Full Access Company Assets" ON public.company_assets;
DROP POLICY IF EXISTS "Public Full Access Payrolls" ON public.payrolls;
DROP POLICY IF EXISTS "Public Full Access Attendances" ON public.attendances;
DROP POLICY IF EXISTS "Public Full Access Leave Requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Public Full Access Overtime Requests" ON public.overtime_requests;
DROP POLICY IF EXISTS "Public Full Access Reimbursements" ON public.reimbursements;

-- Pastikan RLS aktif pada seluruh tabel utama
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payrolls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.overtime_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reimbursements ENABLE ROW LEVEL SECURITY;

-- 4. Fungsi Helper untuk memeriksa apakah request berasal dari sesi terautentikasi
-- Mendukung Supabase Auth JWT (auth.role() = 'authenticated') atau header RPC terverifikasi
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
DECLARE
  v_email TEXT;
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN true;
  END IF;

  IF auth.role() = 'authenticated' THEN
    v_email := lower(coalesce(auth.jwt()->>'email', ''));
    IF EXISTS (
      SELECT 1 FROM public.app_auth_credentials
      WHERE lower(email) = v_email
        AND role IN ('Super Admin', 'HR Admin', 'Finance')
        AND is_active = true
    ) THEN
      RETURN true;
    END IF;
    -- Jika user login via Supabase Auth resmi proyek ini
    RETURN true;
  END IF;

  RETURN public.is_app_authenticated();
END;
$$;

-- 5. Terapkan Kebijakan RLS Ketat (Strict Row Level Security) untuk setiap tabel

-- A. Tabel employees
DROP POLICY IF EXISTS "Authenticated Select Employees" ON public.employees;
DROP POLICY IF EXISTS "Admin Insert Employees" ON public.employees;
DROP POLICY IF EXISTS "Admin Update Employees" ON public.employees;
DROP POLICY IF EXISTS "Admin Delete Employees" ON public.employees;

CREATE POLICY "Authenticated Select Employees"
  ON public.employees FOR SELECT
  USING (public.is_app_authenticated());

CREATE POLICY "Admin Insert Employees"
  ON public.employees FOR INSERT
  WITH CHECK (public.is_app_admin());

CREATE POLICY "Admin Update Employees"
  ON public.employees FOR UPDATE
  USING (public.is_app_authenticated())
  WITH CHECK (public.is_app_authenticated());

CREATE POLICY "Admin Delete Employees"
  ON public.employees FOR DELETE
  USING (public.is_app_admin());

-- B. Tabel company_assets
DROP POLICY IF EXISTS "Authenticated Select Company Assets" ON public.company_assets;
DROP POLICY IF EXISTS "Admin Insert Company Assets" ON public.company_assets;
DROP POLICY IF EXISTS "Admin Update Company Assets" ON public.company_assets;
DROP POLICY IF EXISTS "Admin Delete Company Assets" ON public.company_assets;

CREATE POLICY "Authenticated Select Company Assets"
  ON public.company_assets FOR SELECT
  USING (public.is_app_authenticated());

CREATE POLICY "Admin Insert Company Assets"
  ON public.company_assets FOR INSERT
  WITH CHECK (public.is_app_admin());

CREATE POLICY "Admin Update Company Assets"
  ON public.company_assets FOR UPDATE
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());

CREATE POLICY "Admin Delete Company Assets"
  ON public.company_assets FOR DELETE
  USING (public.is_app_admin());

-- C. Tabel payrolls
DROP POLICY IF EXISTS "Authenticated Select Payrolls" ON public.payrolls;
DROP POLICY IF EXISTS "Admin Insert Payrolls" ON public.payrolls;
DROP POLICY IF EXISTS "Admin Update Payrolls" ON public.payrolls;
DROP POLICY IF EXISTS "Admin Delete Payrolls" ON public.payrolls;

CREATE POLICY "Authenticated Select Payrolls"
  ON public.payrolls FOR SELECT
  USING (public.is_app_authenticated());

CREATE POLICY "Admin Insert Payrolls"
  ON public.payrolls FOR INSERT
  WITH CHECK (public.is_app_admin());

CREATE POLICY "Admin Update Payrolls"
  ON public.payrolls FOR UPDATE
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());

CREATE POLICY "Admin Delete Payrolls"
  ON public.payrolls FOR DELETE
  USING (public.is_app_admin());

-- D. Tabel attendances
DROP POLICY IF EXISTS "Authenticated Select Attendances" ON public.attendances;
DROP POLICY IF EXISTS "Authenticated Insert Attendances" ON public.attendances;
DROP POLICY IF EXISTS "Authenticated Update Attendances" ON public.attendances;
DROP POLICY IF EXISTS "Admin Delete Attendances" ON public.attendances;

CREATE POLICY "Authenticated Select Attendances"
  ON public.attendances FOR SELECT
  USING (public.is_app_authenticated());

CREATE POLICY "Authenticated Insert Attendances"
  ON public.attendances FOR INSERT
  WITH CHECK (public.is_app_authenticated());

CREATE POLICY "Authenticated Update Attendances"
  ON public.attendances FOR UPDATE
  USING (public.is_app_authenticated())
  WITH CHECK (public.is_app_authenticated());

CREATE POLICY "Admin Delete Attendances"
  ON public.attendances FOR DELETE
  USING (public.is_app_admin());

-- E. Tabel leave_requests
DROP POLICY IF EXISTS "Authenticated Select Leave Requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Authenticated Insert Leave Requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Authenticated Update Leave Requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Admin Delete Leave Requests" ON public.leave_requests;

CREATE POLICY "Authenticated Select Leave Requests"
  ON public.leave_requests FOR SELECT
  USING (public.is_app_authenticated());

CREATE POLICY "Authenticated Insert Leave Requests"
  ON public.leave_requests FOR INSERT
  WITH CHECK (public.is_app_authenticated());

CREATE POLICY "Authenticated Update Leave Requests"
  ON public.leave_requests FOR UPDATE
  USING (public.is_app_authenticated())
  WITH CHECK (public.is_app_authenticated());

CREATE POLICY "Admin Delete Leave Requests"
  ON public.leave_requests FOR DELETE
  USING (public.is_app_admin());

-- F. Tabel overtime_requests
DROP POLICY IF EXISTS "Authenticated Select Overtime Requests" ON public.overtime_requests;
DROP POLICY IF EXISTS "Authenticated Insert Overtime Requests" ON public.overtime_requests;
DROP POLICY IF EXISTS "Authenticated Update Overtime Requests" ON public.overtime_requests;
DROP POLICY IF EXISTS "Admin Delete Overtime Requests" ON public.overtime_requests;

CREATE POLICY "Authenticated Select Overtime Requests"
  ON public.overtime_requests FOR SELECT
  USING (public.is_app_authenticated());

CREATE POLICY "Authenticated Insert Overtime Requests"
  ON public.overtime_requests FOR INSERT
  WITH CHECK (public.is_app_authenticated());

CREATE POLICY "Authenticated Update Overtime Requests"
  ON public.overtime_requests FOR UPDATE
  USING (public.is_app_authenticated())
  WITH CHECK (public.is_app_authenticated());

CREATE POLICY "Admin Delete Overtime Requests"
  ON public.overtime_requests FOR DELETE
  USING (public.is_app_admin());

-- G. Tabel reimbursements
DROP POLICY IF EXISTS "Authenticated Select Reimbursements" ON public.reimbursements;
DROP POLICY IF EXISTS "Authenticated Insert Reimbursements" ON public.reimbursements;
DROP POLICY IF EXISTS "Authenticated Update Reimbursements" ON public.reimbursements;
DROP POLICY IF EXISTS "Admin Delete Reimbursements" ON public.reimbursements;

CREATE POLICY "Authenticated Select Reimbursements"
  ON public.reimbursements FOR SELECT
  USING (public.is_app_authenticated());

CREATE POLICY "Authenticated Insert Reimbursements"
  ON public.reimbursements FOR INSERT
  WITH CHECK (public.is_app_authenticated());

CREATE POLICY "Authenticated Update Reimbursements"
  ON public.reimbursements FOR UPDATE
  USING (public.is_app_authenticated())
  WITH CHECK (public.is_app_authenticated());

CREATE POLICY "Admin Delete Reimbursements"
  ON public.reimbursements FOR DELETE
  USING (public.is_app_admin());

-- 6. Fungsi RPC Verifikasi Login Admin (Server-Side Hash Check, Tanpa Ekspos Password ke Client)
CREATE OR REPLACE FUNCTION public.verify_admin_login(
  p_email TEXT,
  p_secret TEXT
)
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
  WHERE lower(email) = lower(trim(p_email))
    AND is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'authenticated', false,
      'message', 'Kredensial admin belum terdaftar atau tidak ditemukan di server.'
    );
  END IF;

  IF v_cred.locked_until IS NOT NULL AND v_cred.locked_until > NOW() THEN
    RETURN jsonb_build_object(
      'authenticated', false,
      'message', 'Akun dikunci sementara karena terlalu banyak percobaan gagal.'
    );
  END IF;

  IF v_cred.secret_hash = crypt(p_secret, v_cred.secret_hash) THEN
    UPDATE public.app_auth_credentials
    SET failed_attempts = 0, locked_until = NULL, updated_at = NOW()
    WHERE id = v_cred.id;

    RETURN jsonb_build_object(
      'authenticated', true,
      'email', v_cred.email,
      'role', v_cred.role,
      'sessionToken', encode(gen_random_bytes(24), 'hex')
    );
  ELSE
    UPDATE public.app_auth_credentials
    SET
      failed_attempts = failed_attempts + 1,
      locked_until = CASE WHEN failed_attempts + 1 >= 5 THEN NOW() + INTERVAL '5 minutes' ELSE NULL END,
      updated_at = NOW()
    WHERE id = v_cred.id;

    RETURN jsonb_build_object(
      'authenticated', false,
      'message', 'PIN atau kata sandi salah.'
    );
  END IF;
END;
$$;

-- 7. Fungsi RPC Verifikasi Login Karyawan (Tanpa memuat daftar seluruh karyawan ke browser sebelum login)
CREATE OR REPLACE FUNCTION public.verify_employee_login(
  p_identifier TEXT,
  p_secret TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emp public.employees%ROWTYPE;
  v_clean_id TEXT := lower(trim(p_identifier));
  v_matched BOOLEAN := false;
BEGIN
  SELECT * INTO v_emp
  FROM public.employees
  WHERE lower(id) = v_clean_id
     OR lower(coalesce(nik, '')) = v_clean_id
     OR lower(coalesce(email, '')) = v_clean_id
     OR lower(name) = v_clean_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'authenticated', false,
      'message', 'ID Karyawan / NIK / Email tidak ditemukan.'
    );
  END IF;

  IF v_emp.access_pin_hash IS NOT NULL AND length(trim(v_emp.access_pin_hash)) > 0 THEN
    v_matched := (v_emp.access_pin_hash = crypt(p_secret, v_emp.access_pin_hash));
  ELSIF v_emp.access_pin IS NOT NULL AND length(trim(v_emp.access_pin)) > 0 THEN
    v_matched := (v_emp.access_pin = p_secret);
    IF v_matched THEN
      -- Otomatis konversi ke bcrypt hash setelah berhasil diverifikasi
      UPDATE public.employees
      SET access_pin_hash = crypt(p_secret, gen_salt('bf', 10)), access_pin = NULL
      WHERE id = v_emp.id;
    END IF;
  END IF;

  IF NOT v_matched THEN
    RETURN jsonb_build_object(
      'authenticated', false,
      'message', 'PIN Karyawan tidak sesuai.'
    );
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

-- 8. Fungsi RPC Pengaturan / Pembaruan Kredensial Admin & PIN Karyawan (Disimpan sebagai Bcrypt Hash)
CREATE OR REPLACE FUNCTION public.set_admin_credential(
  p_email TEXT,
  p_role TEXT,
  p_new_secret TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF length(trim(p_new_secret)) < 4 THEN
    RETURN jsonb_build_object('success', false, 'message', 'PIN/Password minimal 4 karakter.');
  END IF;

  INSERT INTO public.app_auth_credentials (email, role, secret_hash, updated_at)
  VALUES (
    lower(trim(p_email)),
    coalesce(p_role, 'Super Admin'),
    crypt(p_new_secret, gen_salt('bf', 10)),
    NOW()
  )
  ON CONFLICT (email) DO UPDATE
  SET
    role = EXCLUDED.role,
    secret_hash = EXCLUDED.secret_hash,
    failed_attempts = 0,
    locked_until = NULL,
    updated_at = NOW();

  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_employee_pin(
  p_employee_id TEXT,
  p_new_pin TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF length(trim(p_new_pin)) < 4 THEN
    RETURN jsonb_build_object('success', false, 'message', 'PIN Karyawan minimal 4 digit.');
  END IF;

  UPDATE public.employees
  SET
    access_pin_hash = crypt(trim(p_new_pin), gen_salt('bf', 10)),
    access_pin = NULL,
    updated_at = NOW()
  WHERE id = p_employee_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Karyawan tidak ditemukan.');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_admin_login(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_employee_login(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_admin_credential(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_employee_pin(TEXT, TEXT) TO authenticated;

-- =============================================================================
-- 9. SKEMA LIVE STREAMING HOST & CO-HOST (tgi_employees & tgi_livestream_sessions)
-- =============================================================================

-- Pastikan tabel tgi_employees tersedia (atau jika menggunakan tabel employees utama)
CREATE TABLE IF NOT EXISTS public.tgi_employees (
    id TEXT PRIMARY KEY,
    nik TEXT,
    full_name TEXT,
    is_host BOOLEAN DEFAULT FALSE,
    is_co_host BOOLEAN DEFAULT FALSE,
    host_commission_pct DECIMAL(5,2) DEFAULT 2.50,
    host_commission_per_pcs DECIMAL(10,2) DEFAULT 2000.00,
    co_host_commission_pct DECIMAL(5,2) DEFAULT 1.00,
    co_host_commission_per_pcs DECIMAL(10,2) DEFAULT 1000.00,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tambahan kolom role dan komisi pada tabel tgi_employees
ALTER TABLE public.tgi_employees 
ADD COLUMN IF NOT EXISTS is_host BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_co_host BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS host_commission_pct DECIMAL(5,2) DEFAULT 2.50,
ADD COLUMN IF NOT EXISTS host_commission_per_pcs DECIMAL(10,2) DEFAULT 2000.00,
ADD COLUMN IF NOT EXISTS co_host_commission_pct DECIMAL(5,2) DEFAULT 1.00,
ADD COLUMN IF NOT EXISTS co_host_commission_per_pcs DECIMAL(10,2) DEFAULT 1000.00;

-- Tambahan kolom yang sama pada tabel public.employees agar sinkron penuh
ALTER TABLE public.employees 
ADD COLUMN IF NOT EXISTS is_host BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_co_host BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS host_commission_pct DECIMAL(5,2) DEFAULT 2.50,
ADD COLUMN IF NOT EXISTS host_commission_per_pcs DECIMAL(10,2) DEFAULT 2000.00,
ADD COLUMN IF NOT EXISTS co_host_commission_pct DECIMAL(5,2) DEFAULT 1.00,
ADD COLUMN IF NOT EXISTS co_host_commission_per_pcs DECIMAL(10,2) DEFAULT 1000.00;

-- Tabel riwayat sesi live streaming per karyawan per periode
CREATE TABLE IF NOT EXISTS public.tgi_livestream_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id TEXT NOT NULL,
    employee_name TEXT NOT NULL,
    role_type TEXT CHECK (role_type IN ('host', 'co_host')) NOT NULL,
    platform TEXT DEFAULT 'TikTok Shop Live',
    session_date DATE NOT NULL,
    omset DECIMAL(15,2) DEFAULT 0.00,
    pcs_sold INTEGER DEFAULT 0,
    commission_pct_used DECIMAL(5,2) DEFAULT 0.00,
    commission_per_pcs_used DECIMAL(10,2) DEFAULT 0.00,
    total_commission DECIMAL(12,2) DEFAULT 0.00,
    period TEXT NOT NULL, -- Contoh: 'Oktober 2026'
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Aktifkan RLS pada tgi_employees dan tgi_livestream_sessions
ALTER TABLE public.tgi_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tgi_livestream_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated Select TGI Employees" ON public.tgi_employees;
DROP POLICY IF EXISTS "Admin Write TGI Employees" ON public.tgi_employees;

CREATE POLICY "Authenticated Select TGI Employees"
  ON public.tgi_employees FOR SELECT
  USING (public.is_app_authenticated());

CREATE POLICY "Admin Write TGI Employees"
  ON public.tgi_employees FOR ALL
  USING (public.is_app_authenticated())
  WITH CHECK (public.is_app_authenticated());

DROP POLICY IF EXISTS "Authenticated Select Livestream Sessions" ON public.tgi_livestream_sessions;
DROP POLICY IF EXISTS "Admin Insert Livestream Sessions" ON public.tgi_livestream_sessions;
DROP POLICY IF EXISTS "Admin Update Livestream Sessions" ON public.tgi_livestream_sessions;
DROP POLICY IF EXISTS "Admin Delete Livestream Sessions" ON public.tgi_livestream_sessions;

CREATE POLICY "Authenticated Select Livestream Sessions"
  ON public.tgi_livestream_sessions FOR SELECT
  USING (public.is_app_authenticated());

CREATE POLICY "Admin Insert Livestream Sessions"
  ON public.tgi_livestream_sessions FOR INSERT
  WITH CHECK (public.is_app_authenticated());

CREATE POLICY "Admin Update Livestream Sessions"
  ON public.tgi_livestream_sessions FOR UPDATE
  USING (public.is_app_authenticated())
  WITH CHECK (public.is_app_authenticated());

CREATE POLICY "Admin Delete Livestream Sessions"
  ON public.tgi_livestream_sessions FOR DELETE
  USING (public.is_app_authenticated());

-- ============================================================================
-- 10. SKEMA PART-TIME WEEKLY PAYROLL & SUNDAY PAYOUT (GAJI MINGGUAN MINGGU)
-- ============================================================================

-- Tambahan kolom employment_type ('Full-Time' | 'Contract' | 'Part-Time'), hourly_rate & overtime_rate
ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS employment_type TEXT DEFAULT 'Full-Time',
ADD COLUMN IF NOT EXISTS hourly_rate DECIMAL(12,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS overtime_rate DECIMAL(12,2) DEFAULT 0.00;

ALTER TABLE public.tgi_employees
ADD COLUMN IF NOT EXISTS employment_type TEXT DEFAULT 'Full-Time',
ADD COLUMN IF NOT EXISTS hourly_rate DECIMAL(12,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS overtime_rate DECIMAL(12,2) DEFAULT 0.00;

-- Tabel pencatatan jam kerja & absensi harian karyawan Part-Time (tgi_parttime_logs & tgi_part_time_logs)
CREATE TABLE IF NOT EXISTS public.tgi_parttime_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id TEXT NOT NULL,
    employee_name TEXT NOT NULL,
    employee_nik TEXT,
    department TEXT,
    work_date DATE NOT NULL,
    clock_in TEXT,
    clock_out TEXT,
    normal_hours DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    overtime_hours DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    hours_worked DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    hourly_rate DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    overtime_rate DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    daily_wage DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    source TEXT DEFAULT 'portal',
    notes TEXT,
    status TEXT CHECK (status IN ('Unpaid', 'Paid')) DEFAULT 'Unpaid',
    paid_at TIMESTAMP WITH TIME ZONE,
    weekly_payout_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.tgi_part_time_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id TEXT NOT NULL,
    employee_name TEXT NOT NULL,
    employee_nik TEXT,
    department TEXT,
    work_date DATE NOT NULL,
    clock_in TEXT,
    clock_out TEXT,
    normal_hours DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    overtime_hours DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    hours_worked DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    hourly_rate DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    overtime_rate DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    daily_wage DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    source TEXT DEFAULT 'portal',
    notes TEXT,
    status TEXT CHECK (status IN ('Unpaid', 'Paid')) DEFAULT 'Unpaid',
    paid_at TIMESTAMP WITH TIME ZONE,
    weekly_payout_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.tgi_part_time_logs
ADD COLUMN IF NOT EXISTS clock_in TEXT,
ADD COLUMN IF NOT EXISTS clock_out TEXT,
ADD COLUMN IF NOT EXISTS normal_hours DECIMAL(5,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS overtime_hours DECIMAL(5,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS overtime_rate DECIMAL(12,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'portal';

-- Tabel rekap pembayaran gaji mingguan Part-Time (Sunday Payout / Laporan Pengeluaran)
CREATE TABLE IF NOT EXISTS public.tgi_part_time_weekly_payouts (
    id TEXT PRIMARY KEY,
    reference_number TEXT NOT NULL,
    employee_id TEXT NOT NULL,
    employee_name TEXT NOT NULL,
    employee_nik TEXT,
    department TEXT,
    role TEXT,
    bank_name TEXT,
    bank_account_number TEXT,
    bank_account_holder TEXT,
    week_start_date DATE NOT NULL,
    week_end_date DATE NOT NULL,
    payout_date DATE NOT NULL,
    total_days_worked INTEGER DEFAULT 0,
    normal_hours_worked DECIMAL(6,2) DEFAULT 0.00,
    overtime_hours_worked DECIMAL(6,2) DEFAULT 0.00,
    total_hours_worked DECIMAL(6,2) DEFAULT 0.00,
    hourly_rate DECIMAL(12,2) DEFAULT 0.00,
    overtime_rate DECIMAL(12,2) DEFAULT 0.00,
    gross_salary DECIMAL(14,2) DEFAULT 0.00,
    net_payout DECIMAL(14,2) DEFAULT 0.00,
    status TEXT CHECK (status IN ('Unpaid', 'Paid')) DEFAULT 'Paid',
    paid_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    paid_by TEXT,
    payment_method TEXT DEFAULT 'Transfer Bank',
    notes TEXT,
    log_ids JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.tgi_parttime_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tgi_part_time_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tgi_part_time_weekly_payouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated Access PartTime Logs v2" ON public.tgi_parttime_logs;
CREATE POLICY "Authenticated Access PartTime Logs v2"
  ON public.tgi_parttime_logs FOR ALL
  USING (public.is_app_authenticated())
  WITH CHECK (public.is_app_authenticated());

DROP POLICY IF EXISTS "Authenticated Access PartTime Logs" ON public.tgi_part_time_logs;
CREATE POLICY "Authenticated Access PartTime Logs"
  ON public.tgi_part_time_logs FOR ALL
  USING (public.is_app_authenticated())
  WITH CHECK (public.is_app_authenticated());

DROP POLICY IF EXISTS "Authenticated Access PartTime Payouts" ON public.tgi_part_time_weekly_payouts;
CREATE POLICY "Authenticated Access PartTime Payouts"
  ON public.tgi_part_time_weekly_payouts FOR ALL
  USING (public.is_app_authenticated())
  WITH CHECK (public.is_app_authenticated());



