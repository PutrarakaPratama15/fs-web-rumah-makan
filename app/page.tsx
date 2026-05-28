"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import CloseShiftModal from "@/components/pos/CloseShiftModal";
import ExpenseModal from "@/components/pos/ExpenseModal"; 

export default function POSPage() {
  const router = useRouter();
  
  // State Autentikasi & Shift
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [activeShift, setActiveShift] = useState<any>(null);
  const [cashierEmail, setCashierEmail] = useState("");
  const [startingCash, setStartingCash] = useState("");
  const [isSubmittingShift, setIsSubmittingShift] = useState(false);

  // State Menu & Keranjang
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [isLoadingMenu, setIsLoadingMenu] = useState(true);
  const [cart, setCart] = useState<any[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("CASH"); 
  const [isCheckout, setIsCheckout] = useState(false);
  const [qrisFile, setQrisFile] = useState<File | null>(null);
  const hiddenCameraRef = useRef<HTMLInputElement>(null);

  // STATE BARU: Khusus Navigasi Layar HP (Mobile Tab Switcher)
  const [mobileTab, setMobileTab] = useState<"menu" | "cart">("menu");

  // Modals
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
  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);

  const handlePayClick = () => {
    if (cart.length === 0) return alert("Keranjang kosong!");
    if (paymentMethod === 'QRIS') {
      hiddenCameraRef.current?.click(); 
    } else {
      executeTransaction(null);
    }
  };

  const executeTransaction = async (capturedFile: File | null) => {
    setIsCheckout(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sesi kasir tidak valid! Silakan login ulang.");

      let proofUrl = null;

      if (paymentMethod === 'QRIS' && capturedFile) {
        const fileExt = capturedFile.name.split('.').pop();
        const fileName = `qris-${activeShift.id.substring(0, 5)}-${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('qris_proofs')
          .upload(fileName, capturedFile);

        if (uploadError) throw new Error("Gagal upload bukti: " + uploadError.message);

        const { data: publicUrlData } = supabase.storage
          .from('qris_proofs')
          .getPublicUrl(fileName);
          
        proofUrl = publicUrlData.publicUrl;
      }

      const { data: trxData, error: trxError } = await supabase
        .from('transactions')
        .insert({
          shift_id: activeShift.id,
          user_id: session.user.id,
          total_amount: cartTotal,
          payment_method: paymentMethod,
          payment_proof_url: proofUrl
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
      setQrisFile(null);
      setMobileTab("menu"); // Otomatis balik ke tab menu setelah bayar
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
      <div className="flex h-screen items-center justify-center bg-gray-100 p-4">
        <div className="bg-white p-6 md:p-8 rounded-lg shadow-xl w-full max-w-md border border-gray-200">
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
              className="text-red-600 text-sm font-bold hover:underline mt-2 text-center"
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
      
      {/* HEADER POS RESPONSIVE */}
      <header className="bg-white shadow-sm p-4 flex justify-between items-center z-10 shrink-0 border-b border-gray-200">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-blue-900 tracking-tight">KI ERO</h1>
          <p className="text-[10px] md:text-xs text-gray-500 font-semibold mt-0.5">
            Kasir: <span className="text-blue-600">{cashierEmail.split('@')[0]}</span> <span className="hidden sm:inline">| ID Shift: {activeShift.id.substring(0, 8)}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setIsExpenseModalOpen(true)}
            className="px-3 md:px-5 py-1.5 md:py-2 bg-yellow-100 text-yellow-700 text-xs md:text-sm font-bold rounded shadow-sm hover:bg-yellow-200 transition"
          >
            KAS KECIL
          </button>
          <button 
            onClick={() => setIsCloseShiftModalOpen(true)}
            className="px-3 md:px-5 py-1.5 md:py-2 bg-red-100 text-red-600 text-xs md:text-sm font-bold rounded shadow-sm hover:bg-red-200 transition"
          >
            TUTUP
          </button>
        </div>
      </header>

      {/* NAVIGATION BAR KHUSUS MOBILE (Muncul hanya di HP/Layar Kecil) */}
      <div className="md:hidden grid grid-cols-2 bg-white border-b border-gray-200 sticky top-0 z-30 shrink-0">
        <button
          onClick={() => setMobileTab("menu")}
          className={`py-3 text-center font-bold text-sm border-b-4 transition ${
            mobileTab === "menu" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500"
          }`}
        >
          📋 Daftar Menu
        </button>
        <button
          onClick={() => setMobileTab("cart")}
          className={`py-3 text-center font-bold text-sm border-b-4 transition flex justify-center items-center gap-2 ${
            mobileTab === "cart" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500"
          }`}
        >
          🛒 Keranjang
          {cartCount > 0 && (
            <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full animate-bounce">
              {cartCount}
            </span>
          )}
        </button>
      </div>

      {/* AREA KERJA RESPONSIVE */}
      <div className="flex flex-1 overflow-hidden relative">
        
        {/* KOLOM KIRI: DAFTAR MENU (Kustomisasi grid berdasarkan ukuran layar) */}
        <div className={`w-full md:w-2/3 p-4 md:p-6 overflow-y-auto ${mobileTab === "menu" ? "block" : "hidden md:block"}`}>
          <h2 className="text-lg md:text-xl font-bold mb-4 md:mb-6 text-gray-800">Menu Tersedia</h2>
          
          {/* GRID RESPONSIVE: 2 kolom (HP), 3 kolom (Tablet), 4 kolom (Monitor Desktop) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
            {isLoadingMenu ? (
              <p className="text-gray-500 font-bold col-span-2">Memuat Menu...</p>
            ) : menuItems.length === 0 ? (
              <p className="text-red-500 font-bold col-span-2">Tidak ada menu aktif.</p>
            ) : (
              menuItems.map((menu) => (
                <button
                  key={menu.id}
                  onClick={() => addToCart(menu)}
                  className="bg-white p-3 md:p-4 rounded-xl shadow-sm border border-gray-200 hover:border-blue-500 hover:shadow-md transition text-left flex flex-col h-full active:scale-95 touch-manipulation"
                >
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">{menu.category}</span>
                  <p className="font-bold text-gray-800 text-sm md:text-lg leading-tight mb-2 flex-1 line-clamp-2">{menu.product_name}</p>
                  <p className="font-black text-blue-600 text-sm md:text-base">Rp {menu.price.toLocaleString('id-ID')}</p>
                </button>
              ))
            )}
          </div>
        </div>

        {/* KOLOM KANAN: PANEL KERANJANG */}
        <div className={`w-full md:w-1/3 bg-white border-l border-gray-200 flex flex-col shadow-xl z-20 absolute md:relative inset-0 md:inset-auto ${
          mobileTab === "cart" ? "flex" : "hidden md:flex"
        }`}>
          
          <div className="p-4 md:p-5 border-b border-gray-100 shrink-0 bg-gray-50 hidden md:block">
            <h2 className="text-xl font-bold text-gray-800">Keranjang Pesanan</h2>
          </div>

          {/* LIST ITEM KERANJANG */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 text-center p-4">
                <p className="font-bold text-lg">Keranjang Kosong</p>
                <p className="text-xs md:text-sm">Klik menu di tab sebelah untuk menambah pesanan</p>
              </div>
            ) : (
              cart.map((item: any) => (
                <div key={item.id} className="flex flex-col bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                  <div className="flex justify-between items-start mb-2">
                    <p className="font-bold text-gray-800 text-sm md:text-base leading-tight pr-2">{item.product_name}</p>
                    <p className="font-black text-gray-900 text-right w-24 text-sm md:text-base">
                      Rp {(item.price * item.qty).toLocaleString('id-ID')}
                    </p>
                  </div>
                  
                  <div className="flex justify-between items-center mt-1 border-t border-gray-100 pt-2">
                    <p className="text-[11px] font-semibold text-gray-500">@ Rp {item.price.toLocaleString('id-ID')}</p>
                    
                    {/* BUTTON CONTROLLER DIBUAT NYAMAN DI JARI */}
                    <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-md">
                      <button 
                        onClick={() => decreaseQty(item.id)}
                        className="w-8 h-8 flex items-center justify-center bg-white text-red-600 font-bold rounded shadow-sm hover:bg-red-50 border border-gray-200 text-lg active:scale-90"
                      >
                        -
                      </button>
                      <span className="font-bold text-sm w-8 text-center text-gray-800">
                        {item.qty}
                      </span>
                      <button 
                        onClick={() => increaseQty(item.id)}
                        className="w-8 h-8 flex items-center justify-center bg-blue-600 text-white font-bold rounded shadow-sm hover:bg-blue-700 text-lg active:scale-90"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* CHECKOUT SECTION */}
          <div className="p-4 md:p-5 bg-white border-t border-gray-200 shrink-0 pb-6 md:pb-5">
            <div className="flex justify-between items-end mb-4">
              <p className="text-gray-500 text-xs md:text-sm font-bold">TOTAL TAGIHAN</p>
              <p className="text-2xl md:text-3xl font-black text-gray-900">Rp {cartTotal.toLocaleString('id-ID')}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                onClick={() => setPaymentMethod('CASH')}
                className={`py-2.5 md:py-3 text-xs md:text-sm font-bold rounded-lg border-2 transition ${
                  paymentMethod === 'CASH' 
                    ? 'border-green-600 bg-green-50 text-green-700' 
                    : 'border-gray-200 text-gray-500 hover:border-green-300'
                }`}
              >
                💵 TUNAI
              </button>
              <button
                onClick={() => setPaymentMethod('QRIS')}
                className={`py-2.5 md:py-3 text-xs md:text-sm font-bold rounded-lg border-2 transition ${
                  paymentMethod === 'QRIS' 
                    ? 'border-blue-600 bg-blue-50 text-blue-700' 
                    : 'border-gray-200 text-gray-500 hover:border-blue-300'
                }`}
              >
                📱 QRIS
              </button>
            </div>

            <input
              type="file"
              accept="image/*"
              capture="environment"
              ref={hiddenCameraRef}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) executeTransaction(file); 
              }}
            />

            <button
              onClick={handlePayClick}
              disabled={isCheckout || cart.length === 0}
              className={`w-full text-white font-black text-base md:text-lg py-3.5 md:py-4 rounded-xl shadow-lg transition active:scale-95 ${
                paymentMethod === 'QRIS' 
                  ? 'bg-blue-600 hover:bg-blue-700' 
                  : 'bg-green-600 hover:bg-green-700'
              } disabled:bg-gray-300`}
            >
              {isCheckout 
                ? "MEMPROSES..." 
                : paymentMethod === 'QRIS' 
                  ? "📸 SCAN QRIS & BAYAR" 
                  : "BAYAR SEKARANG"}
            </button>
          </div>
        </div>
      </div>

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