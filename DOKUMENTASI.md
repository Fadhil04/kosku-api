# KosKu — Dokumentasi Lengkap Sistem Manajemen Kos

> Dokumentasi ini mencakup arsitektur, fitur, database, API, dan panduan pengembangan untuk proyek **KosKu**, sebuah sistem manajemen kos berbasis web yang dibangun sebagai proyek portofolio fullstack.

---

## Daftar Isi

1. [Gambaran Umum Proyek](#1-gambaran-umum-proyek)
2. [Arsitektur Sistem](#2-arsitektur-sistem)
3. [Tech Stack](#3-tech-stack)
4. [Struktur Folder](#4-struktur-folder)
5. [Database Schema](#5-database-schema)
6. [API Backend — Endpoint Lengkap](#6-api-backend--endpoint-lengkap)
7. [Background Jobs & Queue](#7-background-jobs--queue)
8. [Keamanan & Middleware](#8-keamanan--middleware)
9. [Konfigurasi Environment](#9-konfigurasi-environment)
10. [Cara Menjalankan (Development)](#10-cara-menjalankan-development)
11. [Testing](#11-testing)
12. [Deployment (Docker)](#12-deployment-docker)
13. [Frontend — Panduan Pengembangan](#13-frontend--panduan-pengembangan)
14. [Desain Pola & Keputusan Teknis](#14-desain-pola--keputusan-teknis)

---

## 1. Gambaran Umum Proyek

**KosKu** adalah platform digital untuk pemilik dan penghuni kos. Sistem ini memungkinkan pemilik kos mengelola properti, kamar, penghuni, kontrak sewa, tagihan, dan pembayaran dari satu dashboard terpusat. Penghuni dapat melihat tagihan mereka, melakukan pengaduan, dan melacak status pembayaran.

### Aktor dalam Sistem

| Aktor | Deskripsi |
|-------|-----------|
| **Owner** | Pemilik kos — mengelola properti, kamar, kontrak, tagihan, dan laporan |
| **Tenant** | Penghuni kos — melihat tagihan sendiri, mengajukan komplain |
| **System** | Background worker — mengirim reminder email, generate tagihan bulanan |

### Alur Utama (Happy Path)

```
Owner daftar → Tambah Properti → Tambah Kamar → Tambah Tenant
→ Buat Kontrak (auto-generate semua tagihan) → Terima Pembayaran
→ Lihat Laporan
```

---

## 2. Arsitektur Sistem

Sistem ini terdiri dari **tiga komponen utama** yang berjalan secara terpisah:

```
┌─────────────────────────────────────────────────────────┐
│                      CLIENT                             │
│            (Browser / Mobile App / Frontend)            │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTPS REST API
                       ▼
┌─────────────────────────────────────────────────────────┐
│                   API SERVER                            │
│            src/app.ts  (Express.js)                     │
│  Auth │ Properties │ Rooms │ Tenants │ Contracts        │
│  Bills │ Payments │ Complaints │ Reports │ Admin        │
└──────────┬──────────────────────────────┬───────────────┘
           │                              │
           │ Prisma ORM                   │ BullMQ
           ▼                              ▼
┌──────────────────┐          ┌───────────────────────────┐
│   PostgreSQL 16  │          │       Redis 7             │
│   (Data Store)   │          │  (Queue & Job Store)      │
└──────────────────┘          └─────────────┬─────────────┘
                                            │ consume jobs
                                            ▼
                               ┌────────────────────────────┐
                               │       WORKER               │
                               │   src/worker.ts            │
                               │  Email Worker              │
                               │  Scheduler Worker          │
                               │         │                  │
                               │         ▼                  │
                               │   Nodemailer (SMTP)        │
                               └────────────────────────────┘
```

API Server dan Worker adalah **dua proses Node.js terpisah**, di-deploy sebagai dua service berbeda (misalnya di Railway), namun berbagi database dan Redis yang sama.

---

## 3. Tech Stack

### Backend

| Kategori | Teknologi | Versi | Kegunaan |
|----------|-----------|-------|---------|
| Runtime | Node.js | 20 | JavaScript runtime |
| Bahasa | TypeScript | ^5.9 | Type safety |
| Framework | Express.js | ^5.2 | HTTP server |
| ORM | Prisma | ^6.19 | Database access layer |
| Database | PostgreSQL | 16 | Penyimpanan data utama |
| Queue | BullMQ | ^5.80 | Job queue berbasis Redis |
| Cache/Broker | Redis | 7 | Job broker + token store |
| Auth | JSON Web Token | ^9.0 | Access + refresh token |
| Hashing | bcryptjs | ^3.0 | Password hashing |
| Email | Nodemailer | ^9.0 | SMTP email sender |
| Validasi | Zod | ^4.4 | Schema validation (request body) |
| Rate Limit | express-rate-limit | ^8.6 | DDoS & brute force protection |
| Security | Helmet | ^8.3 | HTTP security headers |
| Logging | Morgan | ^1.11 | HTTP request logging |
| CORS | cors | ^2.8 | Cross-origin resource sharing |
| Testing | Jest + Supertest | ^30 | Unit & integration testing |

### Frontend (Direncanakan / Terpisah)

Proyek ini adalah **backend-only**. Frontend dibangun di repository terpisah (`kosku-web` atau sejenisnya) menggunakan stack berikut yang direkomendasikan agar kompatibel dengan API ini:

| Kategori | Rekomendasi |
|----------|-------------|
| Framework | React / Next.js / Vue 3 |
| HTTP Client | Axios atau Fetch API |
| State Management | Zustand / Pinia / Redux Toolkit |
| Form Validation | React Hook Form + Zod |
| UI Component | Shadcn/ui, Tailwind CSS, atau Ant Design |
| Auth | JWT stored in httpOnly cookie atau memory |

---

## 4. Struktur Folder

```
kosku-api/
├── src/
│   ├── app.ts                    # Entry point API server
│   ├── worker.ts                 # Entry point background worker
│   ├── config/
│   │   ├── database.ts           # Singleton PrismaClient
│   │   ├── email.ts              # Nodemailer transporter
│   │   ├── env.ts                # Validasi env variable (Zod)
│   │   └── redis.ts              # Redis connection (multi-mode)
│   ├── middleware/
│   │   ├── authenticate.ts       # JWT verification, inject req.context
│   │   ├── authorize.ts          # Role-based access control
│   │   ├── errorHandler.ts       # Centralized error handler
│   │   └── rateLimiter.ts        # Rate limiting per endpoint group
│   ├── modules/
│   │   ├── auth/                 # Register, login, refresh, reset password
│   │   ├── properties/           # CRUD properti
│   │   ├── rooms/                # CRUD kamar, state machine status
│   │   ├── tenants/              # CRUD penghuni
│   │   ├── contracts/            # Buat/terminasi/perpanjang kontrak
│   │   ├── bills/                # Tagihan bulanan, diskon, waive
│   │   ├── payments/             # Catat pembayaran (idempotent)
│   │   ├── complaints/           # Pengaduan penghuni + thread respons
│   │   ├── reports/              # Laporan revenue, occupancy, dll
│   │   └── admin/                # Trigger job manual (dev/testing)
│   ├── jobs/
│   │   ├── queues/
│   │   │   ├── email.queue.ts    # BullMQ queue untuk email
│   │   │   └── scheduler.queue.ts # BullMQ queue untuk scheduled tasks
│   │   ├── workers/
│   │   │   ├── email.worker.ts   # Konsumer email queue (concurrency 5)
│   │   │   └── scheduler.worker.ts # Konsumer scheduler queue (concurrency 1)
│   │   └── processors/
│   │       ├── billReminder.processor.ts      # Logic pengiriman reminder tagihan
│   │       ├── contractExpiry.processor.ts    # Logic notif kontrak akan berakhir
│   │       └── monthlyBillGenerator.processor.ts # Generate tagihan bulan depan
│   └── utils/                    # Helper: pagination, lateFee, billGenerator, jwt, dll
├── prisma/
│   ├── schema.prisma             # Database schema (single source of truth)
│   ├── migrations/               # SQL migration history
│   └── seed.ts / seed.js         # Data awal untuk development
├── Dockerfile                    # Multi-stage build untuk API server
├── Dockerfile.worker             # Multi-stage build untuk worker
├── docker-compose.yml            # PostgreSQL + Redis untuk dev lokal
└── jest.config.cjs               # Jest configuration
```

Setiap modul mengikuti pola yang konsisten:
```
modules/<nama>/
  ├── <nama>.routes.ts      → Router Express + wiring middleware
  ├── <nama>.controller.ts  → Parse request, panggil service
  ├── <nama>.service.ts     → Business logic + akses database
  └── <nama>.schema.ts      → Zod schema untuk validasi input
```

---

## 5. Database Schema

### Diagram Relasi (ERD Ringkas)

```
Owner ──< Property ──< Room ──< Contract >── Tenant
                                    │
                                    ├──< Bill ──< Payment
                                    │
                              Room ─┤
                                    └──< Complaint ──< ComplaintResponse
```

### Model Detail

#### `owners` — Pemilik Kos

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| `id` | UUID | Primary key |
| `email` | String, unique | Login credential |
| `password_hash` | String | bcrypt hash |
| `full_name` | String | Nama lengkap |
| `phone_number` | String? | Nomor HP |
| `avatar_url` | String? | URL foto profil |
| `is_verified` | Boolean | Status verifikasi email |
| `is_active` | Boolean | Status akun aktif |
| `deleted_at` | DateTime? | Soft delete |

#### `tenants` — Penghuni Kos

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| `id` | UUID | Primary key |
| `email` | String, unique | Login credential |
| `password_hash` | String | bcrypt hash |
| `full_name` | String | Nama lengkap |
| `phone_number` | String? | Nomor HP |
| `id_card_number` | String? | Nomor KTP/identitas |
| `id_card_url` | String? | Foto KTP |
| `emergency_contact_name` | String? | Nama kontak darurat |
| `emergency_contact_phone` | String? | HP kontak darurat |
| `is_active` | Boolean | Status akun |
| `deleted_at` | DateTime? | Soft delete |

#### `properties` — Properti / Gedung Kos

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| `id` | UUID | Primary key |
| `owner_id` | UUID | FK ke owners |
| `name` | String | Nama properti |
| `address` | String | Alamat |
| `city` | String | Kota |
| `province` | String | Provinsi |
| `postal_code` | String? | Kode pos |
| `description` | String? | Deskripsi |
| `rules` | String? | Peraturan kos |
| `facilities` | JSON | Array fasilitas (["WiFi", "AC", ...]) |
| `photos` | JSON | Array URL foto |
| `is_active` | Boolean | Status aktif |
| `deleted_at` | DateTime? | Soft delete |

#### `rooms` — Kamar

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| `id` | UUID | Primary key |
| `property_id` | UUID | FK ke properties |
| `room_number` | String | Nomor kamar (unik per properti) |
| `floor` | Int? | Lantai |
| `type` | String | Tipe kamar (misal: "Standard", "VIP") |
| `size_sqm` | Decimal? | Luas (m²) |
| `base_price` | Decimal | Harga dasar per bulan |
| `facilities` | JSON | Fasilitas kamar |
| `photos` | JSON | Foto kamar |
| `status` | Enum RoomStatus | AVAILABLE / RESERVED / OCCUPIED / NEEDS_MAINTENANCE |
| `notes` | String? | Catatan |
| `deleted_at` | DateTime? | Soft delete |

**Status Kamar (State Machine):**
```
AVAILABLE → RESERVED → OCCUPIED → NEEDS_MAINTENANCE → AVAILABLE
                ↑                          ↓
                └──────────────────────────┘
```

#### `contracts` — Kontrak Sewa

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| `id` | UUID | Primary key |
| `room_id` | UUID | FK ke rooms |
| `tenant_id` | UUID | FK ke tenants |
| `owner_id` | UUID | FK ke owners |
| `start_date` | Date | Tanggal mulai kontrak |
| `end_date` | Date | Tanggal berakhir kontrak |
| `monthly_rent` | Decimal | Harga sewa bulanan |
| `deposit_amount` | Decimal | Jumlah deposit |
| `deposit_status` | Enum | UNPAID / PAID / REFUNDED |
| `billing_date` | Int | Tanggal jatuh tempo setiap bulan (1–28) |
| `additional_charges` | JSON | Biaya tambahan (listrik, air, dll) |
| `status` | Enum ContractStatus | PENDING / ACTIVE / TERMINATED / EXPIRED |
| `termination_date` | Date? | Tanggal terminasi (jika diterminasi) |
| `termination_reason` | String? | Alasan terminasi |
| `terminated_by` | UUID? | ID yang melakukan terminasi |
| `notes` | String? | Catatan |

**Saat kontrak dibuat**, sistem otomatis:
1. Mengubah status kamar → `OCCUPIED`
2. Men-generate **semua tagihan** untuk seluruh masa kontrak dalam satu database transaction
3. Mengirim email konfirmasi ke penghuni

#### `bills` — Tagihan Bulanan

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| `id` | UUID | Primary key |
| `contract_id` | UUID | FK ke contracts |
| `tenant_id` | UUID | FK ke tenants |
| `room_id` | UUID | FK ke rooms |
| `property_id` | UUID | FK ke properties |
| `period_month` | Int | Bulan tagihan (1–12) |
| `period_year` | Int | Tahun tagihan |
| `due_date` | Date | Tanggal jatuh tempo |
| `base_rent` | Decimal | Harga sewa pokok |
| `additional_charges` | JSON | Biaya tambahan snapshot |
| `discount_amount` | Decimal | Jumlah diskon |
| `discount_reason` | String? | Alasan diskon |
| `total_amount` | Decimal | Total tagihan (sebelum diskon) |
| `late_fee_percentage` | Decimal | % denda keterlambatan per hari (default 2%) |
| `late_fee_max_percentage` | Decimal | Max denda (default 10%) |
| `status` | Enum BillStatus | UNPAID / PARTIALLY_PAID / PAID / WAIVED |
| `paid_at` | DateTime? | Waktu lunas |

**Catatan penting:** Denda keterlambatan **tidak disimpan di database**, melainkan dihitung secara real-time setiap kali data tagihan diambil. Ini memastikan nilai denda selalu akurat.

#### `payments` — Catatan Pembayaran

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| `id` | UUID | Primary key |
| `bill_id` | UUID | FK ke bills |
| `idempotency_key` | String, unique | Mencegah double payment |
| `amount` | Decimal | Jumlah yang dibayar |
| `payment_method` | Enum | CASH / BANK_TRANSFER / EWALLET / OTHER |
| `payment_date` | Date | Tanggal pembayaran |
| `reference_number` | String? | Nomor referensi transfer |
| `proof_url` | String? | URL bukti bayar |
| `notes` | String? | Catatan |
| `recorded_by` | UUID | ID owner yang mencatat |

#### `complaints` — Pengaduan Penghuni

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| `id` | UUID | Primary key |
| `tenant_id` | UUID | FK ke tenants |
| `property_id` | UUID | FK ke properties |
| `room_id` | UUID | FK ke rooms |
| `title` | String | Judul pengaduan |
| `description` | String | Deskripsi detail |
| `category` | Enum | FACILITY_DAMAGE / NEIGHBOR_DISTURBANCE / CLEANLINESS / SECURITY / OTHER |
| `priority` | Enum | LOW / MEDIUM / HIGH / URGENT |
| `status` | Enum | OPEN → IN_PROGRESS → RESOLVED → CLOSED |
| `photos` | JSON | Array URL foto bukti |
| `resolved_at` | DateTime? | Waktu diselesaikan |

#### Model Pendukung

| Model | Kegunaan |
|-------|----------|
| `ComplaintResponse` | Thread balasan pada pengaduan (owner & tenant bisa balas) |
| `RefreshToken` | Token refresh yang aktif per user (rolling refresh) |
| `PasswordResetToken` | Token satu-kali untuk reset password |
| `AuditLog` | Rekam jejak semua aksi penting di sistem |

#### AuditLog — Audit Trail Lengkap

Setiap aksi penting dicatat di tabel `audit_logs`, termasuk:
- Login / logout
- Buat / terminasi / perpanjang kontrak
- Catat pembayaran
- Ubah status kamar
- Beri diskon / waive tagihan
- Ubah status komplain

---

## 6. API Backend — Endpoint Lengkap

**Base URL:** `http://localhost:3000/api/v1`

**Format Response Sukses:**
```json
{
  "success": true,
  "message": "...",
  "data": { ... }
}
```

**Format Response Error:**
```json
{
  "success": false,
  "message": "Pesan error",
  "error": { "code": "ERROR_CODE" }
}
```

**Autentikasi:** Semua endpoint yang perlu login menggunakan header:
```
Authorization: Bearer <access_token>
```

---

### 6.1 Auth (`/auth`)

| Method | Endpoint | Akses | Deskripsi |
|--------|----------|-------|-----------|
| POST | `/register/owner` | Public | Daftarkan akun owner baru |
| POST | `/login` | Public | Login (owner atau tenant), kirim `role` di body |
| POST | `/refresh-token` | Public | Tukar refresh token lama dengan token pair baru |
| POST | `/logout` | Public | Revoke refresh token |
| POST | `/forgot-password` | Public | Kirim email link reset password |
| POST | `/reset-password` | Public | Set password baru menggunakan token dari email |
| GET | `/me` | Login | Lihat profil sendiri |
| PUT | `/me` | Login | Update profil (nama, no HP, avatar) |
| PUT | `/me/password` | Login | Ganti password |

**Login Request Body:**
```json
{
  "email": "owner@example.com",
  "password": "password123",
  "role": "owner"   // "owner" atau "tenant"
}
```

**Login Response:**
```json
{
  "access_token": "eyJhbGci...",
  "refresh_token": "eyJhbGci...",
  "user": { "id": "...", "email": "...", "role": "owner" }
}
```

> Rate limiting: Login 5 percobaan gagal / 15 menit. Forgot password 3 request / jam.

---

### 6.2 Properties (`/properties`)

> Semua endpoint memerlukan login sebagai **owner**.

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| POST | `/properties` | Buat properti baru |
| GET | `/properties` | List semua properti milik owner |
| GET | `/properties/:propertyId` | Detail properti + statistik kamar |
| PUT | `/properties/:propertyId` | Update data properti |
| DELETE | `/properties/:propertyId` | Soft delete (gagal jika ada kontrak aktif) |

**Create/Update Property Body:**
```json
{
  "name": "Kos Sejahtera",
  "address": "Jl. Mawar No. 10",
  "city": "Bandung",
  "province": "Jawa Barat",
  "postal_code": "40115",
  "description": "Kos strategis dekat kampus",
  "rules": "Tidak boleh bawa hewan peliharaan",
  "facilities": ["WiFi", "AC", "Parkir Motor"],
  "photos": ["https://..."]
}
```

---

### 6.3 Rooms (`/properties/:propertyId/rooms`)

> Semua endpoint memerlukan login sebagai **owner**.

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| POST | `/` | Buat kamar baru di properti ini |
| GET | `/` | List kamar (filter: status, lantai, tipe, range harga) |
| GET | `/available` | Hanya kamar berstatus AVAILABLE |
| GET | `/:roomId` | Detail kamar + 5 kontrak terakhir + statistik |
| PUT | `/:roomId` | Update data kamar |
| PATCH | `/:roomId/status` | Ubah status kamar (state machine) |
| DELETE | `/:roomId` | Soft delete |

**Create Room Body:**
```json
{
  "room_number": "A101",
  "floor": 1,
  "type": "Standard",
  "size_sqm": 12.5,
  "base_price": 1500000,
  "facilities": ["AC", "Lemari", "Meja Belajar"],
  "photos": ["https://..."],
  "notes": "Kamar menghadap timur"
}
```

**Update Status Body:**
```json
{
  "status": "AVAILABLE",
  "notes": "Selesai maintenance"
}
```

---

### 6.4 Tenants (`/tenants`)

> Semua endpoint memerlukan login sebagai **owner**.

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| POST | `/tenants` | Buat akun penghuni baru |
| GET | `/tenants` | List penghuni |
| GET | `/tenants/:tenantId` | Detail penghuni |
| PUT | `/tenants/:tenantId` | Update data penghuni |

**Create Tenant Body:**
```json
{
  "email": "budi@gmail.com",
  "password": "password123",
  "full_name": "Budi Santoso",
  "phone_number": "08123456789",
  "id_card_number": "3271...",
  "id_card_url": "https://...",
  "emergency_contact_name": "Siti Santoso",
  "emergency_contact_phone": "08987654321"
}
```

---

### 6.5 Contracts (`/contracts`)

> Semua endpoint memerlukan login sebagai **owner**.

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| POST | `/contracts` | Buat kontrak baru + auto-generate semua tagihan |
| GET | `/contracts` | List kontrak (filter: room_id, tenant_id, status, property_id) |
| GET | `/contracts/expiring-soon` | Kontrak yang akan berakhir dalam N hari |
| GET | `/contracts/:contractId` | Detail kontrak + semua tagihan |
| PATCH | `/contracts/:contractId/terminate` | Terminasi kontrak |
| PATCH | `/contracts/:contractId/renew` | Perpanjang kontrak |

**Create Contract Body:**
```json
{
  "room_id": "uuid-kamar",
  "tenant_id": "uuid-penghuni",
  "start_date": "2026-08-01",
  "end_date": "2027-07-31",
  "monthly_rent": 1500000,
  "deposit_amount": 1500000,
  "billing_date": 5,
  "additional_charges": [
    { "name": "Listrik", "amount": 100000 },
    { "name": "Air", "amount": 50000 }
  ],
  "notes": "Kontrak 1 tahun"
}
```

**Saat kontrak berhasil dibuat:**
- Status kamar berubah → `OCCUPIED`
- Semua tagihan untuk masa kontrak dibuat otomatis dalam satu transaksi DB
- Email konfirmasi dikirim ke penghuni

**Terminate Contract Body:**
```json
{
  "termination_date": "2026-10-01",
  "termination_reason": "Penghuni pindah kota",
  "deposit_action": "REFUND_FULL"  // REFUND_FULL | REFUND_PARTIAL | NO_REFUND
}
```

Saat terminasi:
- Status kamar berubah → `NEEDS_MAINTENANCE`
- Tagihan yang belum jatuh tempo setelah tanggal terminasi di-WAIVE otomatis

**Renew Contract Body:**
```json
{
  "new_end_date": "2028-07-31",
  "new_monthly_rent": 1600000
}
```

---

### 6.6 Bills (`/bills`)

> Owner melihat semua tagihan propertinya. Tenant hanya melihat tagihan sendiri.

| Method | Endpoint | Akses | Deskripsi |
|--------|----------|-------|-----------|
| GET | `/bills` | Owner + Tenant | List tagihan (filter: status, bulan, tahun, dll) |
| GET | `/bills/overdue` | Owner | Tagihan jatuh tempo yang belum dibayar |
| GET | `/bills/:billId` | Owner + Tenant | Detail tagihan + info denda real-time |
| PATCH | `/bills/:billId/discount` | Owner | Terapkan diskon |
| PATCH | `/bills/:billId/waive` | Owner | Hapuskan tagihan (WAIVED) |

**Response tagihan menyertakan info denda real-time:**
```json
{
  "id": "...",
  "total_amount": 1650000,
  "amount_after_discount": 1650000,
  "late_fee_info": {
    "days_overdue": 5,
    "late_fee_percentage": 10,
    "late_fee_amount": 165000,
    "is_overdue": true
  },
  "final_amount": 1815000
}
```

**Apply Discount Body:**
```json
{
  "discount_amount": 100000,
  "discount_reason": "Keringanan bulan Ramadan"
}
```

---

### 6.7 Payments (`/bills/:billId/payments`)

> Semua endpoint memerlukan login sebagai **owner**.

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| POST | `/bills/:billId/payments` | Catat pembayaran (idempotent) |
| GET | `/bills/:billId/payments` | List semua pembayaran untuk tagihan ini |
| GET | `/payments/:paymentId` | Detail satu pembayaran |

**Create Payment Body:**
```json
{
  "idempotency_key": "uuid-unik-per-transaksi",
  "amount": 1500000,
  "payment_method": "BANK_TRANSFER",
  "payment_date": "2026-08-05",
  "reference_number": "TF202608051234",
  "proof_url": "https://...",
  "notes": "Transfer dari BCA"
}
```

> `idempotency_key` harus unik per transaksi. Jika request dikirim ulang dengan key yang sama, server mengembalikan data yang sudah ada tanpa membuat duplikat. Field `is_duplicate_request: true` akan muncul di response.

**Sistem mendukung partial payment** — tagihan berubah ke `PARTIALLY_PAID` jika dibayar sebagian, dan `PAID` jika lunas.

---

### 6.8 Complaints (`/complaints`)

| Method | Endpoint | Akses | Deskripsi |
|--------|----------|-------|-----------|
| POST | `/complaints` | Tenant | Buat pengaduan baru |
| GET | `/complaints` | Owner + Tenant | List pengaduan (scoped per role) |
| GET | `/complaints/summary` | Owner | Statistik pengaduan per kategori/status |
| GET | `/complaints/:complaintId` | Owner + Tenant | Detail + thread respons |
| PATCH | `/complaints/:complaintId/status` | Owner | Ubah status pengaduan |
| POST | `/complaints/:complaintId/responses` | Owner + Tenant | Tambah balasan |

**Create Complaint Body (Tenant):**
```json
{
  "title": "AC kamar tidak dingin",
  "description": "AC sudah tidak dingin sejak 3 hari lalu...",
  "category": "FACILITY_DAMAGE",
  "priority": "HIGH",
  "photos": ["https://..."]
}
```

**Status Pengaduan (State Machine):**
```
OPEN → IN_PROGRESS → RESOLVED → CLOSED
```

---

### 6.9 Reports (`/reports`)

> Semua endpoint memerlukan login sebagai **owner**. Rate limit: 20 request/menit.

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/reports/dashboard` | Ringkasan lintas properti (occupancy, revenue, open items) |
| GET | `/reports/revenue` | Laporan pendapatan bulanan + tren 6 bulan |
| GET | `/reports/occupancy` | Tingkat hunian per bulan dalam setahun |
| GET | `/reports/payment-behavior` | Skor pembayaran per penghuni (0–100) |
| GET | `/reports/complaints` | Statistik pengaduan per periode |
| GET | `/reports/expiring-contracts` | Kontrak yang akan berakhir dalam N hari |

**Dashboard Response contoh:**
```json
{
  "total_properties": 2,
  "total_rooms": 20,
  "overall_occupancy_rate": 85.0,
  "current_month_revenue": {
    "billed": 30000000,
    "collected": 25500000,
    "collection_rate": 85.0
  },
  "total_active_contracts": 17,
  "open_complaints": 3,
  "overdue_bills": 5,
  "contracts_expiring_30_days": 2
}
```

---

### 6.10 Admin (`/admin`)

> Untuk keperluan development dan testing. Memerlukan login sebagai **owner**.

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| POST | `/admin/trigger/bill-reminders` | Trigger manual job reminder tagihan |
| POST | `/admin/trigger/monthly-bills` | Trigger manual generate tagihan bulan depan |
| POST | `/admin/trigger/expiring-contracts` | Trigger manual cek kontrak mau berakhir |

---

### 6.11 Health Check

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/health` | Status server, timestamp, environment |

---

## 7. Background Jobs & Queue

Sistem menggunakan **BullMQ** dengan Redis sebagai backend untuk menjalankan tugas-tugas asinkron.

### Dua Queue Utama

#### `email-notifications` Queue
- Concurrency: **5** (5 email diproses paralel)
- Retry: 3 kali dengan exponential backoff (mulai 1 menit)
- Completed jobs disimpan: 7 hari
- Failed jobs disimpan: 30 hari

| Job Name | Trigger | Aksi |
|----------|---------|------|
| `send-bill-reminder` | Dari scheduler | Kirim email reminder tagihan ke penghuni |
| `send-contract-expiry-notice` | Dari scheduler | Kirim notifikasi kontrak akan berakhir |

#### `scheduled-tasks` Queue
- Concurrency: **1** (berjalan satu per satu, berurutan)
- Retry: 2 kali

| Job Name | Jadwal | Aksi |
|----------|--------|------|
| `generate-monthly-bills` | Tiap bulan | Generate tagihan bulan depan untuk semua kontrak aktif |
| `check-bill-reminders` | Setiap hari | Cek tagihan yang perlu diingatkan hari ini |
| `check-expiring-contracts` | Setiap hari | Cek kontrak yang berakhir tepat 30 hari lagi |

### Logika Reminder Tagihan

Scheduler cek tagihan setiap hari dan mengirim reminder sesuai jadwal:

| Timing | Tipe | Penerima |
|--------|------|---------|
| H-7 (7 hari sebelum jatuh tempo) | Pengingat awal | Penghuni |
| H-3 (3 hari sebelum jatuh tempo) | Pengingat mendesak | Penghuni |
| H+1 (1 hari setelah jatuh tempo) | Notifikasi terlambat | Penghuni |
| H+7 (7 hari setelah jatuh tempo) | Eskalasi | Owner |

### Generate Tagihan Bulanan

Processor `monthlyBillGenerator` berjalan sekali sebulan dan:
1. Ambil semua kontrak `ACTIVE` yang masih berjalan bulan depan
2. Cek apakah tagihan bulan depan sudah ada (skip jika sudah)
3. Buat tagihan baru untuk bulan depan
4. Log jumlah tagihan yang dibuat

---

## 8. Keamanan & Middleware

### Middleware Stack (urutan eksekusi)

```
Request masuk
     ↓
[1] Helmet         — HTTP security headers (HSTS, XSS, etc.)
     ↓
[2] CORS           — Validasi origin dari ALLOWED_ORIGINS
     ↓
[3] globalRateLimiter — Max 100 req/menit per IP
     ↓
[4] express.json() — Parse body JSON
     ↓
[5] Morgan         — HTTP request logging (bukan di test)
     ↓
[6] Router
     ↓
[7] authenticate   — Verifikasi JWT, inject req.context
     ↓
[8] authorize(role) — Role-based access control
     ↓
Controller
     ↓
[9] errorHandler   — Tangkap semua error, format response
```

### JWT Strategy

- **Access Token**: Expire `15 menit` — pendek untuk keamanan
- **Refresh Token**: Expire `7 hari` — rolling (setiap refresh, token lama di-revoke)
- Token disimpan di tabel `refresh_tokens` (bukan Redis), memungkinkan invalidasi dari sisi server
- Saat `reset-password`, **semua refresh token aktif di-revoke**

### Rate Limiting per Endpoint Group

| Group | Limit | Window |
|-------|-------|--------|
| Global (semua endpoint) | 100 req | 1 menit |
| Login | 5 percobaan gagal | 15 menit |
| Forgot password | 3 req | 1 jam |
| Reports | 20 req | 1 menit |

### Data Isolation (Multi-Tenant)

Setiap query di service layer selalu menyertakan filter `ownerId` yang diambil dari JWT. Tidak ada cara bagi satu owner untuk mengakses data owner lain.

### Soft Delete

Owner, Tenant, Property, dan Room menggunakan soft delete (`deleted_at`). Data tidak pernah benar-benar dihapus dari database, hanya tersembunyi dari query normal.

---

## 9. Konfigurasi Environment

Semua environment variable divalidasi menggunakan Zod saat startup. Jika ada yang kurang, server langsung crash dengan pesan error yang jelas.

Salin `.env.example` ke `.env` dan isi semua nilainya:

```env
# ── Server ──────────────────────────────────────────
NODE_ENV=development
PORT=3000

# ── Database ─────────────────────────────────────────
DATABASE_URL=postgresql://kosku:kosku_secret@localhost:5432/kosku_dev

# ── Redis ─────────────────────────────────────────────
# Pilih salah satu format berikut:
REDIS_URL=redis://localhost:6379
# atau
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# ── JWT ───────────────────────────────────────────────
JWT_ACCESS_SECRET=minimal_32_karakter_rahasia_akses_kamu
JWT_REFRESH_SECRET=minimal_32_karakter_rahasia_refresh_kamu
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# ── SMTP Email ────────────────────────────────────────
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=akun@gmail.com
SMTP_PASS=app_password_gmail
SMTP_FROM="KosKu <no-reply@kosku.app>"

# ── Frontend ──────────────────────────────────────────
FRONTEND_URL=http://localhost:5173
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3001
```

**Untuk test**, gunakan `.env.test` yang mengarah ke database test terpisah (port 5433):
```env
DATABASE_URL=postgresql://kosku:kosku_secret@localhost:5433/kosku_test
NODE_ENV=test
```

---

## 10. Cara Menjalankan (Development)

### Prasyarat

- Node.js 20+
- Docker & Docker Compose
- npm

### Langkah Setup

```bash
# 1. Clone repository
git clone https://github.com/Fadhil04/kosku-api.git
cd kosku-api

# 2. Install dependencies
npm install

# 3. Jalankan PostgreSQL dan Redis via Docker
docker-compose up -d

# 4. Salin dan isi environment variables
copy .env.example .env
# Edit .env sesuai kebutuhan

# 5. Jalankan migrasi database
npm run db:migrate

# 6. Generate Prisma client
npm run db:generate

# 7. Isi data awal (seed)
npm run db:seed
```

### Menjalankan Server

```bash
# Jalankan API server (hot reload)
npm run dev

# Jalankan worker (terminal terpisah)
npm run dev:worker
```

Server berjalan di: `http://localhost:3000`
Prisma Studio (DB GUI): `npm run db:studio`

### Script Tersedia

| Script | Perintah | Deskripsi |
|--------|----------|-----------|
| Dev server | `npm run dev` | API dengan hot reload |
| Dev worker | `npm run dev:worker` | Worker dengan hot reload |
| Build | `npm run build` | Compile TypeScript ke `dist/` |
| Start prod | `npm start` | Jalankan build hasil kompilasi |
| Lint | `npm run lint` | Cek kode dengan ESLint |
| Format | `npm run format` | Format kode dengan Prettier |
| Migrasi | `npm run db:migrate` | Jalankan migrasi terbaru |
| DB Studio | `npm run db:studio` | Buka Prisma Studio |
| Seed | `npm run db:seed` | Isi data awal |

### Akun Default (setelah seed)

| Role | Email | Password |
|------|-------|----------|
| Owner | `owner@kosku.dev` | `password123` |
| Tenant | `andi@kosku.dev` | `password123` |

---

## 11. Testing

Proyek menggunakan **Jest** dengan **Supertest** untuk integration testing.

```bash
# Jalankan semua test
npm test

# Test dengan coverage report
npm run test:coverage
```

Test environment menggunakan database **PostgreSQL terpisah** (port 5433) yang didefinisikan di `.env.test`, sehingga data development tidak terganggu.

File konfigurasi: `jest.config.cjs`

Test berjalan secara **serial** (`--runInBand`) untuk menghindari konflik antar test yang berbagi database.

---

## 12. Deployment (Docker)

### Struktur Deployment

Proyek memiliki dua Dockerfile yang masing-masing menggunakan **multi-stage build**:

```
Dockerfile        → API server  (node dist/app.js)
Dockerfile.worker → Worker      (node dist/worker.js)
```

Keduanya menggunakan pola yang sama:
1. **Stage builder**: Install semua deps, generate Prisma client, compile TypeScript
2. **Stage production**: Hanya copy hasil build + production deps, jalankan sebagai non-root user (`appuser`)

### Target Deployment: Railway

Deploy sebagai dua service terpisah di Railway yang berbagi:
- Satu instance **PostgreSQL** (Railway PostgreSQL plugin)
- Satu instance **Redis** (Railway Redis plugin)

**Service 1 — API:**
- Build: `Dockerfile`
- Start command: `npx prisma migrate deploy && node dist/app.js`
- Expose port: `3000`

**Service 2 — Worker:**
- Build: `Dockerfile.worker`
- Start command: `node dist/worker.js`
- Tidak perlu expose port

### Environment untuk Production

Tambahkan semua env variable yang sama dari `.env` ke settings Railway masing-masing service. Pastikan:
- `NODE_ENV=production`
- `DATABASE_URL` mengarah ke PostgreSQL Railway
- `REDIS_TLS_URL` atau `REDIS_URL` mengarah ke Redis Railway
- `JWT_ACCESS_SECRET` dan `JWT_REFRESH_SECRET` menggunakan string acak yang kuat (min 32 karakter)

---

## 13. Frontend — Panduan Pengembangan

Meskipun repository ini adalah backend-only, berikut panduan untuk membangun frontend yang kompatibel.

### Konsep Penting untuk Frontend

#### 1. Autentikasi

- Simpan `access_token` di memory (variabel/state), bukan localStorage, untuk keamanan
- Simpan `refresh_token` di **httpOnly cookie** atau localStorage sebagai trade-off
- Implementasikan **axios interceptor** untuk auto-refresh ketika access token expired (401)

Contoh pola dengan Axios:
```javascript
// Interceptor: tangkap 401, coba refresh, ulangi request
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && !error.config._retry) {
      error.config._retry = true;
      const newToken = await refreshAccessToken();
      error.config.headers['Authorization'] = `Bearer ${newToken}`;
      return axios(error.config);
    }
    return Promise.reject(error);
  }
);
```

#### 2. Idempotency Key untuk Pembayaran

Setiap kali form pembayaran dibuka, generate UUID baru sebagai idempotency key. Simpan key ini selama sesi form aktif. Jika user tidak sengaja klik submit dua kali, server akan mengembalikan data yang sama tanpa duplikat.

```javascript
import { v4 as uuidv4 } from 'uuid';

// Di saat form pembayaran pertama kali dimount
const [idempotencyKey] = useState(() => uuidv4());
```

#### 3. Role-Based UI

Gunakan data `role` dari response `/auth/me` untuk menampilkan/menyembunyikan fitur:

| Fitur | Owner | Tenant |
|-------|-------|--------|
| Kelola properti & kamar | ✓ | ✗ |
| Kelola kontrak | ✓ | ✗ |
| Lihat semua tagihan properti | ✓ | ✗ |
| Lihat tagihan sendiri | ✓ | ✓ |
| Catat pembayaran | ✓ | ✗ |
| Buat pengaduan | ✗ | ✓ |
| Kelola pengaduan | ✓ | ✗ |
| Laporan & dashboard | ✓ | ✗ |

#### 4. Pagination

Semua endpoint list mendukung query parameter:
```
?page=1&limit=10
```

Response selalu menyertakan metadata:
```json
{
  "data": [...],
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 10,
    "total_pages": 10
  }
}
```

#### 5. Error Handling

Setiap error punya `error.code` yang bisa digunakan untuk pesan yang lebih spesifik:

| Error Code | Status | Keterangan |
|------------|--------|------------|
| `AUTH_TOKEN_MISSING` | 401 | Token tidak ada di header |
| `AUTH_TOKEN_EXPIRED` | 401 | Token sudah kadaluarsa → trigger refresh |
| `AUTH_LOGIN_ACCOUNT_LOCKED` | 429 | Terlalu banyak percobaan login |
| `ROOM_NOT_AVAILABLE` | 422 | Kamar tidak bisa dibuat kontrak |
| `TENANT_HAS_ACTIVE_CONTRACT` | 409 | Penghuni masih punya kontrak aktif |
| `BILL_ALREADY_PAID` | 409 | Tagihan sudah lunas |
| `BILL_PAYMENT_EXCEEDS_AMOUNT` | 422 | Jumlah bayar melebihi sisa tagihan |
| `RATE_LIMIT_EXCEEDED` | 429 | Terlalu banyak request |

### Halaman-halaman yang Perlu Dibangun

#### Halaman Owner

| Halaman | Route (Saran) | API yang Digunakan |
|---------|---------------|-------------------|
| Login / Register | `/login`, `/register` | `POST /auth/login`, `POST /auth/register/owner` |
| Dashboard | `/dashboard` | `GET /reports/dashboard` |
| Daftar Properti | `/properties` | `GET /properties` |
| Detail Properti | `/properties/:id` | `GET /properties/:id` |
| Daftar Kamar | `/properties/:id/rooms` | `GET /properties/:propertyId/rooms` |
| Daftar Penghuni | `/tenants` | `GET /tenants` |
| Detail Penghuni | `/tenants/:id` | `GET /tenants/:id` |
| Daftar Kontrak | `/contracts` | `GET /contracts` |
| Buat Kontrak | `/contracts/new` | `POST /contracts` |
| Detail Kontrak | `/contracts/:id` | `GET /contracts/:id` |
| Daftar Tagihan | `/bills` | `GET /bills` |
| Tagihan Overdue | `/bills/overdue` | `GET /bills/overdue` |
| Catat Pembayaran | (modal di detail tagihan) | `POST /bills/:billId/payments` |
| Pengaduan | `/complaints` | `GET /complaints` |
| Laporan Revenue | `/reports/revenue` | `GET /reports/revenue` |
| Laporan Hunian | `/reports/occupancy` | `GET /reports/occupancy` |
| Laporan Pembayaran | `/reports/payment-behavior` | `GET /reports/payment-behavior` |
| Profil | `/profile` | `GET /auth/me`, `PUT /auth/me` |

#### Halaman Tenant

| Halaman | Route (Saran) | API yang Digunakan |
|---------|---------------|-------------------|
| Login | `/login` | `POST /auth/login` |
| Dashboard / Tagihan Saya | `/` | `GET /bills` |
| Detail Tagihan | `/bills/:id` | `GET /bills/:id` |
| Pengaduan Saya | `/complaints` | `GET /complaints` |
| Buat Pengaduan | `/complaints/new` | `POST /complaints` |
| Profil | `/profile` | `GET /auth/me`, `PUT /auth/me` |

---

## 14. Desain Pola & Keputusan Teknis

### Database Transaction

Operasi kompleks yang melibatkan banyak tabel dibungkus dalam `prisma.$transaction()`:

- **Buat kontrak**: Contract + update room status + create all bills + audit log
- **Terminasi kontrak**: Update contract + update room status + waive future bills + audit log
- **Catat pembayaran**: Create payment + update bill status + audit log

Jika salah satu langkah gagal, seluruh operasi di-rollback.

### Email di Luar Transaction

Email dikirim **setelah** transaction berhasil commit, dengan `.catch()` agar kegagalan email tidak membatalkan operasi utama:

```typescript
// Kontrak berhasil dibuat
const result = await prisma.$transaction(...);

// Email dikirim setelah transaction commit
await sendEmail({ to: tenant.email, ... }).catch((err) => {
  console.error('Gagal kirim email:', err);
  // Tidak throw, tidak rollback kontrak
});
```

### Denda Keterlambatan Real-Time

`lateFeePercentage` dan `lateFeeMaxPercentage` **disimpan di bill** pada saat tagihan dibuat (snapshot saat kontrak dibuat). Nilai denda aktualnya dihitung setiap kali data bill diambil menggunakan fungsi `calculateLateFee()`. Pendekatan ini:
- Menjamin nilai denda selalu akurat (berdasarkan hari ini, bukan kemarin)
- Memungkinkan perubahan kebijakan denda di masa depan tanpa mengubah data lama

### Idempotent Payment

Setiap request pembayaran membutuhkan `idempotency_key` yang unik. Server mengecek key ini sebelum membuat payment baru. Jika key sudah ada, server mengembalikan data lama tanpa error, hanya dengan flag `is_duplicate_request: true`. Ini mencegah double-charge akibat network retry.

### Rolling Refresh Token

Setiap kali `/auth/refresh-token` dipanggil:
1. Refresh token lama di-revoke di database (`revokedAt` diisi)
2. Access token baru + refresh token baru diterbitkan

Jika refresh token lama digunakan lagi setelah di-revoke → ditolak. Ini mendeteksi kemungkinan token theft.

### Pagination Konsisten

Semua endpoint list menggunakan helper `getPagination()` dan `getPaginationMeta()` yang menghasilkan format response yang sama di seluruh sistem.

### Validasi dengan Zod

Setiap request body divalidasi menggunakan Zod schema sebelum masuk ke controller. Error validasi ditangani di `errorHandler` dan diformat menjadi response yang konsisten dengan field error yang jelas.

---

*Dokumentasi ini dibuat berdasarkan analisis kode sumber proyek kosku-api. Diperbarui: Agustus 2026.*
