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

---

# Rencana fitur komunitas dan wawancara yang disetujui

## Tujuan dan batasan

Melanjutkan aplikasi React 19 + TypeScript + Vite dengan menambahkan receipt baca chat, penyempurnaan kompetisi E-Sport, notifikasi feed/marketplace, referral, lowongan kerja, dan penjadwalan wawancara. Seluruh perubahan dikerjakan lokal di `/home/ubuntu/work/Panti-Janda`. **Pengujian backend memakai fixture in-memory lokal saja. Push ke branch fitur kemudian diminta secara eksplisit; push ini tidak memicu workflow deploy production yang dibatasi ke branch `main`. Tidak menjalankan migration terhadap Supabase atau menulis/menghapus data produksi.**

Laporan layar putih pada transisi chat aktif → menu → Dasbor belum dapat direproduksi pada baseline saat ini: regresi Playwright lokal lulus pada lebar 360 px dan 390 px, heading/konten Dasbor tampil, tanpa error runtime. Karena itu tidak mengubah z-index atau CSS berdasarkan dugaan. Pertahankan regresi tersebut sebagai bukti; jika ada bukti reproduksi baru, perbaiki berdasarkan penyebab teramati.

## Desain implementasi dan asumsi produk

- Pertahankan gaya yang sudah ada: tampilan komunitas hangat, kartu ber-radius besar, latar krem dan aksen plum/emas untuk tema anggota, serta aksen hijau lembut untuk tema publik/non-janda. Pakai komponen UI, ikon Lucide, tipografi `font-display`, spacing, responsivitas dan perilaku reduced-motion yang sudah ada; jangan membuat sistem visual baru.
- Receipt chat: satu centang berarti pesan tersimpan/terkirim tetapi belum dibaca; dua centang berarti telah dibaca. Untuk grup, pembacaan disimpan per penerima yang menjadi anggota pada saat pesan dikirim; indikator dua centang muncul setelah seluruh penerima snapshot membaca. Receipt tidak membocorkan status baca kepada pihak selain pengirim pesan. Mark-read hanya terjadi saat thread benar-benar aktif/terlihat.
- Peran panitia E-Sport menggunakan pilihan awal `Ketua panitia`, `Koordinator`, `Wasit`, `Admin pertandingan`, dan `Operator streaming`; daftar anggota/role terpisah dari roster tim. Ketua/manager kompetisi mengelola panitia. Grup chat panitia bersifat privat; hanya panitia yang ditugaskan dapat melihat dan mengirim pesan.
- Modus kompetisi adalah `online` atau `onsite`, terpisah dari platform/perangkat game. Kompetisi onsite wajib mengisi nama dan alamat lokasi; URL peta bersifat opsional. Untuk sponsor, gunakan daftar sponsor yang sudah ada, lengkapi input nama/logo/tautan dan penanda sponsor utama; tampilkan strip/banner sponsor utama di area siaran kompetisi ketika halaman detail menampilkan stream.
- Notifikasi feed berlaku untuk like baru dan komentar baru pada posting media; unlike tidak mengirim notifikasi dan tidak ada notifikasi kepada diri sendiri. Notifikasi memakai inbox yang sudah ada. Karena marketplace saat ini belum menyimpan pesanan, sediakan order produk lokal/aplikasi berstatus awal `pending` agar order masuk dapat dicatat dan diberitahukan. **Asumsi: order ini adalah permintaan pesanan tanpa pembayaran online, gateway pembayaran, atau pemotongan stok baru.** Order hanya untuk listing produk aktif; penjual melihat dan dapat mengubah status, pembeli melihat order miliknya.
- Referral memakai kode unik stabil per akun, disimpan server-side. Tautan berbagi memakai hash-router (`/#/daftar?ref=KODE`); kode direkam satu kali ketika pendaftaran sukses. Tidak menambahkan reward/komisi karena tidak diminta.
- Lowongan dapat dibuat oleh akun terautentikasi tanpa menambah role global baru: pemilik listing bertindak sebagai pemberi kerja untuk lowongan tersebut; akun terautentikasi lain dapat menemukan lowongan dan melamar. Hanya pemilik lowongan yang dapat melihat/mengelola daftar pelamar dan statusnya; identitas kontak/resume kandidat tidak ditampilkan publik.
- Jadwal wawancara terikat pada lowongan dan lamaran tertentu. Pilihan `online` atau `onsite`; wawancara onsite memerlukan lokasi. Ruang online memakai ulang signaling WebRTC 1:1 yang sudah ada, bukan platform streaming/broadcast multi-peserta; kedua pihak tetap harus masuk ruang dan menyetujui izin kamera/mikrofon. Jadwal online tampil di kalender kedua peserta dan tautan menuju ruang wawancara hanya dapat digunakan peserta terkait.

## Pendekatan implementasi

