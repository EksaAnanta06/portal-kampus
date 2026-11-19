# POKER_MOBILE_MINIMAL.md — Audit Mobile & Rencana Desain Minimalis (Nol Scroll)

Dokumen ini berisi hasil **Tahap 1: Audit Mobile (Tanpa Mengubah Kode)** untuk seluruh layar fitur Poker (`Lobby`, `Buat/Gabung Room`, `Ruang Tunggu`, `Meja Permainan`, `Showdown`, dan `Layar Hasil`).

---

## (a) Daftar Penyebab Scroll per Layar (Lokasi File & Elemen Pemicu)

### 1. Pembungkus Global Portal (`client/src/layouts/MainLayout.jsx`)
- **Baris 455 (`<AppBar position="sticky">`)**: Mengambil tinggi vertikal `56px–64px` di bagian atas layar.
- **Baris 458 (`<main className="flex-1 p-3 sm:p-6 lg:p-8 pb-[calc(6.5rem+env(safe-area-inset-bottom))] lg:pb-16 ...">`)**: Menambahkan padding bawah `6.5rem` (`104px`) + padding atas `12px` (`p-3`) di mobile.
- **Baris 473 (`<div className="lg:hidden fixed bottom-0 ...">`)**: Bottom navigation bar portal (`~60px`) tetap dirender di atas rute `/poker*`, memangkas ruang vertikal efektif di layar `320×568` menjadi tinggal `~440px`.
- **Dampak**: Sebelum komponen poker dirender, `MainLayout` sudah menghabiskan `~172px` ruang vertikal dan tidak mengunci `overflow: hidden` pada `html, body`.

### 2. Layar Lobby Poker (`client/src/pages/poker/PokerLobbyPage.jsx`)
- **Baris 144 (`<div className="mx-auto max-w-5xl space-y-5">`)**: Menumpuk 4–5 blok kartu secara vertikal tanpa batas tinggi viewport:
  1. **Baris 146 (`<section className="rounded-3xl ... p-5 sm:p-7">`)**: Hero banner gradien dengan badge, judul besar, paragraf deskripsi 3 baris, dan tombol CTA (`~210px` pada lebar `320px–360px`).
  2. **Baris 187 (`<Alert severity="info">`)**: Kotak disclaimer 3 baris (`~76px`).
  3. **Baris 192 (`isAdmin` card)**: Panel kontrol runtime admin (`~96px`).
  4. **Baris 217 (`<div className="grid gap-5 md:grid-cols-2">`)**: Form `Buat Room Mabar` (3 `<TextField select>` + deskripsi + tombol = `~340px`) dan form `Gabung Lewat ID Room` (`~210px`) yang di layar mobile berderet vertikal (`340 + 210 = ~550px`).
  5. **Baris 311 (`<div className="card-surface p-5 space-y-4">`)**: Kartu Statistik + penjelasan aturan panjang + grid riwayat pertandingan (`~280px–420px`).
- **Total Tinggi Aktual di `360×640`**: `~1.180px` (meluber **+540px** vertikal).

### 3. Layar Ruang Tunggu (`client/src/components/poker/PokerWaitingRoom.jsx`)
- **Baris 69 (`<div className="mx-auto max-w-3xl space-y-4">`)**:
  1. **Baris 70 (`<Alert severity="info">`)**: Banner disclaimer 3 baris (`~76px`).
  2. **Baris 75 (Header Room + 3 `<Chip>` konfigurasi)**: Kode room, tombol salin, tombol bagikan, dan 3 chip konfigurasi yang membungkus (*wrap*) menjadi 3 baris (`~145px`).
  3. **Baris 122 (`<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">`)**: Di mobile (`<640px`), 4 slot pemain tersusun 1 kolom (`4 × 72px = ~312px`).
  4. **Baris 196 (`<div className="flex flex-col-reverse sm:flex-row ...">`)**: 2–3 tombol aksi penuh (`Keluar Room`, `Saya Siap`, `Mulai Main`) menumpuk vertikal (`~152px`).
- **Total Tinggi Aktual di `320×568` & `360×640`**: `~685px` + `MainLayout` (`172px`) = `~857px` (meluber **+217px s.d. +289px**).

