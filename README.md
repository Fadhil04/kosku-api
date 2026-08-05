# KosKu — Sistem Manajemen Kos Digital

KosKu adalah platform digital terintegrasi untuk mengelola properti kos-kosan secara profesional. Sistem ini dirancang untuk mempermudah pemilik kos (**Owner**) dalam mengelola properti, kamar, tenant, kontrak sewa, tagihan bulanan, pencatatan pembayaran, serta menangani pengaduan dari penghuni (**Tenant**).

Proyek ini terdiri dari dua bagian utama yang berada dalam satu workspace:
1. **`kosku-api` (Backend):** RESTful API Server dan Background Worker berbasis Node.js, Express, TypeScript, PostgreSQL (Prisma), Redis, dan BullMQ.
2. **`kosku-frontend` (Frontend):** Dashboard interaktif berbasis web menggunakan React, Vite, TypeScript, Tailwind CSS, dan React Query. Repositori nya bisa dilihat di link berikut: https://github.com/Fadhil04/kosku-frontend.git

---

## 🚀 Tech Stack

### Backend (`kosku-api`)
* **Runtime & Bahasa:** Node.js v20, TypeScript ~5.x
* **Web Framework:** Express.js v5.x
* **Database & ORM:** PostgreSQL, Prisma ORM v6.x
* **Task Queue & Cache:** BullMQ v5.x, Redis v7
* **Keamanan:** JWT (Access + Refresh Token), bcryptjs, express-rate-limit, Helmet, CORS
* **Email Service:** Nodemailer (SMTP)
* **Testing:** Jest, Supertest

### Frontend (`kosku-dashboard`)
* **Core:** React v19.x, Vite v8.x, TypeScript ~6.x
* **Styling:** Tailwind CSS v3.x
* **Data Fetching & Caching:** React Query (TanStack Query) v5.x
* **Routing:** React Router DOM v7.x
* **Form & Validation:** React Hook Form, Zod
* **Charts & Analytics:** Recharts v3.x
* **Icons:** Lucide React

---

## 📁 Struktur Workspace

```text
sistem-manajemen-kos/
├── kosku-api/                    # Backend API & background worker
│   ├── src/
│   │   ├── app.ts                # Entry point API server
│   │   ├── worker.ts             # Entry point background worker
│   │   ├── config/               # Prisma, Nodemailer, Env (Zod), Redis configs
│   │   ├── middleware/           # Auth, RBAC, error handler, rate limiter
│   │   ├── modules/              # Modul business logic (Auth, Properties, Rooms, dll)
│   │   ├── jobs/                 # Queue, Worker, dan Processor BullMQ
│   │   └── utils/                # Helper (lateFee, billGenerator, jwt, dll)
│   ├── prisma/                   # Schema database & migrasi
│   └── tests/                    # Integration & unit tests
│
└── kosku-dashboard/              # Frontend Dashboard (React + Vite)
    ├── src/
    │   ├── api/                  # Modul API request (menggunakan Axios)
    │   ├── components/           # Komponen UI umum & ui primitives
    │   ├── hooks/                # Hooks React custom (useAuth, dll)
    │   ├── lib/                  # Konfigurasi library (Axios client & interceptors)
    │   └── pages/                # Halaman dashboard (Dashboard, Properties, dll)
```

---

## 🛠️ Cara Menjalankan Lokal

### Prasyarat (Prerequisites)
* Node.js v20+
* Docker & Docker Compose (untuk menjalankan PostgreSQL & Redis lokal)
* npm atau yarn

---

### Langkah 1: Setup & Jalankan Backend (`kosku-api`)

1. Masuk ke folder backend:
   ```bash
   cd kosku-api
   ```
2. Pasang dependensi:
   ```bash
   npm install
   ```
3. Konfigurasi Environment:
   Salin file `.env.example` menjadi `.env` dan isi variabel dengan benar (konfigurasi default sudah disesuaikan dengan Docker Compose).
   ```bash
   cp .env.example .env
   ```
4. Jalankan PostgreSQL dan Redis (menggunakan Docker Compose):
   ```bash
   docker-compose up -d
   ```
5. Jalankan Migrasi Database & Seed Data:
   ```bash
   # Generate Prisma client
   npm run db:generate
   # Jalankan migrasi schema ke PostgreSQL
   npm run db:migrate
   # Seed data awal (owner & tenant default)
   npm run db:seed
   ```
6. Jalankan Server API & Background Worker:
   * **Menjalankan API Server (Terminal 1):**
     ```bash
     npm run dev
     ```
     Server API berjalan di `http://localhost:3000`.
   * **Menjalankan Background Worker (Terminal 2):**
     ```bash
     npm run dev:worker
     ```

#### 🔑 Akun Default Hasil Seed Data:
* **Owner (Pemilik Kos):** `owner@kosku.dev` | Password: `Password1!`
* **Tenant (Penghuni Kos):** `andi@kosku.dev` | Password: `Password1!`

---

### Langkah 2: Setup & Jalankan Frontend (`kosku-dashboard`)

