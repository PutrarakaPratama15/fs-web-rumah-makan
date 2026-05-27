"use client"; 

import { useCartStore } from "@/store/useCartStore";

interface ProductProps {
  id: string;
  product_name: string;
  price: number;
}

export default function ProductButton({ id, product_name, price }: ProductProps) {
  const addItem = useCartStore((state) => state.addItem);

  const handleAdd = () => {
    addItem({ id, product_name, price });
  };

  return (
    <button
      onClick={handleAdd}
      className="p-4 bg-white rounded-lg shadow hover:bg-blue-50 transition border border-gray-200 flex flex-col items-start w-full text-left active:scale-95"
    >
      <span className="font-semibold text-gray-700">{product_name}</span>
      <span className="text-blue-600 font-bold mt-2">
        Rp {price.toLocaleString('id-ID')}
      </span>
    </button>
  );
}