# POKER_UI_BRIEF.md — Audit & Rencana Revamp UI Fitur Poker

> **Status:** Tahap 1 — Audit UI Eksisting & Spesifikasi Desain (Menunggu persetujuan sebelum masuk ke Tahap 2)  
> **Ruang Lingkup Backend:** Tidak mengubah backend atau skema event socket yang sudah ada tanpa persetujuan terpisah.

---

## 1. Audit UI & Kode Eksisting

Berdasarkan inspeksi langsung pada kode frontend fitur poker saat ini ([PokerTableView.jsx](client/src/components/poker/PokerTableView.jsx), [PokerCard.jsx](client/src/components/poker/PokerCard.jsx), [PokerActionPanel.jsx](client/src/components/poker/PokerActionPanel.jsx), [PokerWaitingRoom.jsx](client/src/components/poker/PokerWaitingRoom.jsx), [PokerResultView.jsx](client/src/components/poker/PokerResultView.jsx), [PokerLobbyPage.jsx](client/src/pages/poker/PokerLobbyPage.jsx), [usePokerStore.js](client/src/store/usePokerStore.js), [tailwind.config.js](client/tailwind.config.js), [index.css](client/src/index.css)):

| Aspek | Kondisi Eksisting | Kesenjangan Terhadap Target Visual & UX |
| :--- | :--- | :--- |
| **Meja & Atmosfer** | Kontainer persegi `rounded-3xl border-4` dengan gradien datar `from-emerald-900 via-teal-950 to-slate-900` di dalam `<main>` portal. | Belum berbentuk meja oval/stadion bertingkat dengan *rail* berkilau tipis, tekstur kain (gradien radial + SVG `fractalNoise` halus), vignette lembut, dan bayangan agar terasa melayang di atas latar gelap tenang. |
| **Kartu (`PokerCard.jsx`)** | memakai teks simbol Unicode (`♠ ♥ ♦ ♣`) pada `div`/`button` dengan ukuran tetap `xs`/`sm`/`md`/`lg`; punggung kartu hanya 1 desain teks `"PASIM"`. | Perlu dipisah menjadi `PlayingCard` (ikon suit SVG vektor tajam & indeks terbaca di semua ukuran) dan `CardBack` (minimal 3 desain pola SVG pilihan + animasi *flip* 3D halus). |
| **Chip & Pot** | Nilai chip hanya ditampilkan dalam angka teks (`1.000 chip`) pada kotak kursi; belum ada visual chip 3D maupun pot tengah animatif. | Belum ada `ChipStack` (SVG chip dengan *edge spots* dan warna denominasi + tumpukan 3D ringan) dan `PotDisplay` (animasi *count-up* & luncuran chip ke pot). |
| **Kursi Pemain & Timer** | `OpponentSeatCard` memakai kotak transparan persegi dengan `TurnCountdownBadge` kecil di sebelah kanan kartu kursi. | Cincin timer perlu melingkari langsung avatar bulat (`TurnTimerRing`) dengan transisi warna hijau → kuning → merah saat waktu menipis; badge `DealerButton (D)`, `SB`, `BB`, status redup untuk `Fold/Pass`, sorotan halus `All-in/Bom`, dan redup abu-abu `Away`. |
| **Panel Aksi & Taruhan** | `PokerActionPanel.jsx` saat ini memuat aksi Capsa Banting (`Banting`, `Lewat`, `Saran`, `Angka/Kembang`, `Reset`) + bar emote; elemen slider taruhan Texas Hold'em sebelumnya sudah diganti. | Perlu komponen modular `ActionPanel` & `BetSlider` (slider halus, tombol cepat `Min`, `½ Pot`, `Pot`, `All-in`, tampilan angka besar, konfirmasi All-in, *pre-action* opsional) serta adaptasi panel untuk mode Capsa Banting aktif. |
| **Responsivitas & Landscape HP** | Memakai `min-h-[calc(100dvh-5.5rem)]`, tetapi di mode landscape HP (`height <= 480px`), panel aksi bawah tetap menumpuk vertikal sehingga menyempitkan meja & tangan 13 kartu. | Perlu *container queries* + proporsi skala variabel CSS agar rasio meja konsisten dari `360×640` hingga `1920×1080`, serta layout khusus **landscape mobile** di mana `ActionPanel` berpindah ke sisi kanan (tidak menutupi meja). |
| **Animasi 60fps & State Cepat** | Belum ada antrean animasi terstruktur; perubahan state langsung mengganti DOM tanpa transisi *deal*, *flip*, *chip travel*, atau sapuan pemenang. | Perlu hook `useAnimationQueue` (`transform` & `opacity` saja, *fast-forward* aman bila state baru tiba cepat, berhenti saat `document.hidden`, dan menghormati `prefers-reduced-motion`). |
| **Suara & Haptik** | Hanya ada 1 nada *oscillator* giliran (`playTurnBeepIfAllowed`) dan getar `navigator.vibrate(90)` tanpa kontrol volume persisten. | Perlu hook `useSfx` berbasis Web Audio API (deal, flip, chip, giliran, menang; default **MATI**, lazy-unlock pasca-interaksi pengguna, kontrol volume + haptik tersimpan di `localStorage`). |
| **Tema & Pengaturan** | Hanya ada toggle `fourColorDeck` & `soundEnabled` di memori store (hilang saat refresh). | Perlu `ThemePicker` & `PokerSettingsSheet` (bottom sheet/drawer) dengan 3 tema meja + 3 desain punggung kartu + pratinjau langsung yang tersimpan di `localStorage`. |
| **Kesenjangan Backend Aktif** | Backend saat ini (`eb84cf4`) menjalankan aturan **Capsa Banting (Big 2 Offline)** (`play`/`pass`, `4 × 13` kartu, Bot AI, skor pengali sisa kartu), bukan Texas Hold'em (`fold`/`check`/`call`/`bet`/`raise`, `communityCards`, pot taruhan). | Lihat poin **Penyelarasan Aturan** di bawah sebelum melangkah ke Tahap 3 & 4. |