1. Buka terminal baru dan masuk ke folder dashboard:
   ```bash
   cd kosku-dashboard
   ```
2. Pasang dependensi:
   ```bash
   npm install
   ```
3. Konfigurasi Environment:
   Pastikan terdapat file `.env` di dalam `kosku-dashboard/src/` (atau root `kosku-dashboard`):
   ```env
   VITE_API_URL=http://localhost:3000/api/v1
   ```
4. Jalankan server development frontend:
   ```bash
   npm run dev
   ```
   Aplikasi frontend dashboard dapat diakses melalui browser di `http://localhost:5173`.

---

## 🧪 Menjalankan Test (Backend)

Proyek ini dilengkapi dengan unit dan integration tests menggunakan Jest & Supertest:

```bash
# Jalankan semua unit & integration test secara serial
npm test

# Jalankan test beserta laporan coverage
npm run test:coverage
```

---

## 🛰️ API Endpoints (v1)

Semua request API diarahkan ke prefix `/api/v1`. Endpoint yang memerlukan autentikasi membutuhkan header `Authorization: Bearer <access_token>`.

### 1. Autentikasi (`/auth`)
| Method | Endpoint | Keterangan | Akses |
|--------|----------|------------|-------|
| POST | `/auth/register/owner` | Registrasi akun owner baru | Public |
| POST | `/auth/login` | Login (owner / tenant) | Public |
| POST | `/auth/refresh-token` | Tukar refresh token ke access token baru | Public |
| POST | `/auth/logout` | Revoke refresh token | Public |
| POST | `/auth/forgot-password` | Kirim email link reset password | Public |
| POST | `/auth/reset-password` | Simpan password baru menggunakan token email | Public |
| GET | `/auth/me` | Dapatkan profil user yang sedang login | Login |
| PUT | `/auth/me` | Perbarui profil (nama, no HP, avatar) | Login |
| PUT | `/auth/me/password` | Ubah password user | Login |

### 2. Properti & Kamar (`/properties` & `/rooms`)
| Method | Endpoint | Keterangan | Akses |
|--------|----------|------------|-------|
| POST | `/properties` | Tambah data properti kos baru | Owner |
| GET | `/properties` | List seluruh properti milik owner | Owner |
| GET | `/properties/:propertyId` | Detail properti + statistik okupansi | Owner |
| PUT | `/properties/:propertyId` | Edit data properti | Owner |
| DELETE | `/properties/:propertyId` | Hapus properti (hanya jika tak ada sewa aktif) | Owner |
| POST | `/properties/:propertyId/rooms` | Tambah kamar baru ke properti | Owner |
| GET | `/properties/:propertyId/rooms` | List seluruh kamar di properti tersebut | Owner |
| GET | `/properties/:propertyId/rooms/available` | List kamar kosong berstatus AVAILABLE | Owner |
| GET | `/rooms/:roomId` | Detail kamar beserta data kontrak terakhir | Owner |
| PUT | `/rooms/:roomId` | Edit data spesifikasi kamar | Owner |
| PATCH | `/rooms/:roomId/status` | Ubah status kamar (AVAILABLE / RESERVED / OCCUPIED / NEEDS_MAINTENANCE) | Owner |

### 3. Tenant & Kontrak (`/tenants` & `/contracts`)
| Method | Endpoint | Keterangan | Akses |
|--------|----------|------------|-------|
| POST | `/tenants` | Buat akun tenant baru | Owner |
| GET | `/tenants` | List seluruh database tenant milik owner | Owner |
| GET | `/tenants/:tenantId` | Detail profil tenant beserta histori sewa | Owner |
| PUT | `/tenants/:tenantId` | Edit data profil tenant | Owner |
| POST | `/contracts` | Buat kontrak baru (auto-generate bill bulanan + set kamar OCCUPIED) | Owner |
| GET | `/contracts` | List semua kontrak sewa | Owner |
| GET | `/contracts/expiring-soon` | Cek kontrak yang akan habis dalam N hari | Owner |
| GET | `/contracts/:contractId` | Detail kontrak sewa dan tagihan terkait | Owner |
| PATCH | `/contracts/:contractId/terminate` | Terminasi kontrak (auto-waive sisa tagihan + status deposit) | Owner |
| PATCH | `/contracts/:contractId/renew` | Perpanjang sewa kontrak | Owner |

### 4. Tagihan & Pembayaran (`/bills` & `/payments`)
| Method | Endpoint | Keterangan | Akses |
|--------|----------|------------|-------|
| GET | `/bills` | List tagihan (disertai denda late-fee real-time) | Owner + Tenant |
| GET | `/bills/overdue` | List tagihan yang sudah lewat jatuh tempo | Owner |
| GET | `/bills/:billId` | Detail tagihan | Owner + Tenant |
| PATCH | `/bills/:billId/discount` | Terapkan diskon potongan tagihan | Owner |
| PATCH | `/bills/:billId/waive` | Hapuskan tagihan (set status WAIVED) | Owner |
| POST | `/bills/:billId/payments` | Catat pembayaran (Idempotent menggunakan `idempotency_key`) | Owner |
| GET | `/bills/:billId/payments` | List transaksi pembayaran untuk tagihan tersebut | Owner |

