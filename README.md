# Panti Janda

Platform komunitas digital untuk pemberdayaan janda — menghubungkan anggota, menyediakan pelatihan, marketplace, trading, kompetisi E-Sport, dan dukungan finansial. Dibangun dengan React 19, TypeScript, Vite 8, Tailwind CSS 4, dan backend serverless.

## Fitur Utama

### Komunitas & Profil
- **Registrasi & Verifikasi** — Alur pendaftaran dengan verifikasi KTP/surat pengadilan, pertanyaan status janda, dan approval admin
- **Profil Anggota** — Foto, bio, skill, pelatihan, target kebutuhan, dengan sistem follow dan update aktivitas
- **Sistem Tier Janda** — 4 level: Wonder Woman (1-20), Sosialita (21-35), High Society (36-45), The CEO (46-50)
- **Sistem Tier Publik** — 4 level untuk non-janda: Kades, Gubernur, Panglima, Presiden
- **Sistem Level & XP** — 50 level dengan poin yang didapat dari aktivitas komunitas
- **Pencarian Anggota** — Cari dan jelajahi profil anggota lainnya
- **Grup Komunitas** — Kelompok minat dengan kapasitas dan keanggotaan terbatas
- **Feed & Update** — Bagikan kabar, foto, dan video ke komunitas

### Komunikasi
- **Chat Real-time** — Direct message dan group chat antar anggota
- **Notifikasi** — Follow, pesan, donasi, dan verifikasi
- **Update & Komentar** — Bagikan kabar dan terima dukungan dari anggota lain

### Ekonomi & Finansial
- **Donasi & Galang Dana** — Sistem donasi dengan kampanye fundraising, target dana, dan deadline
- **Marketplace** — Jual beli barang dan jasa antar anggota dengan upload foto produk
- **Bisnis & Proposal** — Ajukan proposal bisnis dengan RAB (Rencana Anggaran Biaya) untuk pendanaan
- **Langganan Bulanan** — Upgrade tier melalui subscription: Sosialita, High Society, The CEO, Sultan
- **Sistem Koin** — Mata uang internal untuk fitur premium, dengan paket pembelian dan cash-out
- **Crypto Wallet** — Dompet cryptocurrency terintegrasi
- **Integrasi Midtrans** — Payment gateway untuk transaksi donasi dan langganan
- **Laporan Keuangan** — Dashboard keuangan untuk admin

### Pelatihan & Acara
- **Learning Center** — Pusat pembelajaran dengan kursus, modul, dan progres
- **Program** — Akademi, pelatihan, seminar, dan penempatan kerja
- **Event** — Buat dan kelola acara dengan RSVP, panitia, tiket, dan absensi
- **Manajemen Event** — Wizard 6 langkah, panitia, tiket QR, attendance, dan anggaran
- **Tiket QR** — Generate QR code tiket digital dan scanner absensi untuk panitia
- **Undangan QR** — QR code undangan event dengan link grup otomatis
- **Kalender Pribadi** — Jadwal pribadi anggota terintegrasi dengan agenda platform
- **Pengingat** — Notifikasi jadwal dari agenda platform dan kalender pribadi

### Kompetisi E-Sport
- **Hub E-Sport** — Portal utama kompetisi dengan navigasi ke semua fitur
- **Manajemen Tim** — Buat dan kelola tim E-Sport dengan anggota dan roster
- **Turnamen** — Buat turnamen dengan berbagai format: Single Elimination, Double Elimination, Round Robin, Swiss System, Battle Royale, dan Liga
- **Bracket Visual** — Bagan turnamen interaktif dengan nomor unggulan
- **Pendaftaran** — Sistem registrasi tim dengan pembayaran dan approval
- **Siklus Hidup Pertandingan** — Check-in, jeda, walkover, sengketa, dan pembatalan
- **Check-in Otomatis** — Layanan check-in dengan notifikasi dan mulai otomatis
- **Anggaran Turnamen** — Kelola budget dan pengeluaran turnamen
- **Siaran Live** — Setup kanal streaming dan siaran laga
- **Bursa Transfer** — Jual beli/pinjam pemain dengan escrow koin, negosiasi, kontrak digital, dan agen
- **Papan Peringkat** — Leaderboard lintas turnamen untuk tim dan pemain
- **Statistik Pemain** — Statistik lengkap, review dari tim lain, dan riwayat roster
- **Sengketa Transfer** — Sistem pelaporan dan penyelesaian sengketa transfer

### Trading & AI
- **Live Trading** — Widget trading real-time dengan chart (line/candle), multi-simbol (saham & kripto), demo mode, dan MetaTrader 5 integration
- **AI Trading Agent** — Agent trading otomatis dengan strategi AI, risk management, dan auto-execute
- **AI Mentor** — Asisten AI untuk konsultasi bisnis dan dokumen

### Admin
- **Dashboard Admin** — Statistik akun, profil pending, laporan, total donasi
- **Manajemen Akun** — Lihat, suspend, verifikasi anggota
- **Manajemen Event & Tiket** — Kelola semua event dan tiket dari panel admin
- **Pengaturan Aplikasi** — Konfigurasi pembayaran, shipping, subscription, academy, trading, koin, crypto, blockchain API, API management, cloud storage, dan trial accounts

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
- **Database**: Supabase (30+ tabel: accounts, profiles, events, tournaments, transfers, contracts, dll)
- **API**: Serverless function (`functions/handler.mjs`) dengan 150+ endpoint
- **Auth**: Token-based session dengan role & permission
- **Multi-language**: i18n (Indonesia, English, Arabic)

