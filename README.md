# 🎓 Portal Kampus Universitas Nasional Pasim Bandung

Portal web terpadu sivitas akademika **Universitas Nasional Pasim (UNAS PASIM) Bandung**. Berfungsi sebagai arsip dokumentasi kenangan angkatan, warta akademik terpadu, kalender kegiatan & agenda kampus, serta direktori mahasiswa dan alumni.

---

## ⚡ Solusi Cepat: Gagal Login Akun Demo ("Kredensial tidak valid")

Penyebab pesan error **`Kredensial tidak valid (Email/NIM atau Password salah)`**:
Database MySQL kamu saat ini masih menyimpan **hash dummy seeder lama** yang belum pernah diperbarui dengan password hash bcrypt `Pasim123!`.

### Cara Mengatasinya (Pilih Salah Satu):

#### Opsi 1: Jalankan Perintah Update Password (Paling Cepat)
Buka terminal kamu di folder `server/`:
```bash
cd server
npm run seed:passwords
```
*Script ini otomatis mengupdate seluruh password akun demo di database menjadi `Pasim123!`.*

---

#### Opsi 2: Eksekusi SQL Update Langsung di MySQL / phpMyAdmin / DBeaver
Jalankan query SQL berikut di database `db_portal_pasim`:
```sql
USE db_portal_pasim;
UPDATE users SET password_hash = '$2b$10$hUL4glTSJWSGGUZzgGuIg.MlpJ/vuQ7e3UckYU7MaohGyA/FXiNoO';
```
*(Hash di atas adalah enkripsi bcrypt valid untuk password `Pasim123!`)*

---

#### Opsi 3: Re-Import File `seed.sql` Terbaru
File `database/seed.sql` sudah diperbarui dengan hash bcrypt valid `Pasim123!`. Cukup import ulang:
```bash
mysql -u root -p db_portal_pasim < database/seed.sql
```

Setelah salah satu langkah di atas selesai, kamu bisa login kembali ke web.

---

## 🔑 Akun Demo Siap Pakai

Semua akun menggunakan Password:
```text
Pasim123!
```

| No | Peran (Role) | Nama Pengguna | Email Login | NIM Login | Hak Akses & Fitur yang Dapat Dicoba |
|:---:|:---|:---|:---|:---|:---|
| **1** | **Admin** | Dr. Hendra Wijaya, M.Kom. | `admin@pasim.ac.id` | `ADM-001` | **Full Access**: Panel Pengelola, Verifikasi NIM & User, Terbitkan Warta & Agenda, Tambah Angkatan Baru, Moderasi Foto, Pengelolaan Kelas Akademik. |
| **2** | **Dosen** | Dr. Hendra Wijaya, M.Kom. | `dr.hendra@pasim.ac.id` | `DOS-001` | **Dosen Pengampu**: Buat & kelola tugas kuliah, nilai pengumpulan mahasiswa, minta revisi, unduh semua pengumpulan ZIP, ekspor CSV, serta kelola materi perkuliahan 1-16. |
| **3** | **Asisten Lab** | Budi Santoso, S.Kom. | `budi.aslab@pasim.ac.id` | `ASLAB-001` | **Aslab**: Menilai tugas mahasiswa dan membantu kelola materi praktikum kelas. Dibatasi tidak dapat menghapus tugas dosen. |
| **4** | **Mahasiswa (TI)** | Rizky Pratama Nugraha | `rizky.mhs@pasim.ac.id` | `020123014` | **Mahasiswa 2023**: Akses **Tugas Saya** (countdown anti-drift, kumpul tugas multi-versi), **Materi Kuliah** (video player, PDF viewer, checklist progres belajar), serta Galeri. |
| **5** | **Mahasiswa (Manajemen)** | Nadia Aulia Zahra | `nadia.mhs@pasim.ac.id` | `020224008` | **Mahasiswa 2024**: Akun mahasiswa fakultas ekonomi/manajemen untuk uji direktori lintas prodi dan kelas akademik. |
| **6** | **Moderator** | Gilang Ramadhan | `moderator@pasim.ac.id` | `MOD-202201` | **Moderasi**: Menyetujui/menolak foto di antrean moderasi, menyelesaikan laporan pelanggaran konten foto. |
| **7** | **Alumni** | Dinda Kirana Putri, S.Kom. | `dinda.alumni@pasim.ac.id` | `020122001` | **Lulusan 2022**: Unggah foto wisuda/kegiatan, suka & komentar foto, kelola profil direktori & pekerjaan saat ini. |
| **8** | **Pending User** | Farhan Akbar Maulana | `farhan.baru@pasim.ac.id` | `020125099` | **Uji Verifikasi**: Akun berstatus *pending*. Saat login akan ditolak. Masuk sebagai Admin untuk memverifikasi akun ini. |

