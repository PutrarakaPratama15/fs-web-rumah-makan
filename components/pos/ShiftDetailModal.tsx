"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

interface ShiftDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  shiftId: string;
  cashierName: string;
}

export default function ShiftDetailModal({ isOpen, onClose, shiftId, cashierName }: ShiftDetailModalProps) {
  const [cashItems, setCashItems] = useState<any[]>([]);
  const [qrisItems, setQrisItems] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  
  // State baru untuk menampung data ringkasan shift
  const [shiftSummary, setShiftSummary] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || !shiftId) return;

    const fetchShiftDetails = async () => {
      setIsLoading(true);
      try {
        // 1. Tarik Data Utama Shift (Untuk Modal Awal & Setoran Fisik)
        const { data: shiftData, error: shiftError } = await supabase
          .from("shifts")
          .select("starting_cash, ending_cash, system_cash, status")
          .eq("id", shiftId)
          .single();
        if (shiftError) throw shiftError;
        setShiftSummary(shiftData);

        // 2. Tarik Data Penjualan (Join)
        const { data: itemsData, error: itemsError } = await supabase
          .from("transaction_items")
          .select(`
            product_name, qty, price, subtotal, 
            transactions!inner(shift_id, payment_method)
          `)
          .eq("transactions.shift_id", shiftId);
        if (itemsError) throw itemsError;

        const aggregated: Record<string, Record<string, any>> = { CASH: {}, QRIS: {} };

        itemsData?.forEach((item: any) => {
          const method = item.transactions?.payment_method || "CASH";
          const name = item.product_name;

          if (!aggregated[method]) aggregated[method] = {};

          if (aggregated[method][name]) {
            aggregated[method][name].qty += item.qty;
            aggregated[method][name].subtotal += item.subtotal;
          } else {
            aggregated[method][name] = { qty: item.qty, price: item.price, subtotal: item.subtotal };
          }
        });

        const formatItems = (method: string) => 
          Object.keys(aggregated[method] || {}).map((name) => ({
            product_name: name,
            ...aggregated[method][name],
          }));

        setCashItems(formatItems("CASH"));
        setQrisItems(formatItems("QRIS"));

        // 3. Tarik Data Pengeluaran
        const { data: expensesData, error: expensesError } = await supabase
          .from("expenses")
          .select("category, amount, description, created_at")
          .eq("shift_id", shiftId)
          .order("created_at", { ascending: true });
        if (expensesError) throw expensesError;
        setExpenses(expensesData || []);

      } catch (error: any) {
        console.error("Gagal memuat detail shift:", error.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchShiftDetails();
  }, [isOpen, shiftId]);

  if (!isOpen) return null;

  // Hitung total nilai per kategori
  const totalCash = cashItems.reduce((sum, item) => sum + item.subtotal, 0);
  const totalQris = qrisItems.reduce((sum, item) => sum + item.subtotal, 0);
  const totalExpense = expenses.reduce((sum, exp) => sum + exp.amount, 0);

  const renderProductList = (items: any[], title: string, colorClass: string, badgeClass: string, total: number) => (
    <div className="mb-6">
      <div className={`border-b pb-2 mb-3 flex justify-between items-center ${colorClass}`}>
        <h4 className="font-bold text-lg flex items-center gap-2">{title}</h4>
        <span className="font-bold text-lg">Rp {total.toLocaleString('id-ID')}</span>
      </div>
      {items.length === 0 ? (
        <p className="text-gray-400 text-sm py-2">Tidak ada transaksi.</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {items.map((item, index) => (
            <div key={index} className="py-2 flex justify-between items-center text-sm">
              <div>
                <p className="font-bold text-gray-800">{item.product_name}</p>
                <div className="flex gap-2 items-center mt-1">
                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${badgeClass}`}>
                    {title.includes('CASH') ? 'TUNAI' : 'QRIS'}
                  </span>
                  <p className="text-xs text-gray-500">@Rp {item.price.toLocaleString("id-ID")}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-gray-700">{item.qty}x</p>
                <p className="text-xs font-semibold text-gray-900">Rp {item.subtotal.toLocaleString("id-ID")}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[95vh] flex flex-col overflow-hidden">
        
        {/* HEADER MODAL */}
        <div className="p-6 bg-gray-800 text-white flex justify-between items-center shrink-0">
          <div>
            <h3 className="text-xl font-bold">Rincian Operasional & Audit Shift</h3>
            <p className="text-sm text-gray-300">Kasir: {cashierName} | ID: {shiftId.substring(0, 8)}...</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white font-bold text-2xl">
            &times;
          </button>
        </div>

        {isLoading || !shiftSummary ? (
          <div className="p-12 text-center font-bold text-gray-600 flex-1 flex items-center justify-center">
            <span className="animate-pulse">Mengalkulasi Laporan Arus Kas...</span>
          </div>
        ) : (
          <div className="flex flex-col flex-1 overflow-hidden">
            
            {/* PANEL LEMBAR AUDIT (REKAP FINANSIAL) */}
            <div className="bg-blue-50 p-4 grid grid-cols-5 gap-4 border-b border-blue-100 shrink-0">
              <div>
                <p className="text-[10px] uppercase font-bold text-gray-500 mb-1">Modal Awal Laci</p>
                <p className="text-lg font-bold text-gray-800">Rp {shiftSummary.starting_cash.toLocaleString('id-ID')}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-green-600 mb-1">+ Pemasukan Tunai</p>
                <p className="text-lg font-bold text-green-700">Rp {totalCash.toLocaleString('id-ID')}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-red-600 mb-1">- Pengeluaran Laci</p>
                <p className="text-lg font-bold text-red-700">Rp {totalExpense.toLocaleString('id-ID')}</p>
              </div>
              <div className="border-l-2 border-blue-200 pl-4">
                <p className="text-[10px] uppercase font-bold text-blue-800 mb-1">Seharusnya di Laci</p>
                <p className="text-xl font-black text-blue-900">
                  Rp {(shiftSummary.starting_cash + totalCash - totalExpense).toLocaleString('id-ID')}
                </p>
              </div>
              <div className="border-l-2 border-blue-200 pl-4">
                <p className="text-[10px] uppercase font-bold text-gray-600 mb-1">Fisik Disetor Kasir</p>
                <p className={`text-xl font-black ${shiftSummary.status === 'open' ? 'text-gray-400' : 'text-gray-900'}`}>
                  {shiftSummary.status === 'open' ? 'BELUM TUTUP' : `Rp ${(shiftSummary.ending_cash || 0).toLocaleString('id-ID')}`}
                </p>
              </div>
            </div>

            {/* RINCIAN PRODUK & PENGELUARAN */}
            <div className="p-6 overflow-y-auto flex-1 grid grid-cols-1 md:grid-cols-2 gap-8 bg-gray-50">
              
              {/* KOLOM KIRI: PRODUK TERJUAL */}
              <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200 h-fit">
                {renderProductList(cashItems, "CASH (Tunai)", "text-green-600 border-green-200", "bg-green-100 text-green-700", totalCash)}
                {renderProductList(qrisItems, "QRIS (Rekening)", "text-blue-600 border-blue-200", "bg-blue-100 text-blue-700", totalQris)}
              </div>

              {/* KOLOM KANAN: PENGELUARAN */}
              <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200 h-fit">
                <div className="border-b border-red-200 pb-2 mb-4 flex justify-between items-center text-red-600">
                  <h4 className="font-bold text-lg">💸 Pengeluaran Kas Kecil</h4>
                  <span className="font-bold text-lg">Rp {totalExpense.toLocaleString('id-ID')}</span>
                </div>
                {expenses.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-8">Aman. Tidak ada pengeluaran laci.</p>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {expenses.map((exp, index) => (
                      <div key={index} className="py-3 text-sm">
                        <div className="flex justify-between items-start mb-1">
                          <span className="px-2 py-0.5 bg-red-50 text-red-700 text-[10px] uppercase font-bold rounded">
                            {exp.category}
                          </span>
                          <span className="font-bold text-red-600">
                            - Rp {exp.amount.toLocaleString("id-ID")}
                          </span>
                        </div>
                        <p className="text-gray-700 text-xs italic mt-1">"{exp.description}"</p>
                        <p className="text-[10px] text-gray-400 mt-1">
                          Jam: {new Date(exp.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" })}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* FOOTER MODAL */}
        <div className="p-4 bg-gray-100 border-t flex justify-end shrink-0">
          <button onClick={onClose} className="px-5 py-2 bg-gray-700 text-white font-bold rounded-lg hover:bg-gray-800 transition">
            TUTUP PANEL AUDIT
          </button>
        </div>
      </div>
    </div>
  );
}