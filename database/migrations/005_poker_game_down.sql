-- ============================================================================
-- MIGRATION 005 (DOWN): Menghapus tabel fitur Poker Virtual Hiburan
-- ============================================================================

USE db_portal_pasim;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS poker_laporan;
DROP TABLE IF EXISTS poker_riwayat;
SET FOREIGN_KEY_CHECKS = 1;
