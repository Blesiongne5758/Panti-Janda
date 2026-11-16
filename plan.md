# Rencana implementasi: akses non-janda dan kontribusi koin

## Perilaku yang disetujui

Akun non-janda bukan kategori akun publik/pengunjung: sistem menyimpan `account_kind = non_janda`, terpisah dari role yang menunjukkan progres level pada ladder non-janda. Akun baru tetap memulai dari role Kades; akun lama mempertahankan role progresnya. Akun janda disimpan sebagai `account_kind = janda`. Semua akun non-admin masuk ke `/dasbor`; non-janda dapat memakai fitur anggota tanpa verifikasi identitas janda; API admin hanya menerima `role = admin`, bukan sekadar rank progres tinggi.

Gift koin memindahkan koin 1:1 tanpa biaya dan memberi pengirim 20 XP sekali sesudah transfer sukses. Donasi kampanye dengan koin memberi donor 20 XP sekali sesudah transaksi sukses; reward QRIS 20 XP bagi pemilik kampanye tidak berubah. Pembelian marketplace dengan koin memberi buyer 20 XP sekali setelah sukses; reward event 50 XP dan turnamen 60 XP tetap. Harga koin listing terpisah dari harga Rupiah; debit buyer dan kredit seller harus sama, tanpa biaya.

## Pendekatan

- Pertahankan React 19, TypeScript, Vite, Supabase Functions, pola API berbasis action, serta desain Panti Janda saat ini. Tidak menambah dependency.
- Tambahkan `account_kind` pada `accounts`, migrasikan akun lama berdasarkan role janda/non-janda/admin, simpan kategori saat registrasi, dan tampilkan melalui kontrak session. Role tetap menjadi tangga level; guard fitur memakai kategori akun eksplisit. Role lama `public` untuk akun non-janda tetap dipertahankan sebagai role progres dan tidak mengubah jenis akun menjadi pengunjung.
- Buat/backfill profil komunitas non-janda dengan `tier = null`, tanpa dokumen janda, dan status layak memakai fitur profil. Profil tersebut memungkinkan fitur yang saat ini membutuhkan profil (post, kampanye, listing) menggunakan identitas non-janda, bukan menyamar sebagai profil janda.
- Gunakan RPC Postgres atomik untuk gift, donasi kampanye koin, dan pembelian listing. Tiap RPC memvalidasi akun aktif, saldo, idempotency key, status/ownership; mengunci baris penting; menulis order/donasi serta ledger; mengubah debit/kredit; dan memberi XP/idempotency claim dalam satu transaksi. Handler hanya menyatakan berhasil sesudah RPC sukses.
- Harga koin disimpan di kolom berbeda dari Rupiah; checkout satu listing hanya sekali. Tidak ada biaya/komisi.
- Perbarui frontend types, form/checkout, dialog gift pada profil, riwayat saldo, label XP, dan visibilitas profil agar akun non-janda mendapat akses anggota tanpa membuka fungsi admin.
- Perbaiki migrasi kampanye koin yang rusak, siapkan migrasi DB kompatibel di folder Supabase dan migrasi historis repo, serta sinkronkan kedua handler deployment. Pengguna mengizinkan migration 007 dan penggantian Edge Function `app`; workflow menerapkan hanya migration 007 pada dispatch manual jika itu satu-satunya migration pending, lalu deploy `app`, `chat-storage`, dan frontend. Migration lain atau history mismatch menghentikan rilis.

## Struktur proyek

`src/pages/` berisi dashboard, registrasi, profil, kampanye, marketplace, dan koin; `src/components/` berisi dialog UI; `src/lib/` berisi types, session, API, dan label; `functions/handler.mjs` adalah serverless API handler dan `supabase/functions/app/handler.mjs` harus sinkron; `supabase/migrations/` adalah migrasi Supabase sementara `migrations/` memuat migrasi historis; `dev/` memuat server fixture dan pemeriksaan integrasi.

## Batasan dan desain

Tidak mengubah harga Rupiah atau reward event/tournament; tidak menambahkan biaya tersembunyi; tidak memberi akun non-janda akses admin; tidak menerapkan migration selain 007 yang diizinkan atau menulis data production selain backfill yang tercantum di migration tersebut. Terapkan migration hanya melalui dispatch manual yang dibatasi; jangan deploy jika preflight menemukan migration lain. Gunakan komponen Card/Dialog/Button, warna, tipografi, bahasa Indonesia, dan layout responsif yang sudah ada. Profil non-janda menggunakan badge netral Mitra Komunitas, bukan tier janda; `account_kind` menjadi jenis akun, sedangkan role tetap menunjukkan progres ladder.