> 💡 **Tips Cepat Login:** Di halaman `/login`, kamu bisa langsung mengklik tombol **Admin**, **Moderator**, **Alumni**, atau **Mahasiswa** di bagian bawah form untuk otomatis mengisi email & password tanpa perlu mengetik manual.

---

## 💻 Cara Menjalankan Aplikasi

### 1. Jalankan MySQL Database
Pastikan servis MySQL menyala di sistem lokal kamu:
```bash
sudo service mysql start
# atau
sudo systemctl start mysql
```

Jika database belum pernah dibuat, jalankan schema dan seeder utama:
```bash
mysql -u root -p < database/schema.sql
mysql -u root -p db_portal_pasim < database/seed.sql
```

Jalankan juga migrasi skema akademik dan data awal LMS (Modul Assignment Hub & Repositori Materi):
```bash
mysql -u root -p db_portal_pasim < database/migrations/academic_and_lms.sql
mysql -u root -p db_portal_pasim < database/seeders/academic_seed.sql
```

### 2. Jalankan Server Backend
```bash
cd server
npm install
npm run dev
```
*Backend berjalan di: `http://localhost:5000/api/v1`*

### 3. Jalankan Frontend Client
Buka jendela terminal baru:
```bash
cd client
npm install
npm run dev
```
*Frontend berjalan di: `http://localhost:5173`*

---

## 🧭 Panduan Cara Pakai Aplikasi (User Guide)

### A. Sebagai Pengunjung / Publik (Tanpa Login)
1. **Dashboard Utama:** Melihat warta/pengumuman resmi terbaru, agenda kampus mendatang, ringkasan jumlah foto dan angkatan, serta dokumentasi foto terbaru.
2. **Galeri Angkatan:** Menelusuri album kegiatan angkatan 2022 hingga 2025 (Ospek, Praktikum, Makrab, KKN, Wisuda).
3. **Pencarian Cepat (Ctrl + K):** Mengetik kata kunci untuk mencari foto kenangan, judul berita, maupun nama rekan mahasiswa.

### B. Sebagai Mahasiswa & Alumni (Member)
1. **Login:** Masuk melalui tombol **Masuk** di sidebar atau tombol demo login.
2. **Unggah Foto Kenangan:**
   - Masuk ke menu **Galeri Angkatan** atau klik tombol **Unggah Foto Kenangan** di banner dashboard.
   - Pilih hingga 10 foto (JPG/PNG/WEBP), tentukan tahun angkatan, album, caption, tag, dan tanggal momen.
   - Foto mahasiswa akan masuk ke status *Menunggu Moderasi* demi keamanan konten kampus.
3. **Interaksi Sosial:** Klik foto mana saja di grid untuk membuka **Lightbox Modal**. Kamu dapat menyukai (like), menulis komentar diskusi, atau melaporkan foto jika tidak pantas.
4. **Buat Album Baru:** Di dalam halaman detail angkatan, klik **Buat Album** (contoh: *Bazaar Kewirausahaan*, *Dies Natalis*).
5. **Direktori Mahasiswa & Alumni:** Buka menu **Direktori Mahasiswa & Alumni** untuk mencari kontak, profil LinkedIn, Instagram, GitHub, dan riwayat karier rekan seangkatan.
6. **Profil Saya:** Klik menu profil untuk mengubah bio, pekerjaan saat ini, foto avatar, dan mengatur apakah profilmu ingin ditampilkan di direktori publik atau disembunyikan.