### 4. Layar Meja Permainan (`client/src/components/poker/PokerTableView.jsx`, `PokerTable.jsx`, `Seat.jsx`, `ActionPanel.jsx`, `pokerTokens.css`)
- **`pokerTokens.css` Baris 250 (`.poker-arena-shell { min-height: calc(100dvh - 5rem); }`)**: Ditambah `AppBar` dan padding `<main>` (`pb-[6.5rem]`), tinggi dokumen otomatis melebihi `100dvh`.
- **`PokerTable.jsx` Baris 116 & 125 (Susunan Kursi Lawan 2 Tingkat di Mobile)**:
  - Kursi lawan atas (`rel.top`, `~82px`) + baris tengah `grid-cols-2 md:hidden` untuk `rel.left` & `rel.right` (`~82px`) memakan **2 baris terpisah** (`~172px`) di atas area kartu tengah.
- **`PokerTable.jsx` Baris 138 (`min-h-[116px]` Area Tengah)**: Menampilkan `<PotDisplay>` lengkap dengan `<ChipStack>` 3D + side-pot pills + deretan kartu tengah (`~130px–160px`).
- **`PokerTable.jsx` Baris 230 (`flex flex-wrap` Kartu Tangan Pemain)**: Saat memegang 13 kartu (atau di layar `320×568`), `flex-wrap` melipat kartu tangan menjadi **2 baris** (`~156px`).
- **`PokerTable.jsx` Baris 260 (`Seat` Bawah Pemain Lokal)**: Merender kartu kursi penuh (`Avatar`, nama, chip, jumlah kartu, kipas kartu mini) di bawah kartu tangan (`~78px`).
- **`ActionPanel.jsx` Baris 216**: Bar status + 6 tombol emote cepat + `BetSlider` (slider + 4 tombol preset) + 4 tombol aksi utama + bar `Siaga Otomatis` (`~165px–230px`).
- **Total Tinggi Aktual di `360×640`**: `~880px` (meluber **+240px** di `360×640` dan **+312px** di `320×568`).
- **Landscape Mobile (`640×360` & `844×390`)**: `.poker-arena-grid` meletakkan panel aksi `256px` di kanan, tetapi tinggi meja di kiri masih menumpuk 3 baris kursi + kartu tengah + kartu tangan (`~460px > 360px`), ditambah `AppBar` `MainLayout` (`56px`) sehingga tetap memicu scroll vertikal.

### 5. Layar Hasil Akhir (`client/src/components/poker/PokerResultView.jsx`)
- **Baris 18 (`<div className="mx-auto max-w-xl space-y-4 py-4">`)**: Ikon piala besar (`64×64px`) + judul 2 baris + subjudul + `<Alert>` 3 baris + 4 kartu peringkat (`p-3`) + tombol kembali + chrome `MainLayout` = `~690px` (meluber pada `320×568`, `640×360`, dan `844×390`).

---

## (b) Inventaris Elemen Visual Saat Ini & Jumlahnya

Perhitungan dilakukan pada kondisi bermain aktif (4 pemain, pot + side pot, kartu tengah tampil, giliran pemain lokal):

