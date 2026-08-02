# KosKu API

Backend API untuk sistem manajemen kos-kosan digital. Dibangun sebagai proyek portofolio
untuk demonstrasi kemampuan backend development.

## Tech Stack

- **Runtime:** Node.js 20 + TypeScript
- **Framework:** Express.js
- **Database:** PostgreSQL dengan Prisma ORM
- **Cache & Queue:** Redis + BullMQ
- **Auth:** JWT (access + refresh token)
- **Email:** Nodemailer
- **Testing:** Jest + Supertest
- **Deploy:** Railway (API + Worker sebagai service terpisah)

## Fitur Utama

- Multi-tenant: satu sistem untuk banyak pemilik kos, data terisolasi
- Manajemen properti dan kamar dengan state machine status
- Kontrak sewa dengan generate tagihan otomatis (database transaction)
- Kalkulasi late fee dinamis (real-time, tidak disimpan)
- Pencatatan pembayaran dengan idempotency key
- Sistem komplain dengan thread dan audit trail
- Job queue untuk notifikasi email otomatis (BullMQ)
- Cron job untuk generate tagihan bulanan
- Laporan revenue, occupancy, dan payment behavior

## Cara Menjalankan Lokal

### Prerequisites
- Node.js 20+
- Docker Desktop (untuk PostgreSQL dan Redis)

### Setup

```bash
# Clone repository
git clone https://github.com/username/kosku-api.git
cd kosku-api

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Edit .env dengan nilai yang sesuai

# Jalankan database dan Redis
docker-compose up -d

# Generate Prisma client dan jalankan migration
npm run db:generate
npm run db:migrate

# Seed data awal
npm run db:seed

# Jalankan API server (terminal 1)
npm run dev

# Jalankan worker (terminal 2)
npm run dev:worker
```

### Akun Default (setelah seed)

| Role   | Email                | Password    |
|--------|---------------------|-------------|
| Owner  | owner@kosku.dev      | Password1!  |
| Tenant | andi@kosku.dev       | Password1!  |

## API Endpoints

### Auth
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| POST | /api/v1/auth/register/owner | Registrasi owner baru |
| POST | /api/v1/auth/login | Login (owner/tenant) |
| POST | /api/v1/auth/refresh-token | Perbarui access token |
| POST | /api/v1/auth/logout | Logout |
| POST | /api/v1/auth/forgot-password | Request reset password |
| POST | /api/v1/auth/reset-password | Set password baru |
| GET  | /api/v1/auth/me | Profil sendiri |
| PUT  | /api/v1/auth/me | Update profil |

### Properties
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| POST | /api/v1/properties | Tambah properti |
| GET  | /api/v1/properties | Daftar properti |
| GET  | /api/v1/properties/:id | Detail properti + statistik |
| PUT  | /api/v1/properties/:id | Update properti |
| DELETE | /api/v1/properties/:id | Hapus properti |

### Rooms
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| POST | /api/v1/properties/:id/rooms | Tambah kamar |
| GET  | /api/v1/properties/:id/rooms | Daftar kamar |
| GET  | /api/v1/properties/:id/rooms/available | Kamar tersedia |
| PATCH | /api/v1/properties/:id/rooms/:roomId/status | Update status (state machine) |

### Contracts
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| POST | /api/v1/contracts | Buat kontrak + generate bills |
| GET  | /api/v1/contracts | Daftar kontrak |
| GET  | /api/v1/contracts/expiring-soon | Kontrak hampir habis |
| PATCH | /api/v1/contracts/:id/terminate | Terminasi kontrak |
| PATCH | /api/v1/contracts/:id/renew | Perpanjang kontrak |

### Bills & Payments
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET  | /api/v1/bills | Daftar tagihan (late fee real-time) |
| GET  | /api/v1/bills/overdue | Tagihan terlambat |
| POST | /api/v1/bills/:id/payments | Catat pembayaran (idempotent) |
| GET  | /api/v1/bills/:id/payments | Riwayat pembayaran |

### Complaints
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| POST | /api/v1/complaints | Ajukan komplain (tenant) |
| GET  | /api/v1/complaints | Daftar komplain |
| PATCH | /api/v1/complaints/:id/status | Update status (state machine) |
| POST | /api/v1/complaints/:id/responses | Balas komplain |

### Reports (owner only)
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET  | /api/v1/reports/dashboard | Ringkasan semua properti |
| GET  | /api/v1/reports/revenue | Laporan pendapatan |
| GET  | /api/v1/reports/occupancy | Laporan hunian |
| GET  | /api/v1/reports/payment-behavior | Analitik pembayaran tenant |

## Menjalankan Test

```bash
# Unit test saja
npm test -- tests/unit

# Integration test (butuh Docker)
npm test -- tests/integration

# Semua test dengan coverage
npm run test:coverage
```

## Arsitektur