# Panti Janda

Platform komunitas digital untuk pemberdayaan janda — menghubungkan anggota, menyediakan pelatihan, marketplace, trading, dan dukungan finansial. Dibangun dengan React 19, TypeScript, Vite 8, Tailwind CSS 4, dan backend serverless.

## Fitur Utama

### Komunitas & Profil
- **Registrasi & Verifikasi** — Alur pendaftaran dengan verifikasi KTP/surat pengadilan, pertanyaan status janda, dan approval admin
- **Profil Anggota** — Foto, bio, skill, pelatihan, target kebutuhan, dengan sistem follow dan update aktivitas
- **Sistem Tier Janda** — 4 level: Wonder Woman (1-20), Sosialita (21-35), High Society (36-45), The CEO (46-50)
- **Sistem Tier Publik** — 4 level untuk non-janda: Kades, Gubernur, Panglima, Presiden
- **Sistem Level & XP** — 50 level dengan poin yang didapat dari aktivitas komunitas
- **Pencarian Anggota** — Cari dan jelajahi profil anggota lainnya
- **Grup Komunitas** — Kelompok minat dengan kapasitas dan keanggotaan terbatas

### Komunikasi
- **Chat Real-time** — Direct message dan group chat antar anggota
- **Notifikasi** — Follow, pesan, donasi, dan verifikasi
- **Update & Komentar** — Bagikan kabar dan terima dukungan dari anggota lain

### Ekonomi & Finansial
- **Donasi & Galang Dana** — Sistem donasi dengan kampanye fundraising, target dana, dan deadline
- **Marketplace** — Jual beli barang dan jasa antar anggota dengan kategori produk
- **Bisnis & Proposal** — Ajukan proposal bisnis dengan RAB (Rencana Anggaran Biaya) untuk pendanaan
- **Langganan Bulanan** — Upgrade tier melalui subscription: Sosialita, High Society, The CEO
- **Sistem Koin** — Mata uang internal untuk fitur premium, dengan paket pembelian dan cash-out
- **Integrasi Midtrans** — Payment gateway untuk transaksi donasi dan langganan
- **Laporan Keuangan** — Dashboard keuangan untuk admin

### Pelatihan & Acara
- **Program** — Akademi, pelatihan, seminar, dan penempatan kerja
- **Event** — Buat dan kelola acara dengan RSVP, panitia, tiket, dan absensi
- **Manajemen Event** — Kelola panitia, jenis tiket, harga, dan attendance

### Trading & AI
- **Live Trading** — Widget trading real-time dengan chart (line/candle), multi-simbol (saham & kripto), demo mode, dan MetaTrader 5 integration
- **AI Trading Agent** — Agent trading otomatis dengan strategi AI, risk management, dan auto-execute
- **AI Mentor** — Asisten AI untuk konsultasi bisnis dan dokumen

### Admin
- **Dashboard Admin** — Statistik akun, profil pending, laporan, total donasi
- **Manajemen Akun** — Lihat, suspend, verifikasi anggota
- **Pengaturan Aplikasi** — Konfigurasi pembayaran, shipping, subscription, academy, trading, koin, blockchain API, dan trial accounts

## Arsitektur Teknis

### Frontend
| Teknologi | Versi |
|-----------|-------|
| React | 19.2.6 |
| TypeScript | 5.9.3 (strict mode) |
| Vite | 8.0.13 |
| Tailwind CSS | 4.2.1 |
| Shadcn/Radix UI | - |
| Recharts | 3.8.0 |
| React Hook Form + Zod | - |
| Lucide React | 1.31.0 |

### Backend
- **Runtime**: Node.js (dev server) / Deno (production function)
- **Database**: Supabase (15+ tabel: accounts, profiles, events, donations, businesses, marketplace, coins, subscriptions, dll)
- **API**: Serverless function (`functions/handler.mjs`) dengan 80+ endpoint
- **Auth**: Token-based session dengan role & permission

