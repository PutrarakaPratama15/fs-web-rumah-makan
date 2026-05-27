import { create } from 'zustand';

// Definisi tipe data item di keranjang
interface CartItem {
  id: string; 
  product_name: string;
  price: number;
  qty: number;
}

interface CartState {
  items: CartItem[];
  totalAmount: number;
  addItem: (product: Omit<CartItem, 'qty'>) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
}

export const useCartStore = create<CartState>((set) => ({
  items: [],
  totalAmount: 0,
  
  addItem: (product) => set((state) => {
    // Cek apakah produk sudah ada di keranjang
    const existingItem = state.items.find(item => item.id === product.id);
    let newItems;
    
    if (existingItem) {
      // Jika ada, tambahkan qty saja
      newItems = state.items.map(item =>
        item.id === product.id ? { ...item, qty: item.qty + 1 } : item
      );
    } else {
      // Jika belum ada, masukkan sebagai item baru
      newItems = [...state.items, { ...product, qty: 1 }];
    }
    
    // Kalkulasi ulang total harga
    const newTotal = newItems.reduce((sum, item) => sum + (item.price * item.qty), 0);
    return { items: newItems, totalAmount: newTotal };
  }),

  removeItem: (id) => set((state) => {
    const existingItem = state.items.find(item => item.id === id);
    if (!existingItem) return state;

    let newItems;
    if (existingItem.qty > 1) {
      // Jika qty lebih dari 1, kurangi 1
      newItems = state.items.map(item =>
        item.id === id ? { ...item, qty: item.qty - 1 } : item
      );
    } else {
      // Jika qty 1, hapus dari keranjang
      newItems = state.items.filter(item => item.id !== id);
    }

    const newTotal = newItems.reduce((sum, item) => sum + (item.price * item.qty), 0);
    return { items: newItems, totalAmount: newTotal };
  }),

  clearCart: () => set({ items: [], totalAmount: 0 })
}));