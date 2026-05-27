"use client";

import ShiftDetailModal from "@/components/pos/ShiftDetailModal";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function AdminDashboard() {
  const [selectedShiftId, setSelectedShiftId] = useState("");
const [selectedCashierName, setSelectedCashierName] = useState("");
const [isDetailOpen, setIsDetailOpen] = useState(false);
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // State untuk menyimpan daftar shift hari ini
  const [shiftsToday, setShiftsToday] = useState<any[]>([]);

  useEffect(() => {
    const checkAdminAndFetchData = async () => {
      // 1. Cek Autentikasi
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.replace("/login");

      // 2. Cek Otorisasi Role Admin
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .single();

      if (!roleData || roleData.role !== 'admin') {
        alert("Akses Ditolak! Khusus Owner.");
        return router.replace("/");
      }
      setIsAuthorized(true);

      // 3. Tarik Data Shift Hari Ini (Gunakan Timezone Jakarta)
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });

      try {
        const { data: shiftData, error } = await supabase.rpc('get_daily_shift_reports', {
          p_date: today
        });

        if (error) throw error;
        setShiftsToday(shiftData || []);
      } catch (error: any) {
        console.error("Gagal menarik data shift:", error.message);
      } finally {
        setIsLoading(false);
      }
    };

    checkAdminAndFetchData();
  }, [router]);

  if (!isAuthorized || isLoading) {
    return <div className="flex h-screen items-center justify-center font-bold">Memuat Ruang Kontrol...</div>;
  }

  // =====================================================================
  // LOGIKA KALKULASI RINGKASAN HARI INI (DI SINI TEMPAT YANG BENAR)
  // =====================================================================
  const closedShifts = shiftsToday.filter(shift => shift.status === 'closed');
  
  // Total Laba Bersih Sistem (Pendapatan - Pengeluaran, tanpa modal awal)
  const totalSystemProfit = closedShifts.reduce((sum, shift) => sum + ((shift.system_cash || 0) - (shift.starting_cash || 0)), 0);
  
  // Total Uang Fisik yang Benar-Benar Disetor Kasir (tanpa modal awal)
  const totalActualProfit = closedShifts.reduce((sum, shift) => sum + ((shift.ending_cash || 0) - (shift.starting_cash || 0)), 0);
  
  // Total Kebocoran / Selisih
  const totalVariance = closedShifts.reduce((sum, shift) => sum + ((shift.ending_cash || 0) - (shift.system_cash || 0)), 0);


  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-7xl mx-auto">
        
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Ruang Kontrol Owner</h1>
            <p className="text-gray-500">Laporan Rekonsiliasi Kasir Hari Ini</p>
          </div>
          <div className="flex gap-4">
            <button 
              onClick={() => router.push("/admin/menu")}
              className="px-4 py-2 bg-blue-600 text-white font-bold rounded hover:bg-blue-700 transition"
            >
              KELOLA MENU
            </button>
            <button 
              onClick={async () => {
                await supabase.auth.signOut();
                router.replace("/login");
              }}
              className="px-4 py-2 bg-gray-800 text-white font-bold rounded hover:bg-black transition"
            >
              KELUAR SISTEM
            </button>
          </div>
        </div>

        {/* KARTU RINGKASAN TOTAL */}
        <div className="grid grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-blue-500">
            <p className="text-gray-500 text-sm font-medium mb-1">Laba Bersih (Sistem)</p>
            <h2 className="text-3xl font-bold text-blue-900">
              Rp {totalSystemProfit.toLocaleString('id-ID')}
            </h2>
            <p className="text-xs text-gray-400 mt-2">Dari {closedShifts.length} shift yang ditutup</p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-green-500">
            <p className="text-gray-500 text-sm font-medium mb-1">Uang Fisik Disetor (Real)</p>
            <h2 className="text-3xl font-bold text-green-700">
              Rp {totalActualProfit.toLocaleString('id-ID')}
            </h2>
            <p className="text-xs text-gray-400 mt-2">Laba murni fisik di luar modal laci</p>
          </div>

          <div className={`bg-white p-6 rounded-lg shadow-sm border-l-4 ${totalVariance < 0 ? 'border-red-600' : 'border-gray-300'}`}>
            <p className="text-gray-500 text-sm font-medium mb-1">Total Varian (Selisih)</p>
            <h2 className={`text-3xl font-bold ${totalVariance < 0 ? 'text-red-600' : 'text-gray-800'}`}>
              {totalVariance > 0 ? '+' : ''}Rp {totalVariance.toLocaleString('id-ID')}
            </h2>
            <p className="text-xs text-gray-400 mt-2">
              {totalVariance < 0 ? 'AWAS! Ada uang hilang/minus.' : 'Status keuangan aman.'}
            </p>
          </div>
        </div>

        {/* Tabel Analitik Shift */}
        <div className="bg-white rounded-lg shadow overflow-hidden border border-gray-200">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="p-4 text-sm font-bold text-gray-600">Kasir / Waktu</th>
                <th className="p-4 text-sm font-bold text-gray-600 text-right">Modal Awal</th>
                <th className="p-4 text-sm font-bold text-gray-600 text-right">Hitungan Sistem</th>
                <th className="p-4 text-sm font-bold text-gray-600 text-right">Uang Fisik (Disetor)</th>
                <th className="p-4 text-sm font-bold text-gray-600 text-right">Selisih (Variance)</th>
                <th className="p-4 text-sm font-bold text-gray-600 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {shiftsToday.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500">
                    Belum ada data shift hari ini.
                  </td>
                </tr>
              ) : (
                shiftsToday.map((shift) => {
                  const variance = (shift.ending_cash || 0) - (shift.system_cash || 0);
                  const isClosed = shift.status === 'closed';

                  return (
                    <tr 
                      key={shift.id} 
                      className="hover:bg-blue-50 transition cursor-pointer"
                      title="Klik untuk melihat rincian penjualan & pengeluaran"
                      onClick={() => {
                        setSelectedShiftId(shift.id);
                        setSelectedCashierName(shift.cashier_email || "Kasir");
                        setIsDetailOpen(true);
                      }}
                    >
                      <td className="p-4">
                        <p className="font-bold text-gray-800 truncate max-w-[200px]" title={shift.cashier_email}>
                          {shift.cashier_email?.split('@')[0]}
                        </p>
                        <div className="text-xs text-gray-500 mt-1 space-y-1">
                          <p>
                            <span className="font-semibold">Mulai:</span> {new Date(shift.start_time).toLocaleString('id-ID', { 
                              weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', 
                              hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' 
                            })}
                          </p>
                          {isClosed && (
                            <p>
                              <span className="font-semibold">Tutup:</span> {new Date(shift.end_time).toLocaleString('id-ID', { 
                                weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', 
                                hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' 
                              })}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-right text-gray-600">
                        Rp {(shift.starting_cash || 0).toLocaleString('id-ID')}
                      </td>
                      <td className="p-4 text-right text-gray-600">
                        {isClosed ? `Rp ${(shift.system_cash || 0).toLocaleString('id-ID')}` : '-'}
                      </td>
                      <td className="p-4 text-right font-semibold text-gray-800">
                        {isClosed ? `Rp ${(shift.ending_cash || 0).toLocaleString('id-ID')}` : '-'}
                      </td>
                      <td className="p-4 text-right">
                        {!isClosed ? (
                          <span className="text-gray-400">-</span>
                        ) : variance < 0 ? (
                          <span className="text-red-600 font-bold bg-red-50 px-2 py-1 rounded">
                            Rp {variance.toLocaleString('id-ID')}
                          </span>
                        ) : variance > 0 ? (
                          <span className="text-green-600 font-bold bg-green-50 px-2 py-1 rounded">
                            + Rp {variance.toLocaleString('id-ID')}
                          </span>
                        ) : (
                          <span className="text-gray-500 font-bold">BALANCE (0)</span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${isClosed ? 'bg-gray-200 text-gray-700' : 'bg-blue-100 text-blue-700 animate-pulse'}`}>
                          {isClosed ? 'DITUTUP' : 'AKTIF'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
<ShiftDetailModal
          isOpen={isDetailOpen}
          onClose={() => setIsDetailOpen(false)}
          shiftId={selectedShiftId}
          cashierName={selectedCashierName}
        />
      </div>
    </div>
  );
}