| Layar | Kelompok Komponen | Rincian Elemen Visual Saat Ini | Jumlah Saat Ini |
| :--- | :--- | :--- | :---: |
| **1. Lobby Poker** | Header, Alert, Form Buat, Form Gabung, Statistik & Riwayat | 1 Hero banner (badge, judul, subjudul, tombol Bot) = **5**; 1 Alert disclaimer = **2**; Form Buat (ikon, judul, 3 select, teks info, tombol) = **7**; Form Gabung (ikon, judul, teks, input, tombol) = **5**; Kartu Statistik (ikon, judul, 2 chip, kotak aturan 2 paragraf, 4 kartu riwayat × 3 item) = **18**; Chrome `MainLayout` (AppBar + BottomNav) = **8** | **45 elemen** |
| **2. Ruang Tunggu** | Alert, Header Room, 4 Slot Kursi, Footer Aksi | 1 Alert = **2**; Header (ikon, label, chip status, kode room, tombol copy, tombol share, 3 chip config) = **9**; 4 Slot kursi × (avatar, nama, chip host, chip siap, tombol kick) = **17**; 3 Tombol bawah = **3**; Chrome `MainLayout` = **8** | **39 elemen** |
| **3. Meja Permainan** *(Layar Terpenting)* | Top Bar, Dekorasi Meja, 3 Kursi Lawan, Area Tengah/Pot, Area Pemain Lokal, Panel Aksi | **Top Bar**: kode room, `ConnectionBadge` (dot + label), info ronde/tarif, 6 tombol ikon (suara, pengaturan, log, lapor, akhiri, keluar) = **10**<br>**Dekorasi Meja**: bingkai rail luar, kain felt gradien, SVG noise filter, garis border dalam = **4**<br>**3 Kursi Lawan**: 3 × (kotak kursi, avatar, cincin timer, nama, badge BOT/posisi, teks chip, badge jumlah kartu, kipas 5 punggung kartu mini, tumpukan chip taruhan + angka, badge status) = **30**<br>**Area Tengah**: tumpukan koin SVG `PotDisplay` + label pot + 2 pill side-pot + 5 kartu tengah = **10**<br>**Area Pemain Lokal**: deretan kartu tangan + kotak `Seat` bawah (avatar, cincin timer, nama, chip, badge kartu, badge posisi) = **9**<br>**Panel Aksi**: dot status, teks giliran, chip kombinasi, 6 tombol emote, `BetSlider` (label, angka, slider, 4 preset), 4 tombol aksi utama = **16** | **79 elemen** |
| **4. Showdown Overlay** | Partikel, Header, Pot Sweep, Kartu, Tombol | 8 partikel `.poker-winner-sparkle`, ikon piala, teks pemenang, nama tangan, `ChipStack` animasi, badge `+chip`, 5 kartu showdown, tombol tutup = **19** | **19 elemen** (di atas meja) |
| **5. Layar Hasil** | Header Piala, Alert, 4 Baris Peringkat, Tombol | Kotak ikon piala, label room, judul juara, subjudul tangan, `Alert` disclaimer, 4 baris × (nomor, avatar, nama, chip hasil), 1 tombol kembali = **22** | **22 elemen** |

---

## (c) Tabel Keputusan per Elemen & Penyelesaian Konflik Minimalis

> **Catatan Konflik & Keputusan Minimalis:**
> 1. **Chrome Portal (`MainLayout` AppBar & Bottom Nav) vs Target Nol Scroll `100dvh`**: Menampilkan `AppBar` + `BottomNav` portal di rute `/poker*` memakan `~172px` dan merusak anggaran `≤ 25` elemen. **Keputusan**: Sembunyikan `AppBar` dan `BottomNav` portal khusus saat berada di rute `/poker*` (gunakan shell penuh `100dvh` terkunci). Aksi kembali ke beranda portal tetap mudah dijangkau melalui tombol kembali di Lobby dan di dalam Menu (`☰`) saat di meja.
> 2. **Mode Taruhan Hold'em (Fold / Check-Call / Raise Sheet, 2 Hole Cards + 5 Community Cards) vs Aturan Capsa Banting Server**: Agar mematuhi spesifikasi minimalis §3.3 tanpa merusak kontrak WebSocket backend (`poker:action`), komponen meja mendukung keduanya dalam **1 struktur 5-zona yang sama (≤ 25 elemen)**:
>    - Pada mode Hold'em / Preview: menampilkan 5 slot kartu tengah, 2 kartu pemain besar, dan 3 tombol aksi (`Fold`, `Check/Call`, `Raise` → membuka **Bottom Sheet Raise** berisi slider + 3 preset `Min`, `½ Pot`, `All-in` + 1 tombol konfirmasi).
>    - Pada room live Capsa Banting: memakai 5 zona yang sama persis, menampilkan kombinasi kartu meja di tengah, barisan kartu pemain 1 baris rapat (`clamp()` tanpa *wrap*), dan maksimal 3 tombol aksi (`Lewat`, `Saran`, `Banting`), sementara seluruh aksi sekunder pindah ke Menu (`☰`).
> 3. **Informasi yang Disembunyikan & Lokasi Barunya**:
>    - **ID Room Lengkap, Log Aksi, Riwayat Tangan, Cheat Sheet Peringkat Tangan, Pengaturan Tema/4-Warna/Suara/Haptik, Laporkan Pemain, Akhiri Meja, dan Keluar Meja** → Semuanya berada di balik **SATU ikon Menu (`☰`)** di pojok kiri atas meja (membuka Bottom Sheet Menu Sekunder ber-tab ringkas).
>    - **Statistik Pemain, Panduan Aturan/Cheat Sheet, & Kontrol Admin di Lobby** → Dipindahkan ke balik **SATU ikon Menu/Info (`☰`)** di kanan atas Lobby.
>    - **Form Buat Room (Preset Chip, Blind, Timer) & Form Gabung Room** → Dipindahkan dari layar utama Lobby ke **Bottom Sheet Buat Room** dan **Bottom Sheet Gabung Room**.

