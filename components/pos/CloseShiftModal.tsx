"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

interface CloseShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeShift: any;
}

export default function CloseShiftModal({ isOpen, onClose, activeShift }: CloseShiftModalProps) {
  const router = useRouter();
  const [endingCash, setEndingCash] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !activeShift) return null;

  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (Number(endingCash) < 0) return alert("Uang fisik tidak boleh minus!");
    
    const isConfirm = window.confirm("Yakin ingin menutup shift? Anda tidak akan bisa membuka meja kasir lagi tanpa memasukkan modal awal baru.");
    if (!isConfirm) return;

    setIsSubmitting(true);

    try {
      // 1. Tarik total PEMASUKAN TUNAI (CASH) pada shift ini
      const { data: incomeData, error: incomeError } = await supabase
        .from('transactions')
        .select('total_amount')
        .eq('shift_id', activeShift.id)
        .eq('payment_method', 'CASH'); // Hanya hitung tunai, QRIS tidak masuk laci

      if (incomeError) throw incomeError;
      const totalCashIncome = incomeData.reduce((sum, trx) => sum + trx.total_amount, 0);

      // 2. Tarik total PENGELUARAN pada shift ini
      const { data: expenseData, error: expenseError } = await supabase
        .from('expenses')
        .select('amount')
        .eq('shift_id', activeShift.id);

      if (expenseError) throw expenseError;
      const totalExpense = expenseData.reduce((sum, exp) => sum + exp.amount, 0);

      // 3. Kalkulasi Uang Menurut Sistem
      // Rumus: Modal Awal + Pemasukan Tunai - Pengeluaran
      const systemCash = activeShift.starting_cash + totalCashIncome - totalExpense;

      // 4. Update tabel shifts (Tutup shift)
      const { error: updateError } = await supabase
        .from('shifts')
        .update({
          ending_cash: Number(endingCash), // Uang riil yang dihitung kasir
          system_cash: systemCash,         // Uang seharusnya menurut komputer
          end_time: new Date().toISOString(),
          status: 'closed'
        })
        .eq('id', activeShift.id);

      if (updateError) throw updateError;

      // 5. Sukses! Logout user
      alert("Shift berhasil ditutup. Sistem akan mengeluarkan Anda.");
      await supabase.auth.signOut();
      router.replace("/login");

    } catch (error: any) {
      console.error("Gagal tutup shift:", error.message);
      alert("Terjadi kesalahan sistem: " + error.message);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 w-full max-w-md shadow-2xl">
        <h2 className="text-2xl font-bold mb-2 text-gray-800 text-center">Tutup Shift Kasir</h2>
        <p className="text-gray-500 text-sm text-center mb-6">Hitung seluruh uang fisik di laci Anda sekarang.</p>
        
        <form onSubmit={handleCloseShift} className="flex flex-col gap-4">
          <div className="bg-blue-50 p-4 rounded border border-blue-100 mb-2">
            <p className="text-sm text-blue-800 font-semibold mb-1">Modal Awal Anda:</p>
            <p className="text-xl font-bold text-blue-900">Rp {activeShift.starting_cash.toLocaleString('id-ID')}</p>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Total Uang Fisik Laci (Rp)</label>
            <input
              type="number"
              required
              min="0"
              className="w-full p-3 border border-gray-300 rounded text-lg font-bold"
              placeholder="Masukkan total uang fisik..."
              value={endingCash}
              onChange={(e) => setEndingCash(e.target.value)}
            />
          </div>

          <div className="flex gap-2 mt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 bg-gray-200 text-gray-800 font-bold py-3 rounded hover:bg-gray-300"
            >
              BATAL
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-red-600 text-white font-bold py-3 rounded hover:bg-red-700 disabled:bg-gray-400"
            >
              {isSubmitting ? "Memproses..." : "TUTUP SHIFT & LOGOUT"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}