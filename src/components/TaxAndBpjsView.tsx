import React, { useState } from 'react';
import {
  Percent,
  Calculator,
  ShieldCheck,
  Building,
  HelpCircle,
  FileCheck2,
  TrendingDown,
  Info,
} from 'lucide-react';
import { Employee, PayrollRecord, PTKPStatus } from '../types';
import {
  formatRupiah,
  getTERCategory,
  getTERRate,
  getNpwpStatusInfo,
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

  const simCategory = getTERCategory(simPtkp);
  const simRate = getTERRate(simCategory, simSalary);
  const simPph21 = Math.round(simSalary * simRate);

  // BPJS Simulation
  const bpjsKesBase = Math.min(simSalary, 12000000);
  const simBpjsKesEmp = Math.round(bpjsKesBase * 0.01);
  const simBpjsKesComp = Math.round(bpjsKesBase * 0.04);

  const bpjsJhtEmp = Math.round(simSalary * 0.02);
  const bpjsJhtComp = Math.round(simSalary * 0.037);

  const bpjsJpBase = Math.min(simSalary, 10600000);
  const simBpjsJpEmp = Math.round(bpjsJpBase * 0.01);
  const simBpjsJpComp = Math.round(bpjsJpBase * 0.02);

  const simBpjsJkkComp = Math.round(simSalary * 0.0024);
  const simBpjsJkmComp = Math.round(simSalary * 0.003);

  const totalPotonganSim = simPph21 + simBpjsKesEmp + bpjsJhtEmp + simBpjsJpEmp;
  const takeHomePaySim = simSalary - totalPotonganSim;

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
            Pajak PPh 21 (Ketentuan Terbaru 2026) &amp; BPJS
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Kepatuhan perpajakan skema Tarif Efektif Rata-Rata (TER) Coretax DJP 2026, pemadanan NIK-NPWP 16 digit, dan formulasi iuran jaminan sosial.
          </p>
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-50 text-purple-700 text-xs font-semibold border border-purple-200">
          <FileCheck2 className="w-4 h-4 text-purple-600" />
          <span>Sesuai Sistem Coretax DJP &amp; Ketentuan 2026</span>
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
            Dipotong dari gaji {payrolls.length} karyawan via skema TER 2026
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
            PT Tas Grosir Import (4%): {formatRupiah(totalBpjsKesComp)} | Karyawan (1%): {formatRupiah(totalBpjsKesEmp)}
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
      <div className="bg-gradient-to-br from-slate-900 to-purple-950 rounded-2xl p-6 text-white shadow-xl border border-slate-800">
        <div className="flex items-center gap-2 mb-4">
          <Calculator className="w-5 h-5 text-purple-400" />
          <h3 className="text-base font-bold">Kalkulator Interaktif PPh 21 TER &amp; BPJS Ketentuan 2026</h3>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Controls */}
          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-300 mb-1.5 font-medium">
                Simulasi Penghasilan Bruto Sebulan (IDR)
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
                <option value="TK/0">TK/0 - Tidak Kawin, 0 Tanggungan (Kategori A)</option>
                <option value="TK/1">TK/1 - Tidak Kawin, 1 Tanggungan (Kategori A)</option>
                <option value="TK/2">TK/2 - Tidak Kawin, 2 Tanggungan (Kategori B)</option>
                <option value="TK/3">TK/3 - Tidak Kawin, 3 Tanggungan (Kategori B)</option>
                <option value="K/0">K/0 - Kawin, 0 Tanggungan (Kategori A)</option>
                <option value="K/1">K/1 - Kawin, 1 Tanggungan (Kategori B)</option>
                <option value="K/2">K/2 - Kawin, 2 Tanggungan (Kategori B)</option>
                <option value="K/3">K/3 - Kawin, 3 Tanggungan (Kategori C)</option>
              </select>
            </div>

            <div className="p-3 bg-purple-900/40 rounded-xl border border-purple-700/50 text-[11px] space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-300">Kategori TER:</span>
                <span className="font-bold text-purple-300">Kategori {simCategory}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">Tarif Efektif Rata-Rata:</span>
                <span className="font-bold text-purple-300">{(simRate * 100).toFixed(2)}%</span>
              </div>
            </div>
          </div>

          {/* Results: Potongan Gaji Karyawan */}
          <div className="bg-slate-800/70 p-4 rounded-xl border border-slate-700/80 text-xs space-y-2.5">
            <h4 className="font-bold text-purple-300 border-b border-slate-700 pb-1.5 flex justify-between">
              <span>Potongan Beban Karyawan</span>
              <span>Jumlah</span>
            </h4>
            <div className="flex justify-between">
              <span className="text-slate-300">PPh 21 TER ({(simRate * 100).toFixed(2)}%)</span>
              <span className="font-semibold text-rose-400">{formatRupiah(simPph21)}</span>
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
            <div className="bg-emerald-950/70 p-2.5 rounded-lg border border-emerald-600/50 mt-2">
              <span className="text-[10px] text-emerald-300 block uppercase">Estimasi Take Home Pay</span>
              <span className="text-lg font-black text-emerald-400">{formatRupiah(takeHomePaySim)}</span>
            </div>
          </div>

          {/* Results: Tanggungan Perusahaan PT Tas Grosir Import */}
          <div className="bg-slate-800/70 p-4 rounded-xl border border-slate-700/80 text-xs space-y-2.5">
            <h4 className="font-bold text-teal-300 border-b border-slate-700 pb-1.5 flex justify-between">
              <span>Ditanggung PT Tas Grosir Import (Benefit)</span>
              <span>Jumlah</span>
            </h4>
            <div className="flex justify-between">
              <span className="text-slate-300">BPJS Kesehatan (4%)</span>
              <span className="font-semibold text-teal-300">{formatRupiah(simBpjsKesComp)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-300">BPJS TK - JHT (3.7%)</span>
              <span className="font-semibold text-teal-300">{formatRupiah(bpjsJhtComp)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-300">BPJS TK - JP (2%)</span>
              <span className="font-semibold text-teal-300">{formatRupiah(simBpjsJpComp)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-300">BPJS TK - JKK (0.24%)</span>
              <span className="font-semibold text-teal-300">{formatRupiah(simBpjsJkkComp)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-300">BPJS TK - JKM (0.3%)</span>
              <span className="font-semibold text-teal-300">{formatRupiah(simBpjsJkmComp)}</span>
            </div>
            <div className="border-t border-slate-700 pt-2 flex justify-between font-bold text-white">
              <span>Total Iuran Perusahaan</span>
              <span className="text-teal-300">
                {formatRupiah(simBpjsKesComp + bpjsJhtComp + simBpjsJpComp + simBpjsJkkComp + simBpjsJkmComp)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Table for all employees */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-800">
            Tabel Rekap Pajak PPh 21, NIK-NPWP &amp; BPJS Karyawan Bulan Ini
          </h3>
          <span className="text-xs text-slate-500">{payrolls.length} Karyawan</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Karyawan</th>
                <th className="py-3 px-4">NIK KTP (16 Digit) &amp; NPWP</th>
                <th className="py-3 px-4">PTKP &amp; Kategori</th>
                <th className="py-3 px-4">Penghasilan Bruto</th>
                <th className="py-3 px-4">PPh 21 TER</th>
                <th className="py-3 px-4">BPJS Kesehatan (1%)</th>
                <th className="py-3 px-4">BPJS TK (JHT+JP 3%)</th>
                <th className="py-3 px-4">Total Iuran PT Tas Grosir Import</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payrolls.map((p) => {
                const emp = employees.find((e) => e.id === p.employeeId);
                const category = emp ? getTERCategory(emp.ptkpStatus) : 'A';
                const npwpInfo = getNpwpStatusInfo(emp?.npwp, emp?.ktpNumber);
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
                          <span className="font-semibold text-slate-900 block">{emp?.fullName}</span>
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
                      <span className="font-bold text-purple-700">{emp?.ptkpStatus}</span>
                      <span className="block text-[10px] text-slate-400">Kat. {category}</span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {formatRupiah(p.totalGrossSalary)}
                    </td>
                    <td className="py-3 px-4 font-bold text-rose-600">
                      {formatRupiah(p.pph21TER)}
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      {formatRupiah(p.bpjsKesehatanEmployee)}
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      {formatRupiah(p.bpjsJhtEmployee + p.bpjsJpEmployee)}
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