### 5. Pengaduan (`/complaints`)
| Method | Endpoint | Keterangan | Akses |
|--------|----------|------------|-------|
| POST | `/complaints` | Kirim pengaduan baru | Tenant |
| GET | `/complaints` | List pengaduan (scoped berdasarkan user role) | Owner + Tenant |
| GET | `/complaints/summary` | Statistik pengaduan berdasarkan kategori & status | Owner |
| GET | `/complaints/:complaintId` | Detail pengaduan beserta thread respons diskusi | Owner + Tenant |
| PATCH | `/complaints/:complaintId/status` | Ubah status pengaduan (OPEN -> IN_PROGRESS -> RESOLVED -> CLOSED) | Owner |
| POST | `/complaints/:complaintId/responses` | Tambah balasan/tanggapan baru di thread diskusi | Owner + Tenant |

### 6. Laporan Keuangan & Hunian (`/reports`)
| Method | Endpoint | Keterangan | Akses |
|--------|----------|------------|-------|
| GET | `/reports/dashboard` | Ringkasan performa finansial & okupansi global | Owner |
| GET | `/reports/revenue` | Laporan pendapatan bulanan & grafik tren 6 bulan | Owner |
| GET | `/reports/occupancy` | Tingkat persentase hunian kamar sepanjang tahun | Owner |
| GET | `/reports/payment-behavior` | Skor kedisiplinan bayar tenant (0–100) | Owner |
| GET | `/reports/complaints` | Statistik keluhan per periode | Owner |

### 7. Pengembang & Dev-Tools (`/admin`)
| Method | Endpoint | Keterangan | Akses |
|--------|----------|------------|-------|
| POST | `/admin/backfill/tenant-owner` | Sinkronisasi database tenant lama yang belum terelasi dengan owner pembuatnya | Owner |
| POST | `/admin/trigger/bill-reminders` | Trigger pengiriman email reminder tagihan manual | Owner |
| POST | `/admin/trigger/monthly-bills` | Trigger generate tagihan bulanan baru untuk bulan depan | Owner |
| POST | `/admin/trigger/expiring-contracts` | Trigger cek otomatis kontrak yang akan segera habis | Owner |

---

## 🏗️ Arsitektur Sistem

Sistem KosKu dirancang menggunakan **arsitektur decoupled** dengan memisahkan beban komputasi server REST API utama dari proses pemrosesan tugas latar belakang (background jobs):

```text
               ┌──────────────────────┐
               │  Frontend Dashboard  │
               │  (React / Vite Web)  │
               └──────────┬───────────┘
                          │ HTTPS REST API
                          ▼
               ┌──────────────────────┐
               │    Express API       │
               │    (app.ts)          │
               └────┬──────────────┬──┘
                    │              │
         Prisma ORM │              │ BullMQ (Redis)
                    ▼              ▼
           ┌──────────┐      ┌──────────┐
           │PostgreSQL│      │  Redis   │
           │ Database │      │  Broker  │
           └──────────┘      └────┬─────┘
                                  │ consume
                                  ▼
                             ┌──────────┐
                             │  Worker  │
                             │(worker.ts│
                             └────┬─────┘
                                  │ SMTP
                                  ▼
                             [Nodemailer]
```

### Pemrosesan Latar Belakang (BullMQ & Redis)
Untuk menjaga agar response time API tetap instan dan lancar, tugas-tugas berat diolah secara asinkron oleh **Background Worker** (`worker.ts`) dengan **BullMQ** dan **Redis**:
1. **Email Queue (`email-notifications`):** Pengiriman email notifikasi tagihan dibuat terpisah (concurrency 5) dengan fitur retry exponential backoff sehingga jika mail server sibuk, transaksi utama di server tidak gagal.
2. **Scheduler Queue (`scheduled-tasks`):** Mengelola jobs berulang seperti:
   * **Pembuatan Tagihan Bulanan Otomatis:** Berjalan setiap bulan untuk menerbitkan tagihan bagi semua kontrak sewa yang berstatus `ACTIVE`.
   * **Reminder Tagihan Terjadwal:** Cek otomatis data jatuh tempo setiap hari untuk mengirim email pengingat awal (H-7), mendesak (H-3), notifikasi terlambat (H+1), dan eskalasi ke owner (H+7).
   * **Pemberitahuan Kontrak Berakhir:** Cek otomatis kontrak sewa yang akan berakhir tepat 30 hari lagi untuk mengabari tenant dan owner.

### Konsistensi Data & Idempotensi
* **Prisma Transaction:** Semua logika kompleks (seperti pembuatan kontrak yang harus mengubah status kamar dan menerbitkan tagihan masa depan sekaligus) dibungkus menggunakan `prisma.$transaction()` untuk mencegah inkonsistensi data jika terjadi kegagalan di tengah proses.
* **Idempotency Payment Key:** Request pencatatan pembayaran mewajibkan key unik di header/body request untuk mencegah pencatatan berganda akibat retry koneksi jaringan yang kurang stabil.
