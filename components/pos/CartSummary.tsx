"use client";

import { useState } from "react";
import { useCartStore } from "@/store/useCartStore";
import { supabase } from "@/lib/supabase/client";

interface CartSummaryProps {
  activeShiftId: string;
}

export default function CartSummary({ activeShiftId }: CartSummaryProps) {
  const { items, totalAmount, clearCart } = useCartStore();
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("QRIS");

  const handleCheckout = async () => {
    if (items.length === 0) return alert("Keranjang kosong!");
    setIsProcessing(true);

    try {
      const formattedItems = items.map(item => ({
        product_name: item.product_name,
        qty: item.qty,
        price: item.price,
        subtotal: item.qty * item.price
      }));

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sesi kasir tidak valid");

      const { error } = await supabase.rpc('checkout_pos', {
        p_total_amount: totalAmount,
        p_payment_method: paymentMethod,
        p_user_id: user.id,
        p_shift_id: activeShiftId, 
        p_items: formattedItems
      });

      if (error) throw error;

      alert("Pembayaran berhasil dicatat!");
      clearCart();
    } catch (error: any) {
      console.error("Gagal checkout:", error.message);
      alert("Gagal memproses pembayaran. Cek koneksi.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="p-4 border-l border-gray-200 h-full flex flex-col justify-between">
      <div>
        <h2 className="text-xl font-bold mb-4 text-gray-800">Keranjang</h2>
        {items.map((item) => (
          <div key={item.id} className="flex justify-between mb-2 text-gray-700">
            <span>{item.qty}x {item.product_name}</span>
            <span>Rp {(item.qty * item.price).toLocaleString('id-ID')}</span>
          </div>
        ))}
      </div>

      <div className="mt-6 border-t pt-4">
        <div className="flex justify-between font-bold text-lg mb-4 text-gray-800">
          <span>Total:</span>
          <span>Rp {totalAmount.toLocaleString('id-ID')}</span>
        </div>

        <select 
          className="w-full mb-4 p-2 border border-gray-300 rounded text-gray-800"
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value)}
        >
          <option value="QRIS">QRIS (Cek Manual)</option>
          <option value="CASH">Tunai (CASH)</option>
        </select>

        <button 
          onClick={handleCheckout} 
          disabled={isProcessing || items.length === 0}
          className="w-full bg-blue-600 text-white font-bold py-3 rounded disabled:bg-gray-400 hover:bg-blue-700 transition"
        >
          {isProcessing ? "Memproses..." : "BAYAR SEKARANG"}
        </button>
      </div>
    </div>
  );
}