1. **Sumber data dan API.** Pertahankan API melalui action POST pada `/functions/v1/app`. Setiap perubahan handler dibuat untuk dua baseline yang terpisah: `functions/handler.mjs` (fixture lokal) dan `supabase/functions/app/handler.mjs` (Edge Function produksi). Jangan menyalin keseluruhan handler di antara keduanya; sinkronkan hanya action/helper yang relevan dan uji masing-masing sintaks/kontrak. Perluas `dev/fake-supabase.mjs` atau seed fixture yang relevan untuk tabel/relasi baru agar tes tidak memakai Supabase nyata.
2. **Skema.** Buat migration SQL baru yang aditif dalam `supabase/migrations/`, jalur yang diperiksa workflow deployment. Gunakan indeks/foreign key/unique constraints dan hak baca/tulis minimum untuk receipts, panitia kompetisi, referral/atribusi, order, aplikasi kerja yang dikelola pemilik, dan jadwal wawancara. Migration lama tidak diedit. Folder `migrations/` berisi rangkaian legacy; jangan menggandakan perubahan ke sana tanpa bukti bahwa pipeline aktif menggunakannya. Migration hanya ditulis sebagai file lokal dan tidak dieksekusi pada task ini.
3. **Otorisasi.** Semua endpoint mutasi mengambil `account_id` dari sesi yang sudah tervalidasi, bukan payload browser. Backend memeriksa keanggotaan/ownership untuk pesan, kompetisi, order, lowongan, lamaran, jadwal dan room. Karena Edge Function memakai Supabase service role, validasi tetap harus eksplisit di handler; UI atau RLS saja tidak menjadi kontrol akses. Hindari mengungkap resume/kontak privat, serta cegah self-referral, self-order, duplicate application, duplicate notification dan update lintas pemilik.
4. **Frontend dan rute.** Gunakan pola React/TypeScript, `api()` dan hash-router yang ada; tambahkan halaman lowongan (daftar, detail, buat/kelola, lamaran), halaman ruang wawancara, panel referral di `ProfileSettingsDialog`, indikator chat, panel order penjual/pembeli, dan controls terkait E-Sport. Perbarui `src/App.tsx`, `src/lib/router.tsx`, `src/lib/types.ts`, shell navigasi dan bottom navigation secara konsisten. Sinkronkan `public/manus-routes.json` dengan rute statis/dinamis yang benar; manifest kini mencantumkan route lowongan dan wawancara.
5. **Kalender dan WebRTC.** Jadwal wawancara adalah entitas kanonis tersendiri, bukan dua item personal yang mudah berbeda. Perluas `calendar.agenda` agar pengguna yang berperan sebagai pemberi kerja maupun kandidat melihat jadwal online, waktu/timezone dan tautan ruang. Hubungkan ruang ke sesi signalling yang tervalidasi untuk dua peserta; jangan membuat room broadcast. Kalender hanya menyajikan jadwal; belum ada layanan pengingat/push terjadwal.
6. **Validasi lokal.** Jalankan `npm run build`, `npm run check:function`, suite fixture yang relevan dan E2E khusus perubahan. Gunakan data sintetis di fixture lokal, termasuk pengujian owner/non-owner, membership grup, pendaftaran referral dan kondisi tanpa pembayaran. Ulangi regresi chat→menu→Dasbor pada 360/390 px. Jangan login memakai akun produksi atau mengirim request mutasi ke URL Supabase.

## Struktur proyek dan pemilik komponen

- `src/pages/`: halaman React per rute; pola existing untuk chat, feed, E-Sport, marketplace, learning center, dashboard dan kalender.
- `src/components/`: UI bersama, `app-shell.tsx`, `profile-settings-dialog.tsx`, `dashboard-calendar.tsx`, `voice-call-overlay.tsx` dan komponen E-Sport.
- `src/lib/`: `api.ts` sebagai klien API, `types.ts` untuk kontrak tipe, `router.tsx` untuk hash-route, `session.tsx` untuk sesi, serta konteks panggilan WebRTC.
- `functions/`: handler/adapter fixture untuk pengujian lokal; jangan gunakan sebagai pengganti backend produksi.
- `supabase/functions/app/`: Edge Function produksi; baseline terpisah dari fixture lokal, dengan service-role client.
- `supabase/migrations/`: migration yang diperiksa dan dipakai workflow deploy Supabase.
- `migrations/`: migration legacy/tambahan historis; tidak otomatis menjadi sumber yang digunakan workflow aktif.
- `dev/`: server fixture, Fake Supabase dan skrip smoke/E2E. File `dev/e2e-mobile-chat-dashboard.mjs` menjadi regresi Playwright dan disertakan pada branch fitur yang diminta pengguna.
- `public/manus-routes.json`: manifest berisi route aplikasi dan disinkronkan untuk halaman baru.

## Pengelompokan pekerjaan

Implementasi dilakukan bertahap setelah rencana ini disetujui: fondasi skema/otorisasi dan tipe API; chat serta notifikasi; E-Sport; lowongan/order/referral; jadwal dan ruang wawancara; kemudian validasi integrasi baca-saja. Tahap integrasi lokal tersebut kini selesai dan hasil pengujiannya tercatat di `TODO.md`. Dependencies utama: wawancara bergantung pada lowongan/lamaran; notifikasi order bergantung pada pencatatan order; chat panitia bergantung pada role panitia/grup privat; kalender online bergantung pada record jadwal wawancara. Tidak ada bagian yang boleh memakai data produksi dalam tes.