### Struktur Proyek
```
├── src/
│   ├── components/       # Komponen reusable (app-shell, cards, common, updates)
│   ├── lib/              # Utility (api, constants, format, price-stream, router, session, types)
│   ├── pages/            # 28 halaman (dashboard, live-trading, marketplace, admin, dll)
│   ├── App.tsx           # Root component dengan routing
│   └── main.tsx          # Entry point
├── functions/
│   ├── handler.mjs       # Backend API handler (80+ routes)
│   ├── adapter.mjs       # Request adapter
│   └── index.ts          # Deno deployment entry
├── dev/
│   ├── server.mjs        # Development server
│   ├── fake-supabase.mjs # Mock database
│   └── integration.mjs   # Integration helpers
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## Halaman & Routing

| Route | Halaman | Deskripsi |
|-------|---------|-----------|
| `/` | Landing | Halaman utama publik |
| `/jelajah` | Explore | Jelajahi anggota & komunitas |
| `/janda/:id` | Profile Detail | Profil anggota |
| `/program` | Programs | Daftar program pelatihan |
| `/event/:id` | Events | Detail acara |
| `/event/:id/kelola` | Event Manage | Kelola acara (panitia) |
| `/galang-dana` | Campaigns | Daftar galang dana |
| `/galang-dana/buat` | Campaign Create | Buat kampanye baru |
| `/bisnis` | Businesses | Daftar bisnis/proposal |
| `/bisnis/baru` | Business Form | Ajukan proposal bisnis |
| `/grup` | Groups | Grup komunitas |
| `/pesan` | Chat | Direct message & group chat |
| `/dasbor` | Dashboard | Dashboard anggota |
| `/admin` | Admin | Panel admin |
| `/keuangan` | Finance | Laporan keuangan |
| `/langganan` | Subscription | Manajemen langganan |
| `/mentor-ai` | AI Mentor | Konsultasi AI |
| `/marketplace` | Marketplace | Jual beli |
| `/koin` | Coins | Koin & fitur premium |
| `/live-trading` | Live Trading | Trading real-time |
| `/ai-agent` | AI Agent | Agent trading AI |
| `/masuk` | Login | Masuk |
| `/daftar` | Register | Daftar |

## Instalasi & Menjalankan

### Prasyarat
- Node.js >= 22.12.0

### Development
```bash
npm ci
npm run dev          # Frontend (Vite dev server)
npm run dev:function # Backend (dev server di port 8000)
```

### Build & Preview
```bash
npm run build        # Build production ke dist/
npm run preview      # Preview build
```

### Check Backend
```bash
npm run check:function  # Syntax check handler & adapter
```

## Database

15+ tabel utama:
- `accounts` — Akun pengguna dengan role & level
- `profiles` — Profil lengkap anggota janda
- `events` — Acara komunitas
- `event_committees` — Panitia acara
- `event_tickets` — Tiket acara
- `event_attendance` — Absensi
- `donations` — Donasi
- `pledges` — Janji dukungan
- `campaigns` — Kampanye galang dana
- `campaign_donations` — Donasi kampanye
- `businesses` — Proposal bisnis
- `rab_items` — RAB bisnis
- `marketplace_listings` — Listing marketplace
- `subscriptions` — Langganan bulanan
- `coin_transactions` — Transaksi koin
- `coin_balances` — Saldo koin
- `notifications` — Notifikasi
- `groups` — Grup komunitas
- `programs` — Program pelatihan
- `updates` — Update aktivitas
- `comments` — Komentar
- `follows` — Follow antar anggota
- `kpi_logs` — Log poin KPI
- `badges` — Badge pencapaian
- `reports` — Laporan pelanggaran

## Konfigurasi Admin

Panel admin menyediakan pengaturan untuk:
- **Pembayaran** — Midtrans (server key, client key, environment)
- **Shipping** — Provider pengiriman & tarif
- **Langganan** — Harga per tier
- **Akademi** — Modul & jadwal pelatihan
- **Trading** — Symbol, API, TradingView widget
- **MetaTrader 5** — Broker, server, risk management
- **AI Trading Agent** — Model, strategi, parameter
- **Koin** — Metode pembayaran, konversi, fee
- **Blockchain API** — Network, contract, RPC
- **Trial Accounts** — Akun percobaan per tier
- **Link Eksternal** — Tautan yang ditampilkan di aplikasi

## Lisensi

Private — tidak dilisensikan untuk penggunaan publik.