### Struktur Proyek
```
├── src/
│   ├── components/       # Komponen reusable (app-shell, cards, common, esport, ui)
│   ├── lib/              # Utility (api, constants, format, i18n, price-stream, router, session, types)
│   ├── pages/            # 35+ halaman (dashboard, bursa-transfer, esport-*, live-trading, marketplace, admin, dll)
│   ├── App.tsx           # Root component dengan routing
│   └── main.tsx          # Entry point
├── functions/
│   ├── handler.mjs       # Backend API handler (150+ routes)
│   ├── adapter.mjs       # Request adapter
│   └── index.ts          # Deno deployment entry
├── dev/
│   ├── server.mjs        # Development server dengan fixture data
│   ├── fake-supabase.mjs # Mock database
│   ├── e2e-*.mjs         # E2E test scripts
│   └── integration.mjs   # Integration helpers
├── migrations/
│   ├── 001_initial_schema.sql
│   ├── 002_learning_center.sql
│   ├── 003_crypto_wallets.sql
│   ├── 003_event_invite_attendance.sql
│   ├── 004_event_management.sql
│   ├── 005_esport_tournaments.sql
│   ├── 006_esport_extension.sql
│   ├── 007_match_lifecycle.sql
│   ├── 008_esport_budget.sql
│   ├── 009_personal_calendar.sql
│   ├── 010_esport_transfer_market.sql
│   └── 011_esport_transfer_enhancement.sql
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
| `/learning` | Learning Center | Pusat pembelajaran |
| `/event/:id` | Events | Detail acara |
| `/event/:id/kelola` | Event Manage | Kelola acara (panitia) |
| `/event/baru` | Event Wizard | Wizard buat event 6 langkah |
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
| `/koin` | Coins | Koin, crypto, & fitur premium |
| `/live-trading` | Live Trading | Trading real-time |
| `/ai-agent` | AI Agent | Agent trading AI |
| `/kompetisi-esport` | E-Sport Hub | Portal kompetisi E-Sport |
| `/kompetisi-esport/tim` | E-Sport Teams | Manajemen tim |
| `/kompetisi-esport/buat` | E-Sport Create | Buat turnamen |
| `/kompetisi-esport/papan` | E-Sport Leaderboard | Papan peringkat & statistik |
| `/kompetisi-esport/:id` | E-Sport Detail | Detail turnamen & bracket |
| `/kompetisi-esport/:id/kelola` | E-Sport Manage | Kelola turnamen |
| `/bursa-transfer` | Bursa Transfer | Bursa transfer pemain E-Sport |
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

### E2E Testing
```bash
node dev/e2e-esport-006.mjs   # E-Sport tournament E2E
node dev/e2e-transfer.mjs     # Bursa transfer E2E
node dev/e2e-calendar.mjs     # Kalender E2E
node dev/e2e-phase-a.mjs      # Transfer enhancement E2E
```

## Database

30+ tabel utama:
- `accounts` — Akun pengguna dengan role & level
- `profiles` — Profil lengkap anggota janda
- `events` — Acara komunitas
- `event_committees` — Panitia acara
- `event_tickets` — Tiket acara
- `event_attendance` — Absensi
- `event_invites` — Undangan QR
- `event_budget_items` — Anggaran event
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
- `crypto_wallets` — Dompet crypto
- `notifications` — Notifikasi
- `groups` — Grup komunitas
- `programs` — Program pelatihan
- `learning_courses` — Kursus learning center
- `updates` — Update aktivitas
- `comments` — Komentar
- `follows` — Follow antar anggota
- `kpi_logs` — Log poin KPI
- `badges` — Badge pencapaian
- `reports` — Laporan pelanggaran
- `personal_calendar_items` — Jadwal pribadi
- `esport_games` — Katalog game
- `esport_teams` — Tim E-Sport
- `esport_team_members` — Anggota tim
- `esport_tournaments` — Turnamen
- `esport_registrations` — Pendaftaran turnamen
- `esport_matches` — Pertandingan
- `esport_player_profiles` — Profil pemain
- `esport_transfer_listings` — Listing bursa
- `esport_transfer_offers` — Tawaran transfer
- `esport_transfers` — Transaksi transfer
- `esport_player_contracts` — Kontrak pemain
- `esport_player_stats` — Statistik pemain
- `esport_player_reviews` — Review pemain
- `esport_transfer_disputes` — Sengketa transfer
- `esport_roster_history` — Riwayat roster

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
- **Crypto** — Jaringan, token, RPC
- **API Management** — Key, rate limit, endpoint
- **Cloud Storage** — Provider, bucket, pre-signed URL
- **Blockchain API** — Network, contract, RPC
- **Trial Accounts** — Akun percobaan per tier
- **Link Eksternal** — Tautan yang ditampilkan di aplikasi

## Lisensi

Private — tidak dilisensikan untuk penggunaan publik.
