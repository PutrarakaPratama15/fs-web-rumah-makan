import { create } from 'zustand';

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
    const existingItem = state.items.find(item => item.id === product.id);
    let newItems;
    
    if (existingItem) {
      newItems = state.items.map(item =>
        item.id === product.id ? { ...item, qty: item.qty + 1 } : item
      );
    } else {
      newItems = [...state.items, { ...product, qty: 1 }];
    }

    const newTotal = newItems.reduce((sum, item) => sum + (item.price * item.qty), 0);
    return { items: newItems, totalAmount: newTotal };
  }),

  removeItem: (id) => set((state) => {
    const existingItem = state.items.find(item => item.id === id);
    if (!existingItem) return state;

    let newItems;
    if (existingItem.qty > 1) {
      newItems = state.items.map(item =>
        item.id === id ? { ...item, qty: item.qty - 1 } : item
      );
    } else {
      newItems = state.items.filter(item => item.id !== id);
    }

    const newTotal = newItems.reduce((sum, item) => sum + (item.price * item.qty), 0);
    return { items: newItems, totalAmount: newTotal };
  }),

  clearCart: () => set({ items: [], totalAmount: 0 })
}));