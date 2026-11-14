-- ============================================================================
-- SCRIPT MIGRATION: REKONFIGURASI PERPUSTAKAAN MATERI KULIAH (PEER-TO-PEER)
-- Menghapus tabel LMS Dosen/Asdos dan menambahkan alur moderasi materi
-- ============================================================================

-- 1. Hapus tabel LMS Dosen & Peserta kaku yang tidak lagi digunakan
DROP TABLE IF EXISTS kelas_pengajar;
DROP TABLE IF EXISTS kelas_peserta;

-- 2. Tambahkan kolom kontributor (mahasiswa/alumni) dan status moderasi pada materi_item
ALTER TABLE materi_item
ADD COLUMN uploaded_by INT UNSIGNED NULL AFTER pertemuan_id,
ADD COLUMN status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'approved' AFTER is_published,
ADD COLUMN moderated_by INT UNSIGNED NULL AFTER status,
ADD COLUMN moderated_at TIMESTAMP NULL AFTER moderated_by,
ADD COLUMN moderation_note TEXT NULL AFTER moderated_at,
ADD CONSTRAINT fk_mi_uploader
    FOREIGN KEY (uploaded_by) REFERENCES users(id)
    ON DELETE SET NULL,
ADD CONSTRAINT fk_mi_moderator
    FOREIGN KEY (moderated_by) REFERENCES users(id)
    ON DELETE SET NULL;

ALTER TABLE materi_item
ADD INDEX idx_materi_status (status);
