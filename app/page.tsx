"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import CloseShiftModal from "@/components/pos/CloseShiftModal";
import ExpenseModal from "@/components/pos/ExpenseModal"; 

export default function POSPage() {
  const router = useRouter();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [activeShift, setActiveShift] = useState<any>(null);
  const [cashierEmail, setCashierEmail] = useState("");
  const [startingCash, setStartingCash] = useState("");
  const [isSubmittingShift, setIsSubmittingShift] = useState(false);

  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [isLoadingMenu, setIsLoadingMenu] = useState(true);
  const [cart, setCart] = useState<any[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [isCheckout, setIsCheckout] = useState(false);

  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isCloseShiftModalOpen, setIsCloseShiftModalOpen] = useState(false);

  useEffect(() => {
    const initApp = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.replace("/login");
        return;
      }
      setCashierEmail(session.user.email || "Kasir");

      const { data: shiftData } = await supabase
        .from('shifts')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('status', 'open')
        .maybeSingle();

      if (shiftData) {
        setActiveShift(shiftData);
      }

      try {
        const { data: productsData, error: productsError } = await supabase
          .from('products')
          .select('*')
          .order('category')
          .order('product_name');
          
        if (productsError) throw productsError;
        setMenuItems(productsData || []);
      } catch (error: any) {
        console.error("Gagal menarik menu:", error.message);
      } finally {
        setIsLoadingMenu(false);
        setIsCheckingAuth(false);
      }
    };
    
    initApp();
  }, [router]);

  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (Number(startingCash) < 0) return alert("Modal tidak boleh minus!");
    setIsSubmittingShift(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sesi tidak valid");

      const { data, error } = await supabase
        .from('shifts')
        .insert({
          user_id: session.user.id,
          starting_cash: Number(startingCash),
          status: 'open'
        })
        .select()
        .single();

      if (error) throw error;
      setActiveShift(data);
    } catch (error: any) {
      alert("Gagal buka shift: " + error.message);
    } finally {
      setIsSubmittingShift(false);
    }
  };

  const addToCart = (product: any) => {
    setCart((prevCart) => {
      const existing = prevCart.find(item => item.id === product.id);
      if (existing) {
        return prevCart.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item);
      }
      return [...prevCart, { ...product, qty: 1 }];
    });
  };

  const increaseQty = (productId: string) => {
    setCart((prevCart) => 
      prevCart.map(item => item.id === productId ? { ...item, qty: item.qty + 1 } : item)
    );
  };

  const decreaseQty = (productId: string) => {
    setCart((prevCart) => 
      prevCart.map(item => {
        if (item.id === productId) return { ...item, qty: item.qty - 1 };
        return item;
      }).filter(item => item.qty > 0) 
    );
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

  const handleCheckout = async () => {
    if (cart.length === 0) return alert("Keranjang kosong!");
    setIsCheckout(true);

    try {
      const { data: trxData, error: trxError } = await supabase
        .from('transactions')
        .insert({
          shift_id: activeShift.id,
          total_amount: cartTotal,
          payment_method: paymentMethod 
        })
        .select()
        .single();

      if (trxError) throw trxError;

      const itemsToInsert = cart.map(item => ({
        transaction_id: trxData.id,
        product_name: item.product_name,
        qty: item.qty,
        price: item.price,
        subtotal: item.price * item.qty
      }));

      const { error: itemsError } = await supabase
        .from('transaction_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      alert(`Pembayaran ${paymentMethod} Berhasil!`);
      setCart([]);
    } catch (error: any) {
      alert("Gagal memproses pembayaran: " + error.message);
    } finally {
      setIsCheckout(false);
    }
  };

  if (isCheckingAuth) {
    return <div className="flex h-screen items-center justify-center font-bold">Memuat Sistem Kasir...</div>;
  }

  if (!activeShift) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md border border-gray-200">
          <h2 className="text-2xl font-bold mb-2 text-center text-gray-800">Buka Shift Kasir</h2>
          <p className="text-gray-500 text-sm text-center mb-6">Kasir: {cashierEmail}</p>
          <form onSubmit={handleOpenShift} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Modal Awal Laci (Rp)</label>
              <input
                type="number"
                required
                min="0"
                className="w-full p-3 border border-gray-300 rounded text-lg font-bold"
                placeholder="Contoh: 150000"
                value={startingCash}
                onChange={(e) => setStartingCash(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={isSubmittingShift}
              className="bg-blue-600 text-white font-bold py-3 rounded hover:bg-blue-700 disabled:bg-gray-400 mt-2 transition"
            >
              {isSubmittingShift ? "MEMPROSES..." : "MULAI SHIFT & JUALAN"}
            </button>
            <button
              type="button"
              onClick={async () => { await supabase.auth.signOut(); router.replace("/login"); }}
              className="text-red-600 text-sm font-bold hover:underline mt-2"
            >
              Keluar Akun
            </button>
          </form>
        </div>
      </div>
    );
  }


  return (
    <div className="h-screen flex flex-col bg-gray-100 overflow-hidden">
      
      {/* HEADER POS */}
      <header className="bg-white shadow-sm p-4 flex justify-between items-center z-10 shrink-0 border-b border-gray-200">
        <div>
          <h1 className="text-2xl font-black text-blue-900 tracking-tight">WARUNG POS</h1>
          <p className="text-xs text-gray-500 font-semibold mt-1">
            Kasir: <span className="text-blue-600">{cashierEmail}</span> | ID Shift: {activeShift.id.substring(0, 8)}
          </p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setIsExpenseModalOpen(true)}
            className="px-5 py-2 bg-yellow-100 text-yellow-700 font-bold rounded shadow-sm hover:bg-yellow-200 transition"
          >
            PENGELUARAN
          </button>
          <button 
            onClick={() => setIsCloseShiftModalOpen(true)}
            className="px-5 py-2 bg-red-100 text-red-600 font-bold rounded shadow-sm hover:bg-red-200 transition"
          >
            TUTUP SHIFT
          </button>
        </div>
      </header>

      {/* AREA KERJA (KIRI: MENU, KANAN: KERANJANG) */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* KOLOM KIRI: DAFTAR MENU DINAMIS */}
        <div className="w-2/3 p-6 overflow-y-auto">
          <h2 className="text-xl font-bold mb-6 text-gray-800">Menu Tersedia</h2>
          
          <div className="grid grid-cols-3 xl:grid-cols-4 gap-4">
            {isLoadingMenu ? (
              <p className="text-gray-500 font-bold col-span-3">Memuat Menu dari Database...</p>
            ) : menuItems.length === 0 ? (
              <p className="text-red-500 font-bold col-span-3">Tidak ada menu aktif.</p>
            ) : (
              menuItems.map((menu) => (
                <button
                  key={menu.id}
                  onClick={() => addToCart(menu)}
                  className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 hover:border-blue-500 hover:shadow-md transition text-left flex flex-col h-full active:scale-95"
                >
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{menu.category}</span>
                  <p className="font-bold text-gray-800 text-lg leading-tight mb-2 flex-1">{menu.product_name}</p>
                  <p className="font-black text-blue-600">Rp {menu.price.toLocaleString('id-ID')}</p>
                </button>
              ))
            )}
          </div>
        </div>

        {/* KOLOM KANAN: PANEL KERANJANG */}
        <div className="w-1/3 bg-white border-l border-gray-200 flex flex-col shadow-xl z-20">
          
          <div className="p-5 border-b border-gray-100 shrink-0 bg-gray-50">
            <h2 className="text-xl font-bold text-gray-800">Keranjang Pesanan</h2>
          </div>

          {/* DAFTAR ITEM KERANJANG (INTERAKTIF) */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400">
                <p className="font-bold text-lg">Keranjang Kosong</p>
                <p className="text-sm">Klik menu di sebelah kiri untuk menambah pesanan</p>
              </div>
            ) : (
              cart.map((item: any) => (
                <div key={item.id} className="flex flex-col bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                  <div className="flex justify-between items-start mb-2">
                    <p className="font-bold text-gray-800 leading-tight">{item.product_name}</p>
                    <p className="font-black text-gray-900 text-right w-24">
                      Rp {(item.price * item.qty).toLocaleString('id-ID')}
                    </p>
                  </div>
                  
                  <div className="flex justify-between items-center mt-2 border-t border-gray-100 pt-2">
                    <p className="text-xs font-semibold text-gray-500">@ Rp {item.price.toLocaleString('id-ID')}</p>
                    
                    {/* KONTROL QTY (+ / -) */}
                    <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-md">
                      <button 
                        onClick={() => decreaseQty(item.id)}
                        className="w-8 h-8 flex items-center justify-center bg-white text-red-600 font-bold rounded shadow-sm hover:bg-red-50 transition border border-gray-200"
                      >
                        -
                      </button>
                      <span className="font-bold text-sm w-8 text-center text-gray-800">
                        {item.qty}
                      </span>
                      <button 
                        onClick={() => increaseQty(item.id)}
                        className="w-8 h-8 flex items-center justify-center bg-blue-600 text-white font-bold rounded shadow-sm hover:bg-blue-700 transition"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* PANEL CHECKOUT (BAWAH) */}
          <div className="p-5 bg-white border-t border-gray-200 shrink-0">
            <div className="flex justify-between items-end mb-4">
              <p className="text-gray-500 font-bold">TOTAL TAGIHAN</p>
              <p className="text-3xl font-black text-gray-900">Rp {cartTotal.toLocaleString('id-ID')}</p>
            </div>

            {/* PILIH METODE BAYAR */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                onClick={() => setPaymentMethod('CASH')}
                className={`py-3 font-bold rounded-lg border-2 transition ${
                  paymentMethod === 'CASH' 
                    ? 'border-green-600 bg-green-50 text-green-700' 
                    : 'border-gray-200 text-gray-500 hover:border-green-300'
                }`}
              >
                💵 UANG TUNAI
              </button>
              <button
                onClick={() => setPaymentMethod('QRIS')}
                className={`py-3 font-bold rounded-lg border-2 transition ${
                  paymentMethod === 'QRIS' 
                    ? 'border-blue-600 bg-blue-50 text-blue-700' 
                    : 'border-gray-200 text-gray-500 hover:border-blue-300'
                }`}
              >
                📱 QRIS
              </button>
            </div>

            <button
              onClick={handleCheckout}
              disabled={isCheckout || cart.length === 0}
              className="w-full bg-blue-600 text-white font-black text-lg py-4 rounded-xl shadow-lg hover:bg-blue-700 disabled:bg-gray-300 transition active:scale-95"
            >
              {isCheckout ? "MEMPROSES..." : `BAYAR SEKARANG`}
            </button>
          </div>
        </div>
      </div>

      {/* RENDER MODALS */}
      <ExpenseModal 
        isOpen={isExpenseModalOpen} 
        onClose={() => setIsExpenseModalOpen(false)} 
        activeShiftId={activeShift?.id} 
      />
      
      <CloseShiftModal
        isOpen={isCloseShiftModalOpen}
        onClose={() => setIsCloseShiftModalOpen(false)}
        activeShift={activeShift}
      />
      
    </div>
  );
}