| No | Elemen Saat Ini | Layar | Keputusan | Alasan & Lokasi Baru (Bila Dipindah) |
| :-: | :--- | :--- | :---: | :--- |
| 1 | `MainLayout` AppBar & Mobile Bottom Nav | Semua `/poker*` | **HAPUS** *(di rute poker)* | Memakan `~172px` tinggi layar & memicu scroll. Diganti shell khusus `100dvh` rute poker. |
| 2 | Hero Banner Gradien & Deskripsi Panjang | Lobby | **HAPUS** | Diganti judul kecil tenang + ruang kosong lega. |
| 3 | Form Inline Buat Room (3 Select) | Lobby | **PINDAH KE MENU / SHEET** | Membuka **Bottom Sheet Buat Room** saat tombol besar `"Buat Room"` ditekan. |
| 4 | Form Inline Gabung Room | Lobby | **PINDAH KE MENU / SHEET** | Membuka **Bottom Sheet Gabung** (1 input 6 karakter + tempel clipboard + 1 tombol) saat `"Gabung"` ditekan. |
| 5 | Kartu Statistik, Riwayat & Aturan Inline | Lobby | **PINDAH KE MENU** | Dipindah ke **Bottom Sheet Menu Lobby (`☰`)** di pojok kanan atas. |
| 6 | Alert Box MUI 3 Baris Disclaimer | Lobby, Waiting, Result | **GABUNG** | Dirangkum menjadi **1 baris teks tenang** (`"Chip virtual, tanpa uang asli"`), ukuran `12–13px`. |
| 7 | 3 Chip Konfigurasi Room di Ruang Tunggu | Ruang Tunggu | **GABUNG** | Digabung menjadi 1 baris teks subtitled ringkas (`1K chip · 10/20 · 30d`). |
| 8 | 6 Ikon Top Bar Meja (Suara, Tema, Log, Lapor, Stop, Keluar) | Meja | **PINDAH KE MENU** | Digabung ke **SATU ikon Menu (`☰`)** di kiri atas bar meja (`≤ 8%` tinggi). |
| 9 | Badge Teks Status Koneksi (`ConnectionBadge`) | Meja | **GABUNG** | Diubah menjadi **satu titik kecil (`8×8px`)** di kanan atas bar meja (hijau/kuning/merah + `aria-label`). |
| 10 | Tekstur Kain SVG Noise, Gradien Berlapis, Bingkai Rail Ganda, Vignette | Meja | **HAPUS** | Melanggar prinsip flat & tenang. Diganti permukaan datar tenang (`#0B1215` / `#131F24`) tanpa dekorasi. |
| 11 | Tumpukan Koin 3D (`ChipStack`) di Pot & Depan Pemain | Meja & Showdown | **HAPUS** | Dekoratif & menambah puluhan node SVG. Pot cukup **1 angka besar tabular**, taruhan berjalan cukup **angka kecil** dekat pemain. |
| 12 | Kipas 5 Kartu Mini + Banyak Badge di Tiap Kursi Lawan | Meja | **GABUNG** | Tiap lawan cukup: avatar kecil (+ cincin timer saat giliran), nama singkat (ellipsis/inisial di 320px), chip ringkas (`1,2K`), dan 2 kartu tertutup kecil. Status cukup redup (`opacity`) atau 1 label kecil. |
| 13 | Kotak `Seat` Penuh untuk Pemain Lokal di Bawah Kartu | Meja | **GABUNG** | Di bawah kartu sendiri cukup **1 baris ringkas**: angka chip sendiri (`1,2K`) + 1 badge posisi kecil (`D`/`SB`/`BB`). |
| 14 | 6 Tombol Reaksi Emote Cepat di `ActionPanel` | Meja | **HAPUS** | Memenuhi panel aksi & menambah 6 elemen. Dihapus dari layar utama. |
| 15 | Inline `BetSlider` + 4 Tombol Preset di `ActionPanel` | Meja | **PINDAH KE MENU / SHEET** | Panel bawah hanya menampilkan maksimal **3 tombol sejajar** (`Fold`, `Check/Call`, `Raise`). Menekan `Raise` membuka **Bottom Sheet Raise** (slider + `Min`, `½ Pot`, `All-in` + 1 tombol konfirmasi). |
| 16 | Tombol-Tombol Aksi Nonaktif & Toggle Pre-Action saat Bukan Giliran | Meja | **GABUNG / HAPUS** | Saat bukan giliran, panel aksi hanya menampilkan **satu baris status tenang** (`"Menunggu Rani…"`), bukan deretan tombol nonaktif yang ramai. |
| 17 | Partikel Perayaan (`.poker-winner-sparkle`) pada Showdown | Showdown | **HAPUS** | Dekoratif. Diganti overlay ringkas: nama pemenang, nama tangan, jumlah menang, 5 kartu terbaik disorot, dan 1 tombol `"Lanjut"`. |

