"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";

interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeShiftId: string;
}

export default function ExpenseModal({ isOpen, onClose, activeShiftId }: ExpenseModalProps) {
  const [category, setCategory] = useState("Operasional");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Number(amount);

    if (numAmount <= 0) return alert("Nominal tidak valid!");
    if (numAmount > 100000) return alert("Batas pengeluaran kasir maksimal Rp 100.000 per transaksi.");
    if (!description.trim()) return alert("Keterangan wajib diisi!");

    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sesi kasir tidak valid");

      const { error } = await supabase.from('expenses').insert({
        category,
        amount: numAmount,
        description,
        user_id: user.id,
        shift_id: activeShiftId 
      });

      if (error) throw error;

      alert("Pengeluaran berhasil dicatat!");
      
      setAmount("");
      setDescription("");
      onClose();
    } catch (error: any) {
      console.error("Gagal catat pengeluaran:", error.message);
      alert("Gagal menyimpan data: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-2xl">
        <h2 className="text-xl font-bold mb-4 text-gray-800">Catat Pengeluaran (Kas Kecil)</h2>
        
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
            <select 
              className="w-full p-2 border border-gray-300 rounded"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="Bahan Baku">Bahan Baku (Darurat)</option>
              <option value="Operasional">Operasional (Es, Listrik, dll)</option>
              <option value="Lain-lain">Lain-lain</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nominal (Rp)</label>
            <input
              type="number"
              required
              max="100000"
              className="w-full p-2 border border-gray-300 rounded"
              placeholder="Contoh: 20000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Keterangan Detail</label>
            <textarea
              required
              className="w-full p-2 border border-gray-300 rounded resize-none"
              rows={3}
              placeholder="Cth: Beli es batu 2 bungkus di warung depan"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="flex gap-2 mt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 bg-gray-200 text-gray-800 font-bold py-2 rounded hover:bg-gray-300"
            >
              BATAL
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-red-600 text-white font-bold py-2 rounded hover:bg-red-700 disabled:bg-gray-400"
            >
              {isSubmitting ? "Menyimpan..." : "SIMPAN"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}