### C. Sebagai Moderator
1. Login dengan `moderator@pasim.ac.id` / `Pasim123!`.
2. Klik menu **Panel Pengelola** di sidebar bawah.
3. Buka tab **Antrean Moderasi**:
   - Tab **Foto Menunggu Moderasi**: Tinjau foto-foto yang diunggah mahasiswa. Klik **Setujui** agar foto langsung tayang di galeri publik, atau klik **Tolak** dengan menyertakan alasan.
   - Tab **Laporan Pelanggaran**: Tinjau laporan dari pengguna lain terhadap foto yang dianggap melanggar pedoman kampus. Klik **Selesai** atau **Abaikan**.

### D. Sebagai Administrator
1. Login dengan `admin@pasim.ac.id` / `Pasim123!`.
2. Buka **Panel Pengelola**:
   - **Dashboard Admin:** Melihat statistik lengkap operasional kampus.
   - **Verifikasi NIM & User:** Melihat pendaftaran akun baru berstatus *pending*. Klik **Setujui** untuk mengaktifkan akun mahasiswa baru (contoh akun Farhan), atau ubah peranan pengguna (*Mahasiswa*, *Alumni*, *Moderator*, *Admin*).
   - **Kelola Berita & Event:** Menerbitkan pengumuman baru (mendukung sematan/pinned) dan menambah agenda kalender kegiatan kampus.
   - **Kelola Galeri:** Menambah tahun angkatan baru beserta foto sampul/cover di menu **Galeri Angkatan**.

### E. Menggunakan Modul Assignment Hub & Repositori Materi
1. **Bagi Mahasiswa (`rizky.mhs@pasim.ac.id` / `Pasim123!`):**
   - **Tugas Kuliah Saya:** Buka menu `Tugas Kuliah` di sidebar. Pantau sisa waktu tugas dengan indikator waktu mundur (countdown) real-time bebas drift dalam format WIB.
   - **Kumpulkan Berkas:** Masuk ke detail tugas, seret berkas (PDF/ZIP/DOCX/XLSX/PPTX maks 10 MB) ke area drag-and-drop dengan progress bar.
   - **Riwayat Versi:** Setiap pengumpulan baru tercatat sebagai versi berikutnya (`v1`, `v2`, dst.) dan dapat diunduh menggunakan tautan signed URL aman (15 menit).
   - **Materi & Modul:** Buka menu `Materi Perkuliahan`, telusuri Pertemuan 1 sampai 16 (dengan penanda khusus UTS pertemuan 8 dan UAS pertemuan 16), putar rekaman video YouTube langsung di tempat, pratinjau slide PDF, dan centang "Sudah Dipelajari" untuk mengisi bar progres belajar.
   - **Unduh Semua ZIP:** Klik tombol `Unduh Semua Materi (.ZIP)` untuk mendapatkan seluruh berkas materi perkuliahan dalam struktur folder terorganisir.

2. **Bagi Dosen & Asisten Lab (`dr.hendra@pasim.ac.id` atau `budi.aslab@pasim.ac.id`):**
   - **Kelola Tugas Kelas:** Buka menu `Kelola Tugas Kelas` untuk menerbitkan tugas baru, mengatur deadline, persentase penalti keterlambatan, dan mengunggah lampiran berkas soal.
   - **Rekap & Penilaian:** Buka halaman `Nilai & Rekap` pada tugas terkait. Unduh berkas tugas mahasiswa, beri nilai (0-100), atau minta revisi jika berkas belum sesuai.
   - **Ekspor Nilai & Unduh ZIP:** Unduh rekap nilai mahasiswa dalam format CSV atau unduh seluruh berkas mahasiswa sekaligus dalam format ZIP dengan format nama otomatis `NIM_Nama_vX.ext`.
   - **Kelola Materi:** Buka menu `Materi Perkuliahan`, tambahkan materi baru di pertemuan yang diinginkan, atur visibilitas Terbit/Draft, atau perbarui tautan rekaman.

---

## 🎨 Tampilan & Fitur Dashboard
- **Logo Resmi PASIM:** Menggunakan lambang piramida merah UNAS PASIM di sidebar, favicon browser, dan welcome banner dashboard.
- **Sidebar Navigasi Tetap:** Navigasi modern dengan quick profil box, counter notifikasi, dan toggle mode gelap/terang.
- **Dark Mode Support:** Mendukung pergantian tema gelap (Dark Navy `#0F172A`) dan terang (Clean Slate) yang tersimpan di browser.
