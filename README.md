# 🛒 Warung POS & Management System

Sebuah sistem *Point of Sales* (POS) *Full-Stack* yang dirancang khusus untuk operasional warung makan/restoran. Sistem ini tidak hanya berfokus pada pencatatan transaksi, tetapi juga pada **Integritas Arus Kas (Cash Flow)**, rekonsiliasi uang fisik per *shift* kasir, dan pelaporan audit finansial untuk *Owner*.

## 🚀 Teknologi yang Digunakan

- **Frontend:** Next.js 14 (App Router), React, Tailwind CSS
- **Backend/Database:** Supabase (PostgreSQL)
- **Authentication:** Supabase Auth
- **Keamanan:** Row Level Security (RLS) & Remote Procedure Call (RPC)
- **Deployment:** Vercel

## ✨ Fitur Utama

### 1. Kasir (Point of Sales)
- Tarik menu secara *real-time* dari *database*.
- Kalkulasi keranjang otomatis.
- Pemisahan metode pembayaran (**CASH** dan **QRIS**).
- Pencatatan pengeluaran kas kecil (beli es batu, bensin, dll) yang memotong saldo laci.

### 2. Manajemen Shift (Sistem Keamanan Uang)
- Kasir wajib memasukkan **Modal Awal** laci saat *login*.
- Kasir wajib menghitung dan menyetor **Uang Fisik** saat *logout*.
- Sistem secara otomatis menghitung Varian Kas (Selisih) untuk mencegah manipulasi atau salah kembalian.

### 3. Ruang Kontrol Owner (Admin Dashboard)
- Visibilitas murni 100% terhadap arus kas secara *real-time*.
- Laporan investigasi *shift* harian (menampilkan selisih minus/plus dari tiap kasir).
- **Lembar Audit Detail:** Menampilkan rincian produk yang terjual (dipisah per metode pembayaran) dan daftar nota pengeluaran kas kecil per *shift*.
- **Manajemen Menu:** CRUD menu dengan sistem *Soft-Delete* (Tersedia/Habis) agar tidak merusak riwayat transaksi masa lalu.

---

## 🛠️ Panduan Instalasi (Local Development)

Ikuti langkah-langkah di bawah ini untuk menjalankan aplikasi ini di komputer lokal.

1. clone repositori '''bash
git clone [https://github.com/USERNAME_LU/fs-web-rumah-makan.git](https://github.com/USERNAME_LU/fs-web-rumah-makan.git)
cd fs-web-rumah-makan

2. install dependensi
npm install

3. Pengaturan Environment Variables
NEXT_PUBLIC_SUPABASE_URL=https://[ID_PROJECT_ANDA].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[ANON_KEY_ANDA]

4. persiapan database
Sistem ini membutuhkan skema database relasional. Anda wajib membuat tabel-tabel berikut di Supabase SQL Editor:
-user_roles (Tabel otorisasi dengan constraint admin atau cashier)
-products (Tabel menu dengan kebijakan RLS)
-shifts (Tabel rekam jejak modal dan setoran kasir)
-transactions & transaction_items (Tabel relasional penjualan)
-expenses (Tabel kas kecil)

5. jalankan aplikasi
npm run dev