---

## 2. Catatan Penting: Penyelarasan Target UI Poker vs Backend Capsa Banting Aktif

Karena pada riwayat proyek ini backend sudah diubah ke **Capsa Banting (Big 2 Offline)**, sementara spesifikasi revamp UI menyebut elemen Texas Hold'em klasik (`Community Card`, `DealerButton/SB/BB`, `BetSlider` Min / ½ Pot / Pot / All-in, `Showdown` 5 kartu terbaik), terdapat **dua opsi pelaksanaan** untuk disetujui:

1. **Opsi A (Disarankan bila backend tetap Capsa Banting sesuai aturan tanpa ubah backend):**
   - Seluruh **15 komponen UI revamp** (`PokerTable`, `Seat`, `PlayingCard`, `CardBack`, `ChipStack`, `PotDisplay`, `DealerButton`, `TurnTimerRing`, `ActionPanel`, `BetSlider`, `ShowdownOverlay`, `HandLogDrawer`, `PokerSettingsSheet`, `ThemePicker`, `ConnectionBadge`) tetap dibangun lengkap dan dapat dilihat/diuji penuh di **halaman pratinjau `/poker/_preview`** (khusus `import.meta.env.DEV`).
   - Pada meja bermain aktif (`/poker/:roomId`), seluruh komponen baru dipakai dengan memetakan elemen ke game **Capsa Banting (Big 2)**: tengah meja menampilkan kartu banting aktif + akumulasi taruhan/chip meja (`PotDisplay` & `ChipStack`), `TurnTimerRing` mengelilingi avatar pemain/bot, `ShowdownOverlay` merayakan pemenang & memindahkan chip ke pemenang, dan `ActionPanel` menampilkan kontrol Capsa Banting + pengaturan/tema/suara.
