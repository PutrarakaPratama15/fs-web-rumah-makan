"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

interface Product {
  id: string;
  product_name: string;
  price: number;
  category: string;
  is_active: boolean;
}

export default function MenuManagementPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // State untuk form tambah menu
  const [newMenu, setNewMenu] = useState({ name: "", price: "", category: "Makanan" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const checkAuthAndFetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.replace("/login");

      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .single();

      if (!roleData || roleData.role !== 'admin') {
        alert("Akses Ditolak! Anda bukan Admin.");
        return router.replace("/");
      }
      setIsAuthorized(true);
      fetchProducts();
    };

    checkAuthAndFetchData();
  }, [router]);

  const fetchProducts = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('category')
        .order('product_name');

      if (error) throw error;
      setProducts(data || []);
    } catch (error: any) {
      console.error("Gagal menarik menu:", error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddMenu = async (e: React.FormEvent) => {
    e.preventDefault();
    if (Number(newMenu.price) <= 0) return alert("Harga tidak boleh nol atau minus!");
    setIsSubmitting(true);

    try {
      const { error } = await supabase.from('products').insert({
        product_name: newMenu.name,
        price: Number(newMenu.price),
        category: newMenu.category,
        is_active: true
      });

      if (error) throw error;
      
      alert("Menu baru berhasil ditambahkan!");
      setNewMenu({ name: "", price: "", category: "Makanan" });
      fetchProducts(); // Refresh tabel
    } catch (error: any) {
      alert("Gagal menambah menu: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('products')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) throw error;
      fetchProducts(); // Refresh tabel biar UI update
    } catch (error: any) {
      alert("Gagal update status: " + error.message);
    }
  };

  if (!isAuthorized || isLoading) {
    return <div className="flex h-screen items-center justify-center font-bold">Memuat Halaman Manajemen...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto flex gap-8">
        
        {/* BAGIAN KIRI: FORM TAMBAH MENU */}
        <div className="w-1/3">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 sticky top-8">
            <h2 className="text-xl font-bold mb-4 text-gray-800">Tambah Menu Baru</h2>
            <form onSubmit={handleAddMenu} className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Menu</label>
                <input
                  type="text"
                  required
                  placeholder="Cth: Mie Ayam Spesial"
                  className="w-full p-2 border border-gray-300 rounded"
                  value={newMenu.name}
                  onChange={(e) => setNewMenu({ ...newMenu, name: e.target.value })}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Harga (Rp)</label>
                <input
                  type="number"
                  required
                  min="0"
                  placeholder="Cth: 15000"
                  className="w-full p-2 border border-gray-300 rounded"
                  value={newMenu.price}
                  onChange={(e) => setNewMenu({ ...newMenu, price: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
                <select
                  className="w-full p-2 border border-gray-300 rounded"
                  value={newMenu.category}
                  onChange={(e) => setNewMenu({ ...newMenu, category: e.target.value })}
                >
                  <option value="Makanan">Makanan</option>
                  <option value="Minuman">Minuman</option>
                  <option value="Cemilan">Cemilan</option>
                  <option value="Topping">Topping</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 bg-blue-600 text-white font-bold py-2 rounded disabled:bg-gray-400 hover:bg-blue-700 transition"
              >
                {isSubmitting ? "Menyimpan..." : "SIMPAN MENU"}
              </button>
            </form>
            
            <button 
              onClick={() => router.push("/admin")}
              className="w-full mt-4 bg-gray-200 text-gray-800 font-bold py-2 rounded hover:bg-gray-300"
            >
              KEMBALI KE DASHBOARD
            </button>
          </div>
        </div>

        {/* BAGIAN KANAN: TABEL DAFTAR MENU */}
        <div className="w-2/3">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
              <h2 className="font-bold text-gray-800">Daftar Menu Tersedia</h2>
            </div>
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="p-4 text-sm font-bold text-gray-600">Nama Menu</th>
                  <th className="p-4 text-sm font-bold text-gray-600">Kategori</th>
                  <th className="p-4 text-sm font-bold text-gray-600">Harga</th>
                  <th className="p-4 text-sm font-bold text-gray-600 text-center">Status Jualan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-gray-500">Belum ada data menu.</td>
                  </tr>
                ) : (
                  products.map((p) => (
                    <tr key={p.id} className={p.is_active ? "hover:bg-gray-50" : "bg-red-50 opacity-75"}>
                      <td className="p-4 font-semibold text-gray-800">{p.product_name}</td>
                      <td className="p-4 text-gray-600">
                        <span className="px-2 py-1 bg-gray-200 rounded text-xs">{p.category}</span>
                      </td>
                      <td className="p-4 text-gray-800">Rp {p.price.toLocaleString('id-ID')}</td>
                      <td className="p-4 text-center">
                        <button
                          onClick={() => handleToggleActive(p.id, p.is_active)}
                          className={`px-4 py-1 rounded text-sm font-bold transition ${
                            p.is_active 
                              ? "bg-green-100 text-green-700 hover:bg-green-200" 
                              : "bg-red-100 text-red-700 hover:bg-red-200"
                          }`}
                        >
                          {p.is_active ? "Tersedia" : "Habis/Mati"}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}