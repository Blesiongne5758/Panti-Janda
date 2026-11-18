# TODO

- [x] **Dasbor dan akses akun non-janda** — `accounts.account_kind` membedakan `janda`, `non_janda`, dan admin; jenis akun non-janda tidak disamakan dengan akun publik/pengunjung. Pertahankan role Kades dan ladder progres lama untuk non-janda. Semua akun non-admin diarahkan ke `/dasbor` setelah login/registrasi dan dapat menggunakan fitur anggota seperti akun janda, termasuk fitur profil yang memakai identitas komunitas non-janda tanpa verifikasi janda. Fitur admin tetap khusus `role = admin`; role progres tinggi non-admin tidak boleh memanggil API admin.
- [x] **XP kontribusi** — Kedua jenis akun memperoleh XP setelah kontribusi berhasil: pengirim gift koin +20 XP sekali per transfer sukses; donor galang dana koin +20 XP sekali per donasi sukses; buyer marketplace +20 XP sekali per pembelian sukses. Reward event 50 XP dan turnamen E-Sport 60 XP tetap. Reward QRIS kampanye 20 XP bagi pemilik kampanye tetap. Retry tidak boleh menggandakan reward.
- [x] **Gift dan galang dana dengan koin** — Gift memindahkan koin 1:1 tanpa biaya; donasi mengurangi saldo donor dan mencatat kampanye. Saldo, ledger, donasi/gift, XP, dan idempotency tersimpan atomik agar retry tidak mendebit atau memberi XP dua kali.
- [x] **Checkout marketplace dengan koin** — Listing memiliki harga koin terpisah dari harga Rupiah. Pembelian mendebit buyer dan mengkredit seller dengan jumlah sama tanpa biaya; mencatat order, memberi buyer 20 XP, dan mencegah order ganda atau listing terjual berulang. Harga Rupiah lama tetap.
- [x] **Rilis production** — Commit `2d12a93` berhasil dipush ke `main`; GitHub Actions run `43922593604` sukses pada checkout, validasi, build, migration preflight, deploy Edge Function `app`, deploy `chat-storage`, dan FTP sync. Preflight melaporkan “Remote database is up to date”, jadi run tersebut tidak menerapkan migration apa pun dan tidak menemukan migration tertunda. Pemeriksaan baca-saja `auth.me` tanpa sesi mengembalikan `401 not_authenticated`.
- [ ] **Smoke production lanjutan** — URL checklist sudah dikoreksi ke `https://www.pantijanda.my.id/`, tetapi verifikasi HTTPS gagal karena sertifikat mengembalikan `unable to get local issuer certificate`. Perbaiki/verifikasi rantai sertifikat sebelum menandai HTTPS lulus. Dashboard mobile terautentikasi belum diuji pada production karena belum tersedia akun uji production yang disetujui; jangan membuat akun/transaksi/donasi untuk tes ini.

---

# Status implementasi fitur komunitas dan wawancara

Implementasi berada di branch `feature/community-workflows-interviews`. Tes mutasi dijalankan hanya pada server fixture in-memory dan data sintetis lokal.

## 1. Chat dan navigasi mobile
- [x] **Chat tidak kosong pada halaman publik dan akun berbeda** — smoke test lokal memeriksa halaman publik (menampilkan gerbang Masuk/Daftar), Wulan (akun terverifikasi), serta Budi (akun non-janda); setiap halaman merender konten dan tidak mencatat error runtime.
- [x] **Dari chat aktif ke Dasbor pada mobile** — `dev/e2e-mobile-chat-dashboard.mjs` lulus pada viewport 360 px dan 390 px, tanpa konten kosong, overflow horizontal, atau error runtime.
- [x] **Receipt pesan grup dan DM** — E2E membuktikan pesan baru menunjukkan `sent` (satu centang), lalu `read` (dua centang) setelah penerima DM atau anggota grup membaca. Kasus grup menguji snapshot anggota panitia pada fixture privat.

## 2. Kompetisi E-Sport
- [x] **Sponsor dan banner sponsor utama** — API menyimpan daftar sponsor serta satu sponsor utama; detail turnamen mengambil datanya dan menampilkan banner/logo utama di panel “Siaran & Caster”. Fixture E2E membuktikan hanya satu sponsor utama dan menolak perubahan sponsor dari non-pengelola. Banner adalah elemen pada halaman siaran aplikasi; karena tautan live saat ini membuka provider eksternal, gambar ini bukan overlay yang disuntikkan ke output video provider.
- [x] **Anggota, peran dan grup privat panitia** — E2E menguji penugasan peran, daftar panitia, pembentukan grup privat, akses anggota melalui endpoint deep-link dan pesan, serta penolakan akses baca/kirim bagi non-panitia dan perubahan oleh non-pengelola.
- [x] **Kompetisi online/onsite dan venue** — E2E menguji pembuatan online tanpa venue, menolak onsite tanpa nama/alamat lokasi, dan memeriksa venue onsite pada detail turnamen.

## 3. Fitur komunitas lain
- [x] **Notifikasi like/komentar feed** — owner menerima notifikasi dengan deep link; self-like dan unlike tidak membuat notifikasi baru.
- [x] **Order marketplace** — order sintetis tercatat, tampak pada riwayat pembeli dan akun penjual, mengirim notifikasi deep link kepada penjual, dan perubahan status penjual terlihat oleh pembeli.
- [x] **Referral** — E2E membuktikan pendaftaran dengan kode valid menyimpan atribusi satu kali dan kode tidak valid ditolak. Tampilan kode/tautan di pengaturan sudah masuk build.
- [x] **Lowongan kerja** — E2E membuktikan pemberi kerja membuat listing, kandidat melamar, pemilik melihat lamaran, dan akun lain tidak dapat membaca data lamaran tersebut.

## 4. Wawancara kerja dan kalender
- [x] **Penjadwalan onsite/online dan notifikasi kandidat** — E2E menguji penolakan wawancara onsite tanpa lokasi, venue yang terlihat oleh kandidat, notifikasi wawancara online dengan tautan ruang, serta akses yang dibatasi kepada peserta.
- [x] **Ruang video online dan kalender** — route daftar/ruang wawancara terdaftar; jadwal online muncul pada kalender pemberi kerja dan kandidat dengan tautan ruang. E2E membuktikan join hanya dalam jendela waktu, panggilan video dua peserta terikat ke ID wawancara, dan signaling wawancara menolak orang luar serta mode audio. Panggilan fixture diakhiri setelah assertion untuk menghindari modal masuk tertinggal.

## 5. Hasil verifikasi integrasi
- `npm run test:community-workflows`: **37 lulus, 0 gagal**.
- `npm run test:call-signaling`: **12 lulus, 0 gagal**.
- `dev/e2e-mobile-chat-dashboard.mjs`: **lulus pada 360 px dan 390 px**.
- `npm run build`, `npm run check:function`, dan `git diff --check`: lulus.
- `public/manus-routes.json`: **HTTP 200**, JSON valid, 47 route termasuk `/lowongan/wawancara` dan `/lowongan/wawancara/:id`.

## Batasan operasional
- Push ke branch fitur diminta secara eksplisit; branch ini tidak memicu workflow deploy yang hanya berjalan pada push ke `main`. Tidak ada deploy atau eksekusi migration.
- Tes mutasi hanya mengenai fixture in-memory lokal, bukan Supabase/produksi.
- Migration komunitas dan wawancara tetap aditif dan belum dijalankan.
- `functions/handler.mjs` dan `supabase/functions/app/handler.mjs` dipertahankan sebagai handler terpisah; pemeriksaan sinkronisasi signaling lulus.