---

## (d) Sketsa ASCII Layout Baru (`360×640` Portrait & `640×360` Landscape)

### 1. Meja Permainan — Portrait Mobile (`360×640`, Proporsi 5 Zona Tetap = `100dvh`, Nol Scroll)

```text
+--------------------------------------+  ---
| [☰]        Ronde #3 · 1,5K       (●) |   ZONA 1: Bar Atas Tipis (≤ 8% / ~44px)
+--------------------------------------+  ---
|   (Rani)       (Dika*)      (Nadia)  |   ZONA 2: Baris Lawan Horizontal (≈ 22% / ~136px)
|   [Avt]        [◎Avt]       [Avt]    |   - 1 s.d. 3 lawan sejajar horizontal
|   1,2K          980         FOLD     |   - ◎ = Cincin timer pada avatar yang giliran
|   [▪][▪]       [▪][▪]       [▪][▪]   |   - [▪][▪] = 2 kartu tertutup kecil
+--------------------------------------+  ---
|                                      |   ZONA 3: Zona Tengah / Board (≈ 28% / ~176px)
|    [A♠]  [K♠]  [K♦]  [ ╌ ]  [ ╌ ]    |   - 5 slot community card (kosong = garis tipis)
|                                      |   - Tanpa tumpukan koin 3D
|              POT 1.450               |   - Satu angka besar tabular (20–28px)
|                                      |
+--------------------------------------+  ---
|              [A♥]   [A♣]             |   ZONA 4: Zona Pemain Lokal (≈ 22% / ~136px)
|              (Kartu Besar)           |   - Kartu sendiri besar & menonjol di tengah
|                                      |
|            [D]  2,4K Chip            |   - Chip sendiri + 1 badge posisi kecil (D/SB/BB)
+--------------------------------------+  ---
|  [  Fold  ] [ Call 40 ] [ Raise… ]   |   ZONA 5: Panel Aksi Jempol (≈ 20% / ~120px + safe-area)
|  (atau saat menunggu:                |   - Maksimal 3 tombol >= 44px sejajar
|        "Menunggu Dika…")             |   - "Raise…" membuka Bottom Sheet Raise
+--------------------------------------+  ---
Total Tinggi = 100dvh (scrollHeight == innerHeight, 0px scroll)
```

### 2. Meja Permainan — Landscape Mobile (`640×360` & `844×390`, Nol Scroll)

