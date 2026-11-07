import React, { useState } from 'react';
import {
  Percent,
  Calculator,
  FileCheck2,
  CalendarCheck2,
  Info,
} from 'lucide-react';
import { Employee, PayrollRecord, PTKPStatus } from '../types';
import {
  formatRupiah,
  getTERCategory,
  getTERRate,
  getNpwpStatusInfo,
  calculateDecemberPPh21Reconciliation,
} from '../utils/formatters';

interface TaxAndBpjsViewProps {
  employees: Employee[];
  payrolls: PayrollRecord[];
}

export const TaxAndBpjsView: React.FC<TaxAndBpjsViewProps> = ({
  employees,
  payrolls,
}) => {
  // Simulator State
  const [simSalary, setSimSalary] = useState<number>(12000000);
  const [simPtkp, setSimPtkp] = useState<PTKPStatus>('TK/0');
  const [simMode, setSimMode] = useState<'monthly_ter' | 'december_a1'>('monthly_ter');
  const [simMonthsWorked, setSimMonthsWorked] = useState<number>(12);

  // BPJS Simulation
  const bpjsKesBase = Math.min(simSalary, 12000000);
  const simBpjsKesEmp = Math.round(bpjsKesBase * 0.01);
  const simBpjsKesComp = Math.round(bpjsKesBase * 0.04); // Objek PPh 21 Bruto

  const bpjsJhtEmp = Math.round(simSalary * 0.02); // Pengurang Bruto Pasal 17 (Desember)
  const bpjsJhtComp = Math.round(simSalary * 0.037);

  const bpjsJpBase = Math.min(simSalary, 10600000);
  const simBpjsJpEmp = Math.round(bpjsJpBase * 0.01); // Pengurang Bruto Pasal 17 (Desember)
  const simBpjsJpComp = Math.round(bpjsJpBase * 0.02);

  const simBpjsJkkComp = Math.round(simSalary * 0.0024); // Objek PPh 21 Bruto
  const simBpjsJkmComp = Math.round(simSalary * 0.003); // Objek PPh 21 Bruto

  // Komponen Premi BPJS Pemberi Kerja yang menambah DPP Bruto PPh 21 (PP 58/2023 & PMK 168/2023)
  const simEmployerBpjsTaxable = simBpjsKesComp + simBpjsJkkComp + simBpjsJkmComp;
  const simTaxableGrossMonthly = simSalary + simEmployerBpjsTaxable;

  const simCategory = getTERCategory(simPtkp);
  const simRate = getTERRate(simCategory, simTaxableGrossMonthly);
  const simPph21MonthlyTer = Math.round(simTaxableGrossMonthly * simRate);

  // Rekonsiliasi PPh 21 Masa Desember (Form 1721-A1 Pasal 17)
  const simDecReconciliation = calculateDecemberPPh21Reconciliation({
    monthlyTaxableGross: simTaxableGrossMonthly,
    bpjsJhtEmployeeMonthly: bpjsJhtEmp,
    bpjsJpEmployeeMonthly: simBpjsJpEmp,
    ptkpStatus: simPtkp,
    monthsWorked: simMonthsWorked,
  });

  const activeSimPph21 =
    simMode === 'december_a1'
      ? simDecReconciliation.decemberPph21Payable
      : simPph21MonthlyTer;

  const totalPotonganSim = activeSimPph21 + simBpjsKesEmp + bpjsJhtEmp + simBpjsJpEmp;
  const takeHomePaySim = Math.max(0, simSalary - totalPotonganSim);

  // Real aggregate liability from company payroll
  const totalPPh21Company = payrolls.reduce((acc, curr) => acc + curr.pph21TER, 0);
  const totalBpjsKesComp = payrolls.reduce((acc, curr) => acc + curr.bpjsKesehatanEmployer, 0);
  const totalBpjsKesEmp = payrolls.reduce((acc, curr) => acc + curr.bpjsKesehatanEmployee, 0);
  const totalBpjsTkComp = payrolls.reduce(
    (acc, curr) =>
      acc +
      curr.bpjsJhtEmployer +
      curr.bpjsJpEmployer +
      curr.bpjsJkkEmployer +
      curr.bpjsJkmEmployer,
    0
  );
  const totalBpjsTkEmp = payrolls.reduce(
    (acc, curr) => acc + curr.bpjsJhtEmployee + curr.bpjsJpEmployee,
    0
  );

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Percent className="w-6 h-6 text-purple-600" />
            Pajak PPh 21 (TER + Premi BPJS &amp; Rekonsiliasi Desember A1)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Perhitungan DPP PPh 21 TER termasuk premi BPJS pemberi kerja (Kesehatan 4%, JKK 0,24%, JKM 0,30%) serta rekonsiliasi Pasal 17 bulan Desember (Form 1721-A1).
          </p>
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-50 text-purple-700 text-xs font-semibold border border-purple-200">
          <FileCheck2 className="w-4 h-4 text-purple-600" />
          <span>PP 58/2023 • PMK 168/2023 • Coretax DJP</span>
        </div>
      </div>

      {/* Aggregate Liability Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500 block font-medium">
            Total Setoran PPh 21 Masa (Karyawan)
          </span>
          <h3 className="text-2xl font-bold text-purple-700 mt-2">
            {formatRupiah(totalPPh21Company)}
          </h3>
          <p className="text-[11px] text-slate-500 mt-1">
            Dipotong dari gaji {payrolls.length} karyawan (DPP Bruto + Premi BPJS Perusahaan)
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500 block font-medium">
            Total Iuran BPJS Kesehatan (5%)
          </span>
          <h3 className="text-2xl font-bold text-teal-700 mt-2">
            {formatRupiah(totalBpjsKesComp + totalBpjsKesEmp)}
          </h3>
          <p className="text-[11px] text-slate-500 mt-1">
            Tas Grosir Import (4%): {formatRupiah(totalBpjsKesComp)} | Karyawan (1%): {formatRupiah(totalBpjsKesEmp)}
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500 block font-medium">
            Total BPJS Ketenagakerjaan
          </span>
          <h3 className="text-2xl font-bold text-blue-700 mt-2">
            {formatRupiah(totalBpjsTkComp + totalBpjsTkEmp)}
          </h3>
          <p className="text-[11px] text-slate-500 mt-1">
            JHT, JP, JKK, &amp; JKM (Perusahaan: {formatRupiah(totalBpjsTkComp)})
          </p>
        </div>
      </div>

      {/* Interactive Simulator Card */}
      <div className="bg-gradient-to-br from-slate-900 to-purple-950 rounded-2xl p-5 sm:p-6 text-white shadow-xl border border-slate-800 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-purple-400" />
            <h3 className="text-base font-bold">
              Simulasi PPh 21 TER (Jan–Nov) &amp; Rekonsiliasi Tahunan Desember (Form 1721-A1)
            </h3>
          </div>

          <div className="inline-flex bg-slate-950/80 p-1 rounded-xl border border-slate-800 text-xs font-bold">
            <button
              type="button"
              onClick={() => setSimMode('monthly_ter')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                simMode === 'monthly_ter'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Masa Jan–Nov (Metode TER)
            </button>
            <button
              type="button"
              onClick={() => setSimMode('december_a1')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                simMode === 'december_a1'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <CalendarCheck2 className="w-3.5 h-3.5" />
              Masa Desember (Rekonsiliasi Pasal 17)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Controls */}
          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-300 mb-1.5 font-medium">
                Gaji Pokok + Tunjangan Sebulan (IDR)
              </label>
              <input
                type="number"
                step={500000}
                value={simSalary}
                onChange={(e) => setSimSalary(Number(e.target.value))}
                className="w-full p-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white font-bold text-sm focus:outline-hidden focus:border-purple-400"
              />
            </div>

            <div>
              <label className="block text-slate-300 mb-1.5 font-medium">
                Status PTKP Karyawan
              </label>
              <select
                value={simPtkp}
                onChange={(e) => setSimPtkp(e.target.value as PTKPStatus)}
                className="w-full p-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white font-medium focus:outline-hidden focus:border-purple-400"
              >
                <option value="TK/0">TK/0 - Tidak Kawin, 0 Tanggungan (Kat. A)</option>
                <option value="TK/1">TK/1 - Tidak Kawin, 1 Tanggungan (Kat. A)</option>
                <option value="TK/2">TK/2 - Tidak Kawin, 2 Tanggungan (Kat. B)</option>
                <option value="TK/3">TK/3 - Tidak Kawin, 3 Tanggungan (Kat. B)</option>
                <option value="K/0">K/0 - Kawin, 0 Tanggungan (Kat. A)</option>
                <option value="K/1">K/1 - Kawin, 1 Tanggungan (Kat. B)</option>
                <option value="K/2">K/2 - Kawin, 2 Tanggungan (Kat. B)</option>
                <option value="K/3">K/3 - Kawin, 3 Tanggungan (Kat. C)</option>
              </select>
            </div>

            {simMode === 'december_a1' && (
              <div>
                <label className="block text-slate-300 mb-1.5 font-medium">
                  Jumlah Bulan Bekerja dalam Tahun Pajak (1–12 Bulan)
                </label>
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={simMonthsWorked}
                  onChange={(e) =>
                    setSimMonthsWorked(Math.min(12, Math.max(1, Number(e.target.value) || 12)))
                  }
                  className="w-full p-2 bg-slate-800/80 border border-slate-700 rounded-xl text-white font-bold text-xs"
                />
              </div>
            )}

            <div className="p-3 bg-purple-900/40 rounded-xl border border-purple-700/50 text-[11px] space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-300">Gaji Bruto Tunai:</span>
                <span className="font-semibold text-white">{formatRupiah(simSalary)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">+ Premi BPJS Kes (4%) + JKK + JKM:</span>
                <span className="font-semibold text-emerald-300">
                  +{formatRupiah(simEmployerBpjsTaxable)}
                </span>
              </div>
              <div className="flex justify-between border-t border-purple-700/50 pt-1">
                <span className="text-slate-200 font-bold">DPP Bruto Pajak (TER):</span>
                <span className="font-extrabold text-amber-300">
                  {formatRupiah(simTaxableGrossMonthly)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">Kategori &amp; Tarif TER:</span>
                <span className="font-bold text-purple-300">
                  Kat. {simCategory} ({(simRate * 100).toFixed(2)}%)
                </span>
              </div>
            </div>
          </div>

          {/* Results: Potongan Gaji Karyawan */}
          <div className="bg-slate-800/70 p-4 rounded-xl border border-slate-700/80 text-xs space-y-2.5">
            <h4 className="font-bold text-purple-300 border-b border-slate-700 pb-1.5 flex justify-between">
              <span>
                {simMode === 'december_a1'
                  ? 'Rekonsiliasi PPh 21 Desember (Form A1)'
                  : 'Potongan Beban Karyawan (Bulanan)'}
              </span>
              <span>Jumlah</span>
            </h4>

            {simMode === 'december_a1' ? (
              <div className="space-y-1.5 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-300">Bruto Setahun ({simMonthsWorked} bln):</span>
                  <span className="font-semibold text-white">
                    {formatRupiah(simDecReconciliation.annualGrossIncome)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-300">- Biaya Jabatan (5%, maks 6jt):</span>
                  <span className="text-emerald-300">
                    -{formatRupiah(simDecReconciliation.biayaJabatanAnnual)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-300">- Iuran JHT (2%) + JP (1%) Setahun:</span>
                  <span className="text-emerald-300">
                    -{formatRupiah(simDecReconciliation.bpjsEmployeeAnnualDeduction)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-slate-700 pt-1">
                  <span className="text-slate-200 font-semibold">Penghasilan Neto Setahun:</span>
                  <span className="font-bold text-white">
                    {formatRupiah(simDecReconciliation.netIncomeAnnual)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-300">- PTKP ({simPtkp}):</span>
                  <span className="text-slate-300">
                    -{formatRupiah(simDecReconciliation.ptkpAnnual)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-300">PKP Setahun:</span>
                  <span className="font-bold text-amber-300">
                    {formatRupiah(simDecReconciliation.pkpAnnual)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-slate-700 pt-1">
                  <span className="text-slate-200 font-bold">PPh 21 Setahun (Pasal 17):</span>
                  <span className="font-bold text-rose-300">
                    {formatRupiah(simDecReconciliation.annualPph21Pasal17)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-300">- Dipotong TER Jan–Nov:</span>
                  <span className="text-emerald-300">
                    -{formatRupiah(simDecReconciliation.terAlreadyPaidJanToNov)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-slate-700 pt-1.5 font-extrabold text-white">
                  <span>PPh 21 Masa Desember:</span>
                  <span className="text-rose-400">
                    {formatRupiah(simDecReconciliation.decemberPph21Payable)}
                  </span>
                </div>
              </div>
            ) : (
              <>
                <div className="flex justify-between">
                  <span className="text-slate-300">
                    PPh 21 TER ({(simRate * 100).toFixed(2)}% x DPP Bruto)
                  </span>
                  <span className="font-semibold text-rose-400">
                    {formatRupiah(simPph21MonthlyTer)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-300">BPJS Kesehatan (1%)</span>
                  <span className="font-semibold text-rose-400">{formatRupiah(simBpjsKesEmp)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-300">BPJS TK - JHT (2%)</span>
                  <span className="font-semibold text-rose-400">{formatRupiah(bpjsJhtEmp)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-300">BPJS TK - JP (1%)</span>
                  <span className="font-semibold text-rose-400">{formatRupiah(simBpjsJpEmp)}</span>
                </div>
                <div className="border-t border-slate-700 pt-2 flex justify-between font-bold text-white">
                  <span>Total Potongan</span>
                  <span className="text-rose-400">{formatRupiah(totalPotonganSim)}</span>
                </div>
              </>
            )}

            <div className="bg-emerald-950/70 p-2.5 rounded-lg border border-emerald-600/50 mt-2">
              <span className="text-[10px] text-emerald-300 block uppercase">
                Estimasi Take Home Pay ({simMode === 'december_a1' ? 'Desember' : 'Bulanan'})
              </span>
              <span className="text-lg font-black text-emerald-400">
                {formatRupiah(takeHomePaySim)}
              </span>
            </div>
          </div>

          {/* Results: Tanggungan Perusahaan Tas Grosir Import */}
          <div className="bg-slate-800/70 p-4 rounded-xl border border-slate-700/80 text-xs space-y-2.5">
            <h4 className="font-bold text-teal-300 border-b border-slate-700 pb-1.5 flex justify-between">
              <span>Ditanggung Tas Grosir Import (Benefit)</span>
              <span>Jumlah</span>
            </h4>
            <div className="flex justify-between">
              <span className="text-slate-300">BPJS Kesehatan (4% - Objek Pajak)</span>
              <span className="font-semibold text-teal-300">{formatRupiah(simBpjsKesComp)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-300">BPJS TK - JKK (0.24% - Objek Pajak)</span>
              <span className="font-semibold text-teal-300">{formatRupiah(simBpjsJkkComp)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-300">BPJS TK - JKM (0.30% - Objek Pajak)</span>
              <span className="font-semibold text-teal-300">{formatRupiah(simBpjsJkmComp)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-300">BPJS TK - JHT (3.7% - Non Objek)</span>
              <span className="font-semibold text-teal-300">{formatRupiah(bpjsJhtComp)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-300">BPJS TK - JP (2% - Non Objek)</span>
              <span className="font-semibold text-teal-300">{formatRupiah(simBpjsJpComp)}</span>
            </div>
            <div className="border-t border-slate-700 pt-2 flex justify-between font-bold text-white">
              <span>Total Iuran Perusahaan</span>
              <span className="text-teal-300">
                {formatRupiah(
                  simBpjsKesComp + bpjsJhtComp + simBpjsJpComp + simBpjsJkkComp + simBpjsJkmComp
                )}
              </span>
            </div>
            <div className="p-2 rounded-lg bg-slate-900/70 border border-slate-700 text-[10px] text-slate-300 flex items-start gap-1.5">
              <Info className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <span>
                Sesuai PMK 168/2023, premi JKK (0,24%), JKM (0,30%), dan BPJS Kesehatan (4%) yang dibayar pemberi kerja ditambahkan ke penghasilan bruto sebagai dasar pengenaan PPh 21 TER.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Table for all employees */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-sm text-slate-800">
              Tabel Rekap Pajak PPh 21 (TER + Premi BPJS), Rekonsiliasi Desember A1 &amp; BPJS Karyawan
            </h3>
            <p className="text-[11px] text-slate-500">
              Menampilkan DPP Bruto Pajak, PPh 21 Masa Berjalan, dan Estimasi Rekonsiliasi Pasal 17 Desember (Form 1721-A1)
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-500">{payrolls.length} Karyawan</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Karyawan</th>
                <th className="py-3 px-4">NIK KTP &amp; NPWP</th>
                <th className="py-3 px-4">PTKP &amp; Kat</th>
                <th className="py-3 px-4">Gaji Bruto + Premi BPJS (DPP)</th>
                <th className="py-3 px-4">PPh 21 TER Bulanan</th>
                <th className="py-3 px-4">Rekonsiliasi Des (Form A1)</th>
                <th className="py-3 px-4">BPJS Karyawan (4%)</th>
                <th className="py-3 px-4">Iuran Tas Grosir Import</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payrolls.map((p) => {
                const emp = employees.find((e) => e.id === p.employeeId);
                const ptkp = emp?.ptkpStatus || 'TK/0';
                const category = getTERCategory(ptkp);
                const npwpInfo = getNpwpStatusInfo(emp?.npwp, emp?.ktpNumber);
                const empBpjsTaxable =
                  p.employerBpjsTaxableAllowance ??
                  p.bpjsKesehatanEmployer + p.bpjsJkkEmployer + p.bpjsJkmEmployer;
                const dppTaxableGross = p.taxableGrossSalary ?? p.totalGrossSalary + empBpjsTaxable;
                const decSummary =
                  p.annualPph21Summary ||
                  calculateDecemberPPh21Reconciliation({
                    monthlyTaxableGross: dppTaxableGross,
                    bpjsJhtEmployeeMonthly: p.bpjsJhtEmployee,
                    bpjsJpEmployeeMonthly: p.bpjsJpEmployee,
                    ptkpStatus: ptkp,
                    monthsWorked: 12,
                  });

                const totalCompLiability =
                  p.bpjsKesehatanEmployer +
                  p.bpjsJhtEmployer +
                  p.bpjsJpEmployer +
                  p.bpjsJkkEmployer +
                  p.bpjsJkmEmployer;

                return (
                  <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={emp?.avatarUrl}
                          alt={emp?.fullName}
                          className="w-7 h-7 rounded-full object-cover shrink-0"
                        />
                        <div>
                          <span className="font-semibold text-slate-900 block">
                            {emp?.fullName}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">{emp?.nik}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono font-bold text-slate-800 block text-[11px]">
                        NPWP: {emp?.npwp || '-'}
                      </span>
                      <span className="font-mono text-[10px] text-indigo-700 block">
                        NIK: {emp?.ktpNumber || 'Belum dilengkapi'}
                      </span>
                      <span
                        className={`inline-block mt-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold ${
                          npwpInfo.isValid
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {npwpInfo.label}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-purple-700">{ptkp}</span>
                      <span className="block text-[10px] text-slate-400">Kat. {category}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-900 block">
                        {formatRupiah(dppTaxableGross)}
                      </span>
                      <span className="text-[10px] text-slate-500 block">
                        Gaji {formatRupiah(p.totalGrossSalary)} + BPJS {formatRupiah(empBpjsTaxable)}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-rose-600">
                      {formatRupiah(p.pph21TER)}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-indigo-700 block">
                        {formatRupiah(decSummary.decemberPph21Payable)}
                      </span>
                      <span className="text-[10px] text-slate-500 block">
                        Psl 17: {formatRupiah(decSummary.annualPph21Pasal17)}/thn
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      {formatRupiah(
                        p.bpjsKesehatanEmployee + p.bpjsJhtEmployee + p.bpjsJpEmployee
                      )}
                    </td>
                    <td className="py-3 px-4 font-semibold text-teal-700">
                      {formatRupiah(totalCompLiability)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
