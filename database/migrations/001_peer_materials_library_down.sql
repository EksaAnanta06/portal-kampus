-- ============================================================================
-- MIGRATION 001 (DOWN): Rollback Modul Perpustakaan Materi
-- PERINGATAN: Menghapus seluruh data materi, koleksi, request, dan katalog!
-- WAJIB lakukan backup mysqldump sebelum mengeksekusi rollback ini.
-- ============================================================================

USE db_portal_pasim;

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS materi_laporan;
DROP TABLE IF EXISTS paket_belajar_item;
DROP TABLE IF EXISTS paket_belajar;
DROP TABLE IF EXISTS materi_request;
DROP TABLE IF EXISTS materi_koleksi_item;
DROP TABLE IF EXISTS materi_koleksi;
DROP TABLE IF EXISTS materi_komentar;
DROP TABLE IF EXISTS materi_vote;
DROP TABLE IF EXISTS materi_version;
DROP TABLE IF EXISTS materi_file;
DROP TABLE IF EXISTS materi;
DROP TABLE IF EXISTS mata_kuliah;
DROP TABLE IF EXISTS prodi;

SET FOREIGN_KEY_CHECKS = 1;