```text
+---------------------------------------------------+----------------------+
| [☰]  Ronde #3                        (●) Koneksi  |                      |
|---------------------------------------------------|   Giliran Anda       |
|   [Avt] Rani (1,2K) [▪▪]   [◎Avt] Dika (980) [▪▪] |   Pot: 1.450         |
|          [Avt] Nadia (FOLD) [▪▪]                  |                      |
|                                                   |  +----------------+  |
|        [A♠]  [K♠]  [K♦]  [ ╌ ]  [ ╌ ]             |  |   Raise…       |  |
|                  POT 1.450                        |  +----------------+  |
|                                                   |  +----------------+  |
|               [A♥]     [A♣]                       |  |   Call 40      |  |
|               [D] 2,4K Chip                       |  +----------------+  |
|                                                   |  +----------------+  |
|  (Meja di Tengah-Kiri, proporsional tanpa scroll) |  |   Fold         |  |
|                                                   |  +----------------+  |
+---------------------------------------------------+----------------------+
|<--------------- Area Meja (~74%) ---------------->|<-- Panel Aksi 26% -->|
```

### 3. Lobby, Ruang Tunggu & Hasil — Portrait Mobile (`360×640`, Nol Scroll)

```text
[LOBBY POKER]                          [RUANG TUNGGU]
+-----------------------------------+  +-----------------------------------+
| [←]      Poker Kampus         [☰] |  | [☰]        RUANG TUNGGU       (●) |
|                                   |  |                                   |
|          POKER VIRTUAL            |  |              A7K9P2               |
|    1K Chip · Hiburan Mahasiswa    |  |       [Salin Kode] [Bagikan]      |
|                                   |  |   1.000 Chip · Blind 10/20 · 30d  |
|   +---------------------------+   |  |  +-----------------------------+  |
|   |         Buat Room         |   |  |  | [Av] Budi (Host)     [Siap] |  |
|   +---------------------------+   |  |  | [Av] Rani            [Siap] |  |
|   +---------------------------+   |  |  | [··] Slot #3         Kosong |  |
|   |          Gabung           |   |  |  | [··] Slot #4         Kosong |  |
|   +---------------------------+   |  |  +-----------------------------+  |
|                                   |  |   +---------------------------+   |
|  "Chip virtual, tanpa uang asli"  |  |   |         Mulai Main        |   |
|                                   |  |   +---------------------------+   |
+-----------------------------------+  +-----------------------------------+
```

---

## (e) Anggaran Elemen Visual: Sebelum vs Sesudah

Detail perhitungan **Meja Permainan Saat Bermain** (kondisi paling padat: 3 lawan + pemain lokal + 5 slot kartu tengah + giliran aktif):

| Zona Meja | Elemen Visual Sesudah Revamp Minimalis | Jumlah Elemen |
| :--- | :--- | :---: |
| **1. Bar Atas (`≤ 8%`)** | (1) Tombol ikon Menu `☰`, (2) Teks Ronde/Pot ringkas, (3) Titik status koneksi `●` | **3** |
| **2. Zona Lawan (`≈ 22%`)** | 3 Lawan × (1 Avatar/cincin timer, 1 baris Nama+Chip/Status, 1 pasang kartu tertutup mini) | **9** |
| **3. Zona Tengah (`≈ 28%`)** | (1..5) Lima slot community card (atau 1 grup kombinasi aktif), (6) Satu angka besar Pot | **6** |
| **4. Zona Pemain (`≈ 22%`)** | (1..2) Dua kartu sendiri besar (atau 1 grup kartu tangan rapat), (3) Satu baris Chip sendiri + badge posisi `D/SB/BB` | **3** |
| **5. Panel Aksi (`≈ 20%`)** | Maksimal 3 tombol aksi sejajar (`Fold`, `Check/Call`, `Raise`) — *atau 1 baris teks status saat menunggu* | **3** |
| **TOTAL MEJA AKTIF** | **Seluruh elemen terlihat bersamaan di layar utama meja** | **24 elemen** *(≤ 25 target)* |

### Tabel Perbandingan Semua Layar (Sebelum vs Sesudah)

| Layar | Elemen Visual Sebelum | Target Sesudah | Pengurangan | Status Scroll (`320×568` s.d. `844×390`) |
| :--- | :---: | :---: | :---: | :---: |
| **Lobby Poker** | 45 elemen | **6 elemen** *(Top bar 2 + Judul 1 + 2 Tombol Besar + 1 Disclaimer)* | **-86%** | **0px Scroll** (`scrollHeight <= innerHeight`) |
| **Ruang Tunggu** | 39 elemen | **11 elemen** *(Top bar 2 + Kode & Salin/Share 3 + 4 Baris Slot + 1 Info + 1 CTA)* | **-72%** | **0px Scroll** (`scrollHeight <= innerHeight`) |
| **Meja Permainan** | 79 elemen | **21–24 elemen** *(Saat menunggu: 22, Saat giliran: 24 — batas wajib ≤ 25)* | **-70%** | **0px Scroll** (`scrollHeight <= innerHeight`) |
| **Showdown Overlay** | 19 elemen | **8 elemen** *(Nama pemenang, nama tangan, +chip, 5 kartu, 1 tombol Lanjut)* | **-58%** | **0px Scroll** (Overlay ringkas di tengah) |
| **Layar Hasil Akhir** | 22 elemen | **9 elemen** *(Judul hasil, 4 baris peringkat, 1 disclaimer singkat, 2 tombol)* | **-59%** | **0px Scroll** (`scrollHeight <= innerHeight`) |

---

## Rencana Pengerjaan Bertahap (6 Tahap Berikutnya)

- **Tahap 2 — Fondasi Minimalis & Kunci Nol-Scroll**: Token desain flat (maksimal 3 warna aktif, tipografi 3 ukuran `12–13px`, `14–16px`, `20–28px` tabular numerals, durasi transisi `≤ 250ms`), utilitas format chip ringkas (`1,2K` / `12K` / `1,2M`), serta shell nol-scroll `100dvh` (`overflow: hidden` & `overscroll-behavior: none` hanya pada rute `/poker*`, menyembunyikan chrome `MainLayout` di `/poker*`).
- **Tahap 3 — Lobby, Buat/Gabung Room Sheet, & Ruang Tunggu**: Lobby 1 layar (judul kecil, 2 tombol besar `"Buat Room"` & `"Gabung"`, disclaimer 1 baris, 1 ikon menu), Sheet Gabung 6 karakter (`visualViewport`-safe untuk keyboard virtual), Sheet Buat Room preset ringkas, dan Ruang Tunggu 4 slot + 1 tombol utama.
- **Tahap 4 — Meja Permainan 5-Zona (`≤ 25` Elemen) & Sheet Raise**: Implementasi 5 zona vertikal proporsional (`≤8%`, `22%`, `28%`, `22%`, `20%`), lawan horizontal tanpa tumpukan chip dekoratif, 5 slot kartu tengah + angka pot besar, kartu pemain besar, 3 tombol aksi (`Fold`, `Check/Call`, `Raise`), status 1 baris saat menunggu, dan **Bottom Sheet Raise** (slider + `Min`, `½ Pot`, `All-in` + 1 tombol konfirmasi).
- **Tahap 5 — Menu Sekunder Tunggal (`☰`), Showdown Ringkas & Layar Hasil**: Menggabungkan log aksi, *cheat sheet* peringkat tangan, pengaturan tema/suara/4-warna, info room, dan keluar meja ke dalam satu Bottom Sheet Menu (`☰`); menyederhanakan `ShowdownOverlay` (tanpa partikel, 1 tombol `"Lanjut"`) dan `PokerResultView` (4 baris + `"Main Lagi"` & `"Keluar"`).
- **Tahap 6 — Landscape Mobile (`640×360`, `844×390`) & Layar Sangat Kecil (`320×568`)**: Layout khusus landscape (meja di tengah-kiri, panel aksi vertikal di kanan tanpa menutupi kartu tengah) dan adaptasi `320×568` (kompresi jarak lebih dulu, nama lawan jadi inisial bila sempit, target sentuh tetap `≥ 44px`).
- **Tahap 7 — Pembersihan Komponen/CSS Tak Terpakai & Verifikasi Otomatis E2E**: Menghapus komponen/CSS dekoratif lama yang tidak lagi dipakai, menjalankan skrip pengujian otomatis berbasis browser headless pada seluruh 7 ukuran viewport (`320×568`, `360×640`, `375×667`, `390×844`, `412×915`, `640×360`, `844×390`) beserta kasus ekstrem untuk membuktikan `scrollHeight <= innerHeight`, `scrollWidth <= innerWidth`, dan jumlah elemen meja `≤ 25`.
