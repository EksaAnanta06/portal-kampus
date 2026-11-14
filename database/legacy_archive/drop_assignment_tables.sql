-- ============================================================================
-- SCRIPT MIGRATION: HAPUS FITUR TUGAS KULIAH (ASSIGNMENT HUB)
-- ============================================================================

-- Hapus tabel dengan mematuhi foreign key dependencies
DROP TABLE IF EXISTS penilaian;
DROP TABLE IF EXISTS pengumpulan_berkas;
DROP TABLE IF EXISTS pengumpulan;
DROP TABLE IF EXISTS tugas_lampiran;
DROP TABLE IF EXISTS tugas;
