"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import CartSummary from "@/components/pos/CartSummary";
import React from "react";
import ProductButton from "@/components/pos/ProductButton";
import ExpenseModal from "@/components/pos/ExpenseModal";
import CloseShiftModal from "@/components/pos/CloseShiftModal";

export default function POSPage() {
  const router = useRouter();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isCloseShiftModalOpen, setIsCloseShiftModalOpen] = useState(false);
  
  // State untuk Shift Management
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [isLoadingMenu, setIsLoadingMenu] = useState(true);
  const [activeShift, setActiveShift] = useState<any>(null);
  const [startingCash, setStartingCash] = useState("");
  const [isSubmittingShift, setIsSubmittingShift] = useState(false);

  useEffect(() => {
    const checkAuthAndShift = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.replace("/login");
        return;
      }

      // Cek Shift
      const { data: shiftData } = await supabase
        .from('shifts')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('status', 'open')
        .maybeSingle();

      if (shiftData) {
        setActiveShift(shiftData);
      }

      // ---> TAMBAHKAN BLOK PENARIKAN MENU INI <---
      try {
        const { data: productsData, error: productsError } = await supabase
          .from('products')
          .select('*')
          .order('category') // Urutkan berdasarkan kategori
          .order('product_name');
          
        if (productsError) throw productsError;
        setMenuItems(productsData || []);
      } catch (error: any) {
        console.error("Gagal menarik menu:", error.message);
      } finally {
        setIsLoadingMenu(false);
      }

      setIsCheckingAuth(false);
    };
    
    checkAuthAndShift();
  }, [router]);

  // Fungsi untuk eksekusi Buka Shift
  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (Number(startingCash) < 0) return alert("Modal awal tidak boleh minus!");
    
    setIsSubmittingShift(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sesi hilang");

      const { data: newShift, error } = await supabase
        .from('shifts')
        .insert({
          user_id: user.id,
          starting_cash: Number(startingCash),
          status: 'open'
        })
        .select()
        .single();

      if (error) throw error;

      setActiveShift(newShift); // Set state agar UI kasir terbuka
    } catch (error: any) {
      alert("Gagal buka shift: " + error.message);
    } finally {
      setIsSubmittingShift(false);
    }
  };

  const handleLogout = async () => {
    // Nanti kita ubah ini jadi Tutup Shift
    await supabase.auth.signOut();
    router.replace("/login");
  };

  if (isCheckingAuth) {
    return <div className="flex h-screen items-center justify-center font-bold">Memuat Sistem...</div>;
  }

  // ==========================================
  // RENDER BLOKIRAN: FORM BUKA SHIFT
  // ==========================================
  if (!activeShift) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md">
          <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">Mulai Shift Kasir</h2>
          <form onSubmit={handleOpenShift} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Uang Modal di Laci (Rp)
              </label>
              <input
                type="number"
                required
                min="0"
                className="w-full p-3 border border-gray-300 rounded text-lg font-bold"
                placeholder="Contoh: 150000"
                value={startingCash}
                onChange={(e) => setStartingCash(e.target.value)}
              />
              <p className="text-xs text-gray-500 mt-2">
                Hitung fisik uang di laci sekarang sebelum mulai menerima pelanggan.
              </p>
            </div>
            <button
              type="submit"
              disabled={isSubmittingShift}
              className="w-full mt-4 bg-blue-600 text-white font-bold py-3 rounded disabled:bg-gray-400"
            >
              {isSubmittingShift ? "Membuka Sistem..." : "BUKA SHIFT SEKARANG"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER MEJA KASIR UTAMA
  // ==========================================
  

  return (
    <div className="flex h-screen bg-gray-50">
      <div className="w-2/3 p-6 overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Menu Kasir</h1>
            <p className="text-sm text-green-600 font-bold">Shift Aktif — Modal: Rp {activeShift.starting_cash.toLocaleString('id-ID')}</p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setIsExpenseModalOpen(true)}
              className="px-4 py-2 bg-yellow-100 text-yellow-700 font-bold rounded hover:bg-yellow-200"
            >
              - PENGELUARAN
            </button>
            <button 
              onClick={() => setIsCloseShiftModalOpen(true)} // <--- Ubah onClick-nya
              className="px-4 py-2 bg-red-100 text-red-600 font-bold rounded hover:bg-red-200"
            >
              TUTUP SHIFT
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-3 gap-4">
          {/* UBAH DARI dummyMenus.map MENJADI SEPERTI INI */}
          {isLoadingMenu ? (
            <p className="text-gray-500 font-bold col-span-3">Memuat Menu dari Database...</p>
          ) : menuItems.length === 0 ? (
            <p className="text-red-500 font-bold col-span-3">Tidak ada menu aktif di database.</p>
          ) : (
            menuItems.map((menu) => (
              <ProductButton 
                key={menu.id} 
                id={menu.id} 
                product_name={menu.product_name} 
                price={menu.price} 
              />
            ))
          )}
        </div>
      </div>

      {/* BAGIAN KANAN */}
      <div className="w-1/3 bg-white shadow-xl z-10 border-l border-gray-200">
        {/**
         * Workaround: some exported CartSummary has an incorrect return type (void) in its type
         * declaration which causes TSX type errors. Cast to any/ComponentType to bypass.
         */}
        {(() => {
          const CartSummaryAny = CartSummary as unknown as React.ComponentType<any>;
          return <CartSummaryAny activeShiftId={activeShift.id} />;
        })()}
      </div>

      <ExpenseModal 
        isOpen={isExpenseModalOpen} 
        onClose={() => setIsExpenseModalOpen(false)} 
        activeShiftId={activeShift.id} 
      />

      <CloseShiftModal
        isOpen={isCloseShiftModalOpen}
        onClose={() => setIsCloseShiftModalOpen(false)}
        activeShift={activeShift}
      />
    </div>
  );
}