2. **Opsi B (Bila menginginkan gameplay aktif kembali/mendukung Texas Hold'em murni di meja):**
   - Frontend memakai mode Texas Hold'em pada komponen di atas, dan perlu persetujuan Anda di tahap terpisah untuk mengaktifkan kembali mesin aturan Texas Hold'em (atau dual-mode *Capsa Banting + Texas Hold'em*) di backend.

*(Pertanyaan konfirmasi disertakan di akhir laporan agar keputusan jelas sebelum Tahap 2/3).*

---

## 3. Arsitektur Design Tokens & Tema (Tanpa Konflik MUI)

Seluruh token UI poker ditempatkan di satu modul terpusat (`client/src/styles/pokerTokens.css` dan konstanta metadata `client/src/components/poker/pokerThemes.js`) di bawah cakupan class `.poker-stage`, sehingga tidak mengganggu komponen MUI lain karena `tailwind.config.js` memakai `preflight: false`.

### A. 3 Tema Meja (`ThemePicker`)
Semua tema dirancang memenuhi rasio kontras teks minimum **WCAG AA (≥ 4.5:1)**:

1. **`emerald_royal` — Zamrud Klasik PASIM *(Default)***
   - Felt radial: `#0f5132` (tengah) → `#064e3b` (tengah-luar) → `#022c22` (vignette tepi)
   - Rail meja: bingkai kulit/kayu gelap `#2a1d17` dengan highlight bibir rail `#b45309` / emas redup
   - Latar arena: `#061311` → `#0b1f1c`
2. **`midnight_sapphire` — Safir Malam**
   - Felt radial: `#1e3a8a` → `#172554` → `#0b132b`
   - Rail meja: slate gelap `#1e293b` dengan highlight tipis `#64748b`
   - Latar arena: `#060b16` → `#0f172a`
3. **`crimson_velvet` — Velvet Marun PASIM**
   - Felt radial: `#71181d` → `#4a0e13` → `#260608`
   - Rail meja: kayu eboni `#231416` dengan highlight perunggu `#d97706`
   - Latar arena: `#140608` → `#1c0b0e`

### B. 3 Desain Punggung Kartu SVG (`CardBack`)
1. **`pasim_crest`** — Motif wajik geometris klasik dengan medali monogram halus PASIM dan bingkai ganda putih-gading.
2. **`emerald_lattice`** — Anyaman kisi diagrid zamrud dengan aksen sudut simetris emas muda.
3. **`midnight_rosette`** — Pola roset vektor konsentris warna biru malam & perak.

### C. Opsi Dek 4-Warna & Aksesibilitas Buta Warna
- **Standar 2 Warna:** `♠` & `♣` memakai `#0f172a` (slate gelap), `♥` & `♦` memakai `#dc2626` (merah kontras tinggi).
- **Mode 4 Warna (Buta Warna Friendly):** `♠` `#0f172a` (hitam), `♥` `#e11d48` (merah), `♦` `#0284c7` (biru cerah), `♣` `#047857` (hijau zamrud) — dipasangkan dengan bentuk ikon suit SVG unik sehingga tidak bergantung pada warna semata.

---

## 4. Rencana Komponen Modular & Hooks (`client/src/components/poker/` & `client/src/hooks/`)

1. **`PlayingCard.jsx`**: Kartu depan berbasis SVG kustom dengan angka indeks tajam, simbol suit vektor, sudut membulat (`--poker-card-radius`), opsi 2-warna/4-warna, status selected/lifted, dan *highlight* pemenang.
2. **`CardBack.jsx`**: Punggung kartu SVG mendukung 3 varian (`pasim_crest`, `emerald_lattice`, `midnight_rosette`) dan sisi belakang flip 3D (`backface-visibility: hidden`).
3. **`ChipStack.jsx`**: SVG chip kasino dengan *edge spots* dan warna per denominasi (`1/5`: slate, `10/20`: biru/merah, `50`: hijau, `100`: hitam-emas, `500`: ungu), dirender bertumpuk 3D ringan + label jumlah terbaca jelas.
4. **`PotDisplay.jsx`**: Kapsul pot di tengah atas meja dengan `ChipStack`, label main/side pot (atau total taruhan ronde), dan angka *count-up* halus.
5. **`DealerButton.jsx`**: Token bulat `D` (atau `SB` / `BB` / `1st`) dengan tepi metalik berdiameter kompak.
6. **`TurnTimerRing.jsx`**: Cincin progres SVG (`stroke-dashoffset` berbasis `requestAnimationFrame` tanpa pemicu layout) mengelilingi langsung avatar bulat pemain, bergradasi warna hijau → kuning (≤ 50%) → merah berkedip halus (≤ 25%).
7. **`Seat.jsx`**: Avatar bulat terbungkus `TurnTimerRing`, papan nama ringkas (`nama`, `chip`), penanda badge (`D`/`SB`/`BB`/Bot), chip taruhan di depan kursi, status visual (`Fold`/`Pass` opacity redup, `All-in` pendar halus, `Away` desaturasi abu-abu), dan gelembung emote.
8. **`PokerTable.jsx`**: Meja oval/stadium responsif berbasis CSS variables + `@container` queries (menjaga proporsi di `360×640`, `390×844`, `412×915`, landscape HP, `768`, `1280`, `1920`), kain bertekstur (radial gradient + SVG `feTurbulence` noise ringan), rail berlapis, vignette, slot 4 kursi dengan posisi `"kamu"` selalu di bawah, dan area tengah kartu.
9. **`ActionPanel.jsx`** & **`BetSlider.jsx`**:
   - Target sentuh minimal `44×44px`, berada di jangkauan jempol di bawah (portrait) atau **sisi kanan meja pada landscape HP**.
   - Mendukung slider taruhan halus (`Min`, `½ Pot`, `Pot`, `All-in` + angka besar + dialog konfirmasi All-in + *pre-action* opsional) maupun tombol aksi cepat Capsa Banting (`Banting`, `Lewat`, `Saran`, `Urut`, `Reset`).
10. **`ShowdownOverlay.jsx`**: Sorotan 5 kartu terbaik pemenang (terangkat & bercahaya halus, kartu lain meredup), nama kombinasi tangan (misal `"Full House, As atas Raja"` / rincian penalti Capsa), animasi sapuan chip/pot ke pemenang, dan partikel selebrasi ringkas & hemat GPU.
11. **`HandLogDrawer.jsx`**: Drawer geser untuk riwayat aksi dan riwayat tangan agar area utama meja tetap bersih.
12. **`PokerSettingsSheet.jsx`** & **`ThemePicker.jsx`**: Bottom sheet (mobile) / modal ringkas untuk memilih 3 tema meja, 3 punggung kartu dengan pratinjau langsung, mode 4-warna, volume/mute suara, dan toggle getaran haptik (tersimpan di `localStorage`).
13. **`ConnectionBadge.jsx`**: Indikator status koneksi (`Terhubung`, `Menyambung ulang`, `Terputus`) yang ringkas di sudut atas.
14. **Custom Hooks & Logika Teruji:**
    - `useAnimationQueue.js`: Antrean efek berurutan (`deal`, `flip`, `chip-to-pot`, `showdown-sweep`) dengan pengaman *fast-forward* bila state baru tiba sebelum animasi selesai, berhenti otomatis saat tab tidak aktif (`visibilitychange`), dan mode instan bila `prefers-reduced-motion` aktif.
    - `useSfx.js`: Generator efek suara Web Audio API sintetis murni (nol file eksternal besar, default **MATI**, lazy `AudioContext.resume()` saat klik user pertama).
    - `pokerUiHelpers.js`: Utilitas murni perhitungan koordinat kursi relatif, kalkulasi slider taruhan (`Min`, `½ Pot`, `Pot`, `All-in`), dan helper antrean animasi yang akan diuji dengan script unit test khusus.

---

## 5. Rencana Pengerjaan Bertahap & Kriteria Verifikasi

- **Tahap 1 *(Saat Ini)*:** Audit + penyusunan `POKER_UI_BRIEF.md`.
- **Tahap 2:** Design tokens (`pokerTokens.css`), komponen dasar (`PlayingCard`, `CardBack`, `ChipStack`, `PotDisplay`, `DealerButton`, `TurnTimerRing`, `Seat`, `ConnectionBadge`) + route dev-only `/poker/_preview` (`import.meta.env.DEV`) + unit check.
- **Tahap 3:** Layout meja responsif (`PokerTable` dengan container queries, mode portrait, **landscape HP**, tablet, desktop) + verifikasi perhitungan posisi kursi.
- **Tahap 4:** Panel aksi (`ActionPanel`, `BetSlider`, konfirmasi All-in, *pre-action*) + unit test kalkulasi taruhan & layout.
- **Tahap 5:** Sistem animasi 60fps (`useAnimationQueue` dengan *fast-forward*, `ShowdownOverlay`, flip 3D, chip-to-pot) + unit test antrean animasi.
- **Tahap 6:** Tema & pengaturan (`ThemePicker`, `PokerSettingsSheet`, `HandLogDrawer`, `useSfx`, haptik) + penyimpanan preferensi `localStorage`.
- **Tahap 7:** Integrasi penuh ke `/poker/:roomId` + polish aksesibilitas (`aria-live`, fokus keyboard, WCAG AA), audit ukuran bundle lazy-load, & checklist QA visual lintas ukuran layar (`360×640` s/d `